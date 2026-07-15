"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Mic, Square, Copy, Sparkles, ListTodo, Save, Mail,
  Loader2, Upload, CheckCircle2, AlertCircle, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { getCustomerRecordings, saveCustomerRecording, createCustomerTodo, type CustomerRecording } from "@/lib/actions/crm-features";
import { sendRecordingSummaryEmail } from "@/lib/actions/sales-flow";
import { uploadVoiceRecording, saveVoiceTranscriptResult } from "@/lib/actions/voice-recording";
import { improveRecordingText } from "@/lib/actions/bridge-ai";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 3000;
const ASYNC_THRESHOLD_SEC = 720;  // 12分

type RecordingState = "idle" | "recording" | "uploading" | "transcribing" | "done" | "error";

type MeetingResult = {
  title: string;
  summary: string;
  keyPoints: string[];
  todos: Array<{ title: string; priority: "high" | "medium" | "low"; dueDate?: string }>;
  speakers: Array<{ label: string; role: string; highlights: string[] }>;
  customerUpdates: Record<string, string | null>;
};

export function RecordingSummaryTab({
  customerId,
  dealId,
  customerEmail,
}: {
  customerId: string;
  dealId?: string;
  customerEmail?: string | null;
}) {
  const [recordings, setRecordings] = useState<CustomerRecording[]>([]);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [liveTranscript, setLiveTranscript] = useState(""); // Web Speech API リアルタイム
  const [result, setResult] = useState<MeetingResult | null>(null);
  const [memo, setMemo] = useState("");
  const [selection, setSelection] = useState("");
  const [sendToCustomer, setSendToCustomer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [improving, setImproving] = useState(false);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [pollProgress, setPollProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speechRef = useRef<{ stop: () => void } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  const load = useCallback(() => {
    getCustomerRecordings(customerId).then(setRecordings).catch(() => {});
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      speechRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── 録音開始 ──────────────────────────────────────────────
  const startRecording = async () => {
    setErrorMsg(null);
    setTranscript("");
    setLiveTranscript("");
    setResult(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("マイクへのアクセスが拒否されました。ブラウザの設定を確認してください");
      return;
    }

    // MediaRecorder セットアップ（WebM/Opus 32kbps）
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "audio/ogg";

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      audioBitsPerSecond: 32000,
    });
    audioChunksRef.current = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };
    mediaRecorder.start(1000); // 1秒ごとにチャンク
    mediaRecorderRef.current = mediaRecorder;
    startedAtRef.current = Date.now();

    // Web Speech API でリアルタイム表示
    startWebSpeech();

    // タイマー
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);

    setRecordingState("recording");
  };

  // ── 録音停止 ──────────────────────────────────────────────
  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;

    mediaRecorderRef.current.onstop = async () => {
      const durationSec = Math.floor((Date.now() - startedAtRef.current) / 1000);
      const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType ?? "audio/webm" });
      speechRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      await processAudio(audioBlob, durationSec);
    };

    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    setRecordingState("uploading");
  };

  // ── 音声処理（アップロード → 文字起こし） ───────────────────
  const processAudio = async (audioBlob: Blob, durationSec: number) => {
    setRecordingState("uploading");
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob);
      formData.append("customerId", customerId);
      if (dealId) formData.append("dealId", dealId);
      formData.append("durationSec", String(durationSec));

      const { mode, storagePath, jobId: newJobId } = await uploadVoiceRecording(formData);

      setRecordingState("transcribing");

      if (mode === "sync") {
        // 同期処理（12分以内）
        const res = await fetch("/api/voice-transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storagePath, customerId, dealId, durationSec, fileSizeBytes: audioBlob.size }),
        });
        const data = await res.json() as {
          transcript?: string;
          result?: MeetingResult;
          recordingId?: string;
          error?: string;
        };

        if (!res.ok || data.error) throw new Error(data.error ?? "文字起こしに失敗しました");

        // Web Speech の結果と比較して良い方を採用
        const finalTranscript = pickBestTranscript(data.transcript ?? "", liveTranscript);
        setTranscript(finalTranscript);
        setResult(data.result ?? null);
        if (data.result?.summary) setMemo(data.result.summary);
        setRecordingState("done");
        toast.success("文字起こし完了！結果を確認してください");

        // 同期API側で録音保存＋商談登録済み。recordingIdが無い場合のみフロントから後処理
        if (!data.recordingId && finalTranscript && data.result) {
          saveVoiceTranscriptResult({
            customerId,
            dealId,
            storagePath,
            transcript: finalTranscript,
            result: data.result,
          }).catch(() => {});
        }
      } else {
        // 非同期処理（12分超）
        if (!newJobId) throw new Error("ジョブIDが取得できませんでした");
        setJobId(newJobId);
        startPolling(newJobId, storagePath);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "処理に失敗しました";
      setErrorMsg(msg);
      setRecordingState("error");
      toast.error(msg);
    }
  };

  // ── 非同期ジョブのポーリング ───────────────────────────────
  const startPolling = (jId: string, storagePath: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/voice-job-status?jobId=${jId}`);
        const job = await res.json() as {
          status: string;
          transcript?: string;
          result?: MeetingResult & { progress?: number };
          error?: string;
        };

        if (job.result?.progress) setPollProgress(job.result.progress);

        if (job.status === "done") {
          clearInterval(pollRef.current!);
          const finalTranscript = pickBestTranscript(job.transcript ?? "", liveTranscript);
          setTranscript(finalTranscript);
          setResult(job.result ?? null);
          if (job.result?.summary) setMemo(job.result.summary);
          setJobId(null);
          setPollProgress(0);
          setRecordingState("done");
          toast.success("文字起こし完了！結果を確認してください");

          // 営業フロー後処理
          if (job.transcript && job.result) {
            saveVoiceTranscriptResult({
              customerId,
              dealId,
              storagePath,
              transcript: job.transcript,
              result: job.result,
            }).catch(() => {});
          }
        } else if (job.status === "error") {
          clearInterval(pollRef.current!);
          setErrorMsg(job.error ?? "文字起こしに失敗しました");
          setRecordingState("error");
          toast.error(job.error ?? "文字起こしに失敗しました");
        }
      } catch {
        // ポーリングエラーは無視して継続
      }
    }, POLL_INTERVAL_MS);
  };

  // ── Web Speech API（リアルタイム表示補助） ──────────────────
  const startWebSpeech = () => {
    type SpeechCtor = new () => {
      lang: string; continuous: boolean; interimResults: boolean;
      onresult: (e: { results: ArrayLike<{ 0: { transcript: string } }> }) => void;
      onerror: () => void; start: () => void; stop: () => void;
    };
    const w = window as unknown as { webkitSpeechRecognition?: SpeechCtor; SpeechRecognition?: SpeechCtor };
    const SR = w.webkitSpeechRecognition ?? w.SpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.lang = "ja-JP";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setLiveTranscript(text);
    };
    rec.onerror = () => {};
    rec.start();
    speechRef.current = rec;
  };

  // ── 保存 ─────────────────────────────────────────────────
  const saveEntry = async () => {
    const text = [transcript, memo].filter(Boolean).join("\n\n").trim();
    if (!text) { toast.error("文字起こしまたはメモを入力してください"); return; }
    if (sendToCustomer && !customerEmail?.trim()) {
      toast.error("顧客のメールアドレスが未登録です");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveCustomerRecording({
        customer_id: customerId,
        deal_id: dealId,
        transcript: transcript.trim(),
        summary: result?.summary ?? (transcript || memo).slice(0, 120),
        memo: memo.trim(),
        title: result?.title ?? `商談 ${format(new Date(), "M/d HH:mm", { locale: ja })}`,
      });

      let emailSent = false;
      if (sendToCustomer && customerEmail?.trim()) {
        try {
          await sendRecordingSummaryEmail({ customerId, recordingId: saved.id });
          emailSent = true;
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "メール送信に失敗しました");
        }
      }

      toast.success(emailSent ? `保存し、${customerEmail} へ要約メールを送信しました` : "保存しました");
      setTranscript("");
      setLiveTranscript("");
      setResult(null);
      setMemo("");
      setRecordingState("idle");
      setSendToCustomer(false);
      load();
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // ── 文章改善 ──────────────────────────────────────────────
  const improveText = async () => {
    const text = selection || memo;
    if (!text.trim()) return;
    setImproving(true);
    try {
      const { result: improved, ok } = await improveRecordingText(text);
      if (ok) { setMemo(improved); toast.success("文章を改善しました"); }
      else toast.error("AI機能が設定されていません");
    } catch {
      toast.error("文章改善に失敗しました");
    } finally {
      setImproving(false);
    }
  };

  const addTodoFromSelection = async () => {
    const text = selection || memo;
    if (!text.trim()) { toast.error("テキストを選択するかメモを入力してください"); return; }
    try {
      await createCustomerTodo({ customer_id: customerId, title: text.slice(0, 80), description: text, source: "recording" });
      toast.success("ToDoに追加しました");
    } catch { toast.error("追加に失敗しました"); }
  };

  const sendSummaryEmail = async (recordingId: string) => {
    if (!customerEmail?.trim()) { toast.error("顧客のメールアドレスが未登録です"); return; }
    setSendingEmailId(recordingId);
    try {
      const { sentTo } = await sendRecordingSummaryEmail({ customerId, recordingId });
      toast.success(`${sentTo} に要約メールを送信しました`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "メール送信に失敗しました");
    } finally { setSendingEmailId(null); }
  };

  const isProcessing = recordingState === "uploading" || recordingState === "transcribing";

  return (
    <div className="space-y-4">
      {/* 録音 / 文字起こし（2カラム） */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-stretch">
        {/* 左: 録音 + 履歴 */}
        <Card variant="inset" className="py-0 overflow-hidden h-full">
          <CardHeader className="pb-2 pt-4 px-4 border-b border-border/40">
            <CardTitle className="text-sm font-semibold">録音</CardTitle>
            <CardDescription className="text-xs">
              MediaRecorder + OpenAI Whisper（60分以上対応）
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-4 flex-1 flex flex-col gap-4">
            <div className="space-y-3">
              {recordingState === "idle" && (
                <Button size="sm" onClick={startRecording} className="gap-1.5 h-9 w-fit">
                  <Mic className="h-4 w-4" />
                  録音開始
                </Button>
              )}

              {recordingState === "recording" && (
                <RecordingActivePanel
                  elapsed={elapsed}
                  liveTranscript={liveTranscript}
                  onStop={stopRecording}
                />
              )}

              {isProcessing && (
                <ProcessingPanel
                  state={recordingState}
                  progress={pollProgress}
                  jobId={jobId}
                />
              )}

              {recordingState === "error" && errorMsg && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">処理に失敗しました</p>
                    <p className="text-xs mt-0.5">{errorMsg}</p>
                  </div>
                  <Button size="sm" variant="outline" className="ml-auto shrink-0 h-7 text-xs" onClick={() => setRecordingState("idle")}>
                    リセット
                  </Button>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                {customerEmail?.trim() ? (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                    <Checkbox checked={sendToCustomer} onCheckedChange={(v) => setSendToCustomer(v === true)} />
                    <span>要約を <span className="font-medium text-foreground">{customerEmail}</span> へ送信</span>
                  </label>
                ) : (
                  <p className="text-xs text-muted-foreground">顧客メール未登録のため送信できません</p>
                )}
                <Button onClick={saveEntry} disabled={saving || isProcessing || recordingState === "recording"} className="h-9 gap-1.5 shrink-0">
                  <Save className="h-4 w-4" />
                  {saving ? "保存中..." : "保存"}
                </Button>
              </div>
            </div>

            <div className="border-t border-border/40 pt-4 flex-1 flex flex-col min-h-0">
              <p className="text-sm font-semibold">履歴</p>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">保存した録音・文字起こし</p>
              {recordings.length === 0 ? (
                <p className="text-xs text-muted-foreground flex-1 flex items-center justify-center py-4 text-center rounded-lg border border-dashed border-border/60 bg-muted/10">
                  履歴なし
                </p>
              ) : (
                <div className="divide-y divide-border/40 rounded-lg border border-border/60 overflow-hidden flex-1 min-h-0 overflow-y-auto">
                  {recordings.map((r) => (
                    <div
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(selectedId === r.id ? null : r.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedId(selectedId === r.id ? null : r.id); } }}
                      className="w-full text-left px-3 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">{r.title}</span>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {format(new Date(r.recorded_at), "yyyy/MM/dd HH:mm", { locale: ja })}
                        </span>
                      </div>
                      {selectedId === r.id && (
                        <div className="mt-2 space-y-2 text-sm text-left">
                          {r.summary && <p className="text-muted-foreground text-xs"><strong>要約:</strong> {r.summary}</p>}
                          {r.transcript && (
                            <div>
                              <p className="text-[11px] font-medium text-muted-foreground mb-1">文字起こし</p>
                              <p className="whitespace-pre-wrap text-xs">{r.transcript}</p>
                            </div>
                          )}
                          {r.memo && (
                            <div>
                              <p className="text-[11px] font-medium text-muted-foreground mb-1">メモ</p>
                              <p className="text-xs whitespace-pre-wrap">{r.memo}</p>
                            </div>
                          )}
                          {r.summary && customerEmail?.trim() && (
                            <div className="pt-1">
                              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" disabled={sendingEmailId === r.id}
                                onClick={(e) => { e.stopPropagation(); void sendSummaryEmail(r.id); }}>
                                <Mail className="h-3.5 w-3.5" />
                                {sendingEmailId === r.id ? "送信中..." : "顧客に要約を送信"}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card variant="inset" className="py-0 overflow-hidden h-full">
          <CardHeader className="pb-2 pt-4 px-4 border-b border-border/40">
            <CardTitle className="text-sm font-semibold">文字起こし・要約</CardTitle>
            <CardDescription className="text-xs">
              録音後にAIが文字起こしと要約を生成します
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-4 flex-1 flex flex-col gap-3 min-h-0">
            {recordingState === "done" && transcript ? (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm whitespace-pre-wrap flex-[3] min-h-[160px] overflow-y-auto">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground">文字起こし結果</p>
                  <Button size="icon" variant="ghost" className="size-6 h-5" onClick={() => { navigator.clipboard.writeText(transcript); toast.success("コピーしました"); }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                {transcript}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-3 flex-[3] min-h-[160px] flex items-center justify-center">
                <p className="text-xs text-muted-foreground text-center">
                  {recordingState === "recording" || isProcessing
                    ? "録音停止後に文字起こし結果がここに表示されます"
                    : "録音後、文字起こし結果がここに表示されます"}
                </p>
              </div>
            )}

            {result?.speakers && result.speakers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {result.speakers.map((s, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {s.label}（{s.role}）
                  </Badge>
                ))}
              </div>
            )}

            <div className="relative shrink-0">
              <Textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                onSelect={(e) => setSelection((e.target as HTMLTextAreaElement).value.substring(
                  (e.target as HTMLTextAreaElement).selectionStart,
                  (e.target as HTMLTextAreaElement).selectionEnd,
                ))}
                rows={3}
                className="min-h-[72px] resize-none [field-sizing:fixed]"
                placeholder={recordingState === "done" ? "AI要約（編集可能）" : "営業メモ（手入力可）"}
              />
              {(selection || memo) && (
                <div className="absolute bottom-2 right-2 flex gap-1 rounded-lg border bg-background shadow-sm p-1">
                  <Button size="icon" variant="ghost" className="size-7" title="ToDoに追加" onClick={addTodoFromSelection}>
                    <ListTodo className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-7" title="AIで改善" onClick={() => void improveText()} disabled={improving}>
                    {improving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="size-7" title="コピー" onClick={() => { navigator.clipboard.writeText(selection || memo); toast.success("コピーしました"); }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {result?.todos && result.todos.length > 0 && (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground mb-1.5">AIが提案したToDo</p>
                {result.todos.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={cn("inline-block w-1.5 h-1.5 rounded-full shrink-0",
                      t.priority === "high" ? "bg-rose-500" : t.priority === "medium" ? "bg-amber-500" : "bg-emerald-500"
                    )} />
                    <span>{t.title}</span>
                    {t.dueDate && <span className="text-muted-foreground ml-auto">{t.dueDate}</span>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Web Speech と Whisper の結果を比較して長い方・精度高そうな方を採用 */
function pickBestTranscript(serverText: string, liveText: string): string {
  if (!serverText) return liveText;
  if (!liveText) return serverText;
  // Whisperの方が精度が高いので基本的にサーバー結果を優先
  // ただし極端に短い場合はWeb Speechの方が詳しいことがある
  return serverText.length >= liveText.length * 0.7 ? serverText : liveText;
}

function formatTime(sec: number): string {
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function VoiceWaveform() {
  return (
    <div className="flex items-end justify-end gap-0.5 h-6 mt-1" aria-hidden>
      {[40, 70, 55, 90, 45, 75, 50].map((h, i) => (
        <span key={i} className="w-1 rounded-full bg-red-400/80 animate-pulse"
          style={{ height: `${h}%`, animationDelay: `${i * 0.12}s`, animationDuration: "0.8s" }} />
      ))}
    </div>
  );
}

function RecordingActivePanel({ elapsed, liveTranscript, onStop }: {
  elapsed: number;
  liveTranscript: string;
  onStop: () => void;
}) {
  const isLong = elapsed > ASYNC_THRESHOLD_SEC;
  return (
    <div className="rounded-xl border-2 border-red-200/80 bg-gradient-to-b from-red-50/90 to-background dark:from-red-950/30 dark:to-background dark:border-red-900/50 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex items-center justify-center size-12 shrink-0 rounded-full bg-red-100 dark:bg-red-950/60">
            <span className="absolute inset-0 rounded-full bg-red-400/25 animate-ping" />
            <Mic className="h-5 w-5 text-red-600 dark:text-red-400 relative z-10" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">録音中</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950/60 dark:text-red-300">
                <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
                REC
              </span>
              {isLong && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  <Clock className="h-2.5 w-2.5" />
                  非同期処理
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isLong ? "12分超のため非同期処理になります" : "マイクに向かって話してください"}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-mono tabular-nums font-semibold text-red-700 dark:text-red-400">{formatTime(elapsed)}</p>
          <VoiceWaveform />
        </div>
      </div>

      {liveTranscript && (
        <div className="rounded-lg border border-red-200/60 bg-white/70 dark:bg-black/20 dark:border-red-900/40 p-3 min-h-[80px] max-h-36 overflow-y-auto">
          <p className="text-[11px] font-medium text-muted-foreground mb-1">リアルタイム（Web Speech）</p>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{liveTranscript}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-1 border-t border-red-200/50 dark:border-red-900/30">
        <p className="text-[11px] text-muted-foreground">停止後にWhisperで高精度文字起こしします</p>
        <Button size="sm" variant="destructive" onClick={onStop} className="gap-1.5 h-9 shrink-0">
          <Square className="h-4 w-4" />
          録音停止
        </Button>
      </div>
    </div>
  );
}

function ProcessingPanel({ state, progress, jobId }: {
  state: RecordingState;
  progress: number;
  jobId: string | null;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
      <div className="flex items-center gap-3">
        {state === "uploading" ? (
          <Upload className="h-5 w-5 text-primary animate-bounce shrink-0" />
        ) : (
          <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
        )}
        <div>
          <p className="text-sm font-medium">
            {state === "uploading" ? "音声をアップロード中..." : jobId ? "文字起こし中（非同期）..." : "文字起こし中..."}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {jobId ? "長時間録音のため時間がかかる場合があります（最大15分）" : "しばらくお待ちください"}
          </p>
        </div>
      </div>
      {jobId && progress > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>処理中...</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
