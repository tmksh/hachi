"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { getAnnouncement, addAnnouncementComment } from "@/lib/actions/announcements";
import { ROLE_LABELS, type Role } from "@/lib/constants";

type Detail = Awaited<ReturnType<typeof getAnnouncement>>;

export default function CirculationDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  const load = () => { if (id) getAnnouncement(id as string).then(setData).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(load, [id]);

  const handleComment = async () => {
    if (!comment.trim()) return;
    setSending(true);
    try { await addAnnouncementComment(id as string, comment.trim()); setComment(""); load(); toast.success("コメントしました"); } catch { toast.error("失敗"); } finally { setSending(false); }
  };

  if (loading) return <div className="p-4 md:p-6 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64" /></div>;
  if (!data) return <div className="p-4 md:p-6"><Link href="/circulation" className="text-sm text-muted-foreground flex items-center gap-1"><ArrowLeft className="h-4 w-4" />戻る</Link><p className="mt-4">見つかりません</p></div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Link href="/circulation" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />一覧に戻る</Link>
      <div>
        <div className="flex items-center gap-2 mb-2">
          {data.is_urgent && <Badge variant="destructive">緊急</Badge>}
          {data.pinned && <Badge variant="secondary">固定</Badge>}
          {data.target_type === "roles" &&
            Array.isArray(data.target_roles) &&
            data.target_roles.length > 0 && (
              <Badge variant="outline" className="gap-1">
                <Users className="h-3 w-3" />
                {(data.target_roles as Role[])
                  .map((r) => ROLE_LABELS[r] ?? r)
                  .join("・")}
              </Badge>
            )}
        </div>
        <h1 className="text-xl font-semibold">{data.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{data.author?.display_name ?? "-"} · {format(parseISO(data.published_at), "yyyy年M月d日 HH:mm", { locale: ja })}</p>
      </div>
      <Card><CardContent className="p-5"><div className="prose prose-sm max-w-none whitespace-pre-wrap">{data.body}</div></CardContent></Card>
      <Card><CardHeader className="pb-3"><CardTitle className="text-sm">コメント</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {(data.comments ?? []).map((c: { id: string; user?: { display_name: string } | null; message: string; created_at: string }) => (
            <div key={c.id} className="border-b pb-3 last:border-0">
              <div className="flex justify-between text-sm mb-1"><span className="font-medium">{c.user?.display_name ?? "-"}</span><span className="text-muted-foreground">{format(parseISO(c.created_at), "M/d HH:mm", { locale: ja })}</span></div>
              <p className="text-sm">{c.message}</p>
            </div>
          ))}
          <div className="flex gap-2"><Textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="コメントを入力..." rows={2} className="flex-1" /><Button onClick={handleComment} disabled={sending || !comment.trim()} className="self-end"><Send className="h-4 w-4" /></Button></div>
        </CardContent>
      </Card>
    </div>
  );
}
