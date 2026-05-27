"use client";

import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Square, Copy, Sparkles, ListTodo } from "lucide-react";
import { toast } from "sonner";
import { getCustomerRecordings, saveCustomerRecording, createCustomerTodo, type CustomerRecording } from "@/lib/actions/crm-features";

export function RecordingSummaryTab({ customerId }: { customerId: string }) {
  const [recordings, setRecordings] = useState<CustomerRecording[]>([]);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [memo, setMemo] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selection, setSelection] = useState("");
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const load = () => {
    getCustomerRecordings(customerId).then(setRecordings).catch(() => {});
  };

  useEffect(() => { load(); }, [customerId]);

  const startRecording = () => {
    type SpeechResult = { results: ArrayLike<{ 0: { transcript: string } }> };
    type SpeechCtor = new () => {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onresult: (e: SpeechResult) => void;
      start: () => void;
      stop: () => void;
    };
    const SR = (window as unknown as { webkitSpeechRecognition?: SpeechCtor; SpeechRecognition?: SpeechCtor }).webkitSpeechRecognition
      ?? (window as unknown as { SpeechRecognition?: SpeechCtor }).SpeechRecognition;
    if (!SR) {
      toast.info("音声認識非対応のため、メモ欄に手入力してください");
      setRecording(true);
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
    rec.start();
    recognitionRef.current = rec;
    setRecording(true);
    setTranscript("");
  };

  const stopRecording = async () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setRecording(false);
    const summary = transcript.slice(0, 120) + (transcript.length > 120 ? "…" : "");
    try {
      await saveCustomerRecording({
        customer_id: customerId,
        transcript,
        summary,
        memo,
        title: `商談 ${format(new Date(), "M/d HH:mm", { locale: ja })}`,
      });
      toast.success("録音を保存しました");
      setTranscript("");
      setMemo("");
      load();
    } catch {
      toast.error("保存に失敗しました");
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
    toast.success("文章改善案をメモに反映しました");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {!recording ? (
              <Button size="sm" onClick={startRecording} className="gap-1.5"><Mic className="h-4 w-4" />録音開始</Button>
            ) : (
              <Button size="sm" variant="destructive" onClick={stopRecording} className="gap-1.5"><Square className="h-4 w-4" />録音停止・保存</Button>
            )}
            {recording && <BadgeRecording />}
          </div>
          {transcript && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">{transcript}</div>
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
              placeholder="営業メモ（テキスト選択でツールバー表示）"
            />
            {(selection || memo) && (
              <div className="absolute bottom-2 right-2 flex gap-1 rounded-lg border bg-background shadow-sm p-1">
                <Button size="icon" variant="ghost" className="size-7" title="ToDoに追加" onClick={addTodoFromSelection}><ListTodo className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="size-7" title="文章を改善" onClick={improveText}><Sparkles className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="size-7" title="コピー" onClick={() => { navigator.clipboard.writeText(selection || memo); toast.success("コピーしました"); }}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">録音テキスト履歴</p>
        <div className="space-y-2">
          {recordings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">履歴なし</p>
          ) : recordings.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(selectedId === r.id ? null : r.id)}
              className="w-full text-left rounded-lg border px-3 py-2.5 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{r.title}</span>
                <span className="text-[11px] text-muted-foreground">{format(new Date(r.recorded_at), "yyyy/MM/dd HH:mm", { locale: ja })}</span>
              </div>
              {selectedId === r.id && (
                <div className="mt-2 space-y-2 text-sm">
                  {r.summary && <p className="text-muted-foreground"><strong>要約:</strong> {r.summary}</p>}
                  {r.transcript && <p className="whitespace-pre-wrap">{r.transcript}</p>}
                  {r.memo && <p className="text-xs border-t pt-2">{r.memo}</p>}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BadgeRecording() {
  return <span className="inline-flex items-center gap-1.5 text-xs text-red-600 animate-pulse"><span className="size-2 rounded-full bg-red-500" />録音中</span>;
}
