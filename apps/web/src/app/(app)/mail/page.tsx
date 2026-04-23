"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Pencil } from "lucide-react";
import { toast } from "sonner";
import { getEmailThreads, getEmailThread, markThreadRead, toggleThreadStar } from "@/lib/actions/mail";
import { MOCK_MAIL_THREADS, MOCK_MAIL_THREAD_DETAILS } from "@/lib/mocks/mail-mock";

type Thread = Awaited<ReturnType<typeof getEmailThreads>>[number];
type ThreadDetail = Awaited<ReturnType<typeof getEmailThread>>;

const isMockId = (id: string) => id.startsWith("mock_");

export default function MailPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ThreadDetail | null>(null);

  useEffect(() => {
    getEmailThreads()
      .then((data) => {
        if (!data || data.length === 0) {
          setThreads(MOCK_MAIL_THREADS as unknown as Thread[]);
        } else {
          setThreads(data);
        }
      })
      .catch(() => {
        setThreads(MOCK_MAIL_THREADS as unknown as Thread[]);
      })
      .finally(() => setLoading(false));
  }, []);

  const selectThread = async (t: Thread) => {
    try {
      if (isMockId(t.id)) {
        const detail = MOCK_MAIL_THREAD_DETAILS[t.id];
        if (detail) setSelected(detail as unknown as ThreadDetail);
        if (!t.is_read) {
          setThreads((prev) => prev.map((x) => (x.id === t.id ? { ...x, is_read: true } : x)));
        }
        return;
      }
      const detail = await getEmailThread(t.id);
      setSelected(detail as ThreadDetail);
      if (!t.is_read) {
        await markThreadRead(t.id);
        setThreads((prev) => prev.map((x) => (x.id === t.id ? { ...x, is_read: true } : x)));
      }
    } catch {
      toast.error("読み込みに失敗");
    }
  };

  const handleStar = async (id: string, current: boolean) => {
    if (isMockId(id)) {
      setThreads((prev) => prev.map((x) => (x.id === id ? { ...x, is_starred: !current } : x)));
      return;
    }
    try {
      await toggleThreadStar(id, !current);
      setThreads((prev) => prev.map((x) => (x.id === id ? { ...x, is_starred: !current } : x)));
    } catch {}
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between"><h1 className="text-xl font-semibold">メール</h1><Link href="/mail/compose"><Button size="sm" className="gap-1.5"><Pencil className="h-4 w-4" />新規作成</Button></Link></div>
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
        <Card className="overflow-hidden"><CardContent className="p-0">
          {loading ? <div className="p-4 space-y-3">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-16" />)}</div> : threads.length === 0 ? <div className="p-8 text-center text-muted-foreground">メールはありません</div> : (
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {threads.map(t => (
                <div key={t.id} className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-accent/50 ${selected?.id === t.id ? "bg-accent/30" : ""} ${!t.is_read ? "bg-primary/5" : ""}`} onClick={() => selectThread(t)}>
                  <button onClick={e => { e.stopPropagation(); handleStar(t.id, t.is_starred); }}><Star className={`h-4 w-4 ${t.is_starred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} /></button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${!t.is_read ? "font-semibold" : ""}`}>{t.subject || "(件名なし)"}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.snippet}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{t.last_message_at ? format(parseISO(t.last_message_at), "M/d", { locale: ja }) : ""}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent></Card>
        <Card><CardContent className="p-5">
          {selected ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">{selected.subject || "(件名なし)"}</h2>
              {(selected.messages ?? []).map((msg: { id: string; from_name: string | null; from_address: string | null; received_at: string | null; body_text: string | null }) => (
                <div key={msg.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="font-medium">{msg.from_name || msg.from_address || "-"}</span><span className="text-muted-foreground">{msg.received_at ? format(parseISO(msg.received_at), "M/d HH:mm", { locale: ja }) : ""}</span></div>
                  <p className="text-sm whitespace-pre-wrap">{msg.body_text}</p>
                </div>
              ))}
            </div>
          ) : <div className="flex items-center justify-center h-64 text-muted-foreground">メールを選択してください</div>}
        </CardContent></Card>
      </div>
    </div>
  );
}
