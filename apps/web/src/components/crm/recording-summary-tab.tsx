"use client";

import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Mic, Square, Copy, Sparkles, ListTodo, Save } from "lucide-react";
import { toast } from "sonner";
import { getCustomerRecordings, saveCustomerRecording, createCustomerTodo, type CustomerRecording } from "@/lib/actions/crm-features";

type SpeechSupport = "supported" | "unsupported";

function detectSpeechSupport(): SpeechSupport {
  if (typeof window === "undefined") return "unsupported";
  const w = window as unknown as { webkitSpeechRecognition?: unknown; SpeechRecognition?: unknown };
  return w.webkitSpeechRecognition || w.SpeechRecognition ? "supported" : "unsupported";
}

export function RecordingSummaryTab({ customerId }: { customerId: string }) {
  const [recordings, setRecordings] = useState<CustomerRecording[]>([]);
  const [speechSupport, setSpeechSupport] = useState<SpeechSupport>("unsupported");
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [memo, setMemo] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selection, setSelection] = useState("");
  const [saving, setSaving] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const load = () => {
    getCustomerRecordings(customerId).then(setRecordings).catch(() => {});
  };

  useEffect(() => {
    setSpeechSupport(detectSpeechSupport());
    load();
  }, [customerId]);

  const startListening = () => {
    type SpeechResult = { results: ArrayLike<{ 0: { transcript: string } }> };
    type SpeechCtor = new () => {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onresult: (e: SpeechResult) => void;
      onerror: () => void;
      start: () => void;
      stop: () => void;
    };
    const SR = (window as unknown as { webkitSpeechRecognition?: SpeechCtor; SpeechRecognition?: SpeechCtor }).webkitSpeechRecognition
      ?? (window as unknown as { SpeechRecognition?: SpeechCtor }).SpeechRecognition;

    if (!SR) {
      toast.info("このブラウザでは音声入力に非対応です。メモ欄に直接入力してください");
      return;
    }

    const rec = new SR();
    rec.lang = "ja-JP";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setTranscript(text);
    };
    rec.onerror = () => {
      toast.error("音声認識を開始できませんでした。マイク権限を確認してください");
      setListening(false);
      recognitionRef.current = null;
    };
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
    setTranscript("");
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  };

  const saveEntry = async () => {
    const text = [transcript, memo].filter(Boolean).join("\n\n").trim();
    if (!text) {
      toast.error("文字起こしまたはメモを入力してください");
      return;
    }
    setSaving(true);
    try {
      await saveCustomerRecording({
        customer_id: customerId,
        transcript: transcript.trim(),
        summary: (transcript || memo).slice(0, 120) + ((transcript || memo).length > 120 ? "…" : ""),
        memo: memo.trim(),
        title: `商談 ${format(new Date(), "M/d HH:mm", { locale: ja })}`,
      });
      toast.success("保存しました");
      setTranscript("");
      setMemo("");
      load();
    } catch {
      toast.error("保存に失敗しました。DBマイグレーション（00037）が未適用の可能性があります");
    } finally {
      setSaving(false);
    }
  };

  const addTodoFromSelection = async () => {
    const text = selection || memo;
    if (!text.trim()) { toast.error("テキストを選択するかメモを入力してください"); return; }
    try {
      await createCustomerTodo({ customer_id: customerId, title: text.slice(0, 80), description: text, source: "recording" });
      toast.success("ToDoに追加しました");
    } catch {
      toast.error("追加に失敗しました");
    }
  };

  const improveText = () => {
    const text = selection || memo;
    if (!text.trim()) return;
    setMemo(`${text}\n\n【改善案】要点を整理し、次のアクションを明記した文面に整えました。`);
    toast.info("AI連携は準備中です（現在はサンプル文を挿入しています）");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
        <div className="flex gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs leading-relaxed">
            <p className="font-semibold">現在はプロトタイプです</p>
            <p>
              「録音開始」は<strong>ブラウザの音声認識（Web Speech API）</strong>で文字起こしする簡易版です。
              音声ファイルの保存や電話録音の取り込みは未対応です。
            </p>
            <p className="text-amber-900/80 dark:text-amber-200/80">
              本番運用には STT（Whisper / Google Speech 等）・AI要約・Storage 連携が必要です。
              {speechSupport === "unsupported" && " このブラウザではメモ欄への手入力のみ利用できます。"}
            </p>
          </div>
        </div>
      </div>

      <Card variant="inset" className="py-0 overflow-hidden">
        <CardHeader className="pb-2 pt-4 px-4 border-b border-border/40">
          <CardTitle className="text-sm font-semibold">文字起こし・メモ</CardTitle>
          <CardDescription className="text-xs">
            {speechSupport === "supported"
              ? "音声入力または手入力 → 保存で履歴に追加"
              : "メモ欄に入力 → 保存で履歴に追加"}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 py-4 space-y-3">
          {speechSupport === "supported" && (
            <div className="flex flex-wrap items-center gap-2">
              {!listening ? (
                <Button size="sm" onClick={startListening} className="gap-1.5 h-9">
                  <Mic className="h-4 w-4" />
                  音声入力開始
                </Button>
              ) : (
                <Button size="sm" variant="destructive" onClick={stopListening} className="gap-1.5 h-9">
                  <Square className="h-4 w-4" />
                  音声入力停止
                </Button>
              )}
              {listening && <BadgeListening />}
            </div>
          )}

          {transcript && (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
              <p className="text-[11px] font-medium text-muted-foreground mb-1.5">文字起こし（リアルタイム）</p>
              {transcript}
            </div>
          )}

          <div className="relative">
            <Textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              onSelect={(e) => setSelection((e.target as HTMLTextAreaElement).value.substring(
                (e.target as HTMLTextAreaElement).selectionStart,
                (e.target as HTMLTextAreaElement).selectionEnd,
              ))}
              rows={5}
              placeholder="営業メモ（手入力可。テキスト選択で ToDo追加・コピー）"
            />
            {(selection || memo) && (
              <div className="absolute bottom-2 right-2 flex gap-1 rounded-lg border bg-background shadow-sm p-1">
                <Button size="icon" variant="ghost" className="size-7" title="ToDoに追加" onClick={addTodoFromSelection}>
                  <ListTodo className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="size-7" title="文章を改善（準備中）" onClick={improveText}>
                  <Sparkles className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="size-7" title="コピー" onClick={() => { navigator.clipboard.writeText(selection || memo); toast.success("コピーしました"); }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-1">
            <Button onClick={saveEntry} disabled={saving} className="h-9 gap-1.5">
              <Save className="h-4 w-4" />
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card variant="inset" className="py-0 overflow-hidden">
        <CardHeader className="pb-2 pt-4 px-4 border-b border-border/40">
          <CardTitle className="text-sm font-semibold">履歴</CardTitle>
          <CardDescription className="text-xs">保存した文字起こし・メモ</CardDescription>
        </CardHeader>
        <div className="divide-y divide-border/40">
          {recordings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">履歴なし</p>
          ) : recordings.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(selectedId === r.id ? null : r.id)}
              className="w-full text-left px-4 py-3 hover:bg-white/45 dark:hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm truncate">{r.title}</span>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {format(new Date(r.recorded_at), "yyyy/MM/dd HH:mm", { locale: ja })}
                </span>
              </div>
              {selectedId === r.id && (
                <div className="mt-2 space-y-2 text-sm text-left">
                  {r.summary && <p className="text-muted-foreground"><strong>要約:</strong> {r.summary}</p>}
                  {r.transcript && (
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground mb-1">文字起こし</p>
                      <p className="whitespace-pre-wrap">{r.transcript}</p>
                    </div>
                  )}
                  {r.memo && (
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground mb-1">メモ</p>
                      <p className="text-xs whitespace-pre-wrap">{r.memo}</p>
                    </div>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function BadgeListening() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-red-600 animate-pulse">
      <span className="size-2 rounded-full bg-red-500" />
      音声入力中
    </span>
  );
}
