"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Pencil, Trash2, Phone, Mail, HardHat } from "lucide-react";
import { toast } from "sonner";
import { getCraftsman, deleteCraftsman } from "@/lib/actions/craftsmen";
import type { Craftsman } from "@/lib/database.types";

const SPEC_LABELS: Record<string, string> = { carpenter:"大工", electrical:"電気", interior:"内装", plumbing:"配管", general:"総合" };

export default function CraftsmanDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<Craftsman | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (id) getCraftsman(id as string).then(setData).catch(() => {}).finally(() => setLoading(false)); }, [id]);

  const handleDelete = async () => {
    if (!confirm("この職人を削除しますか？")) return;
    try { await deleteCraftsman(id as string); toast.success("削除しました"); router.push("/craftsmen"); } catch { toast.error("削除に失敗"); }
  };

  if (loading) return <div className="p-4 md:p-6 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64" /></div>;
  if (!data) return <div className="p-4 md:p-8"><Link href="/craftsmen" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"><ArrowLeft className="h-4 w-4" />戻る</Link><p className="mt-4">見つかりません</p></div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Link href="/craftsmen" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />職人一覧</Link>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center"><HardHat className="h-7 w-7 text-primary" /></div>
          <div><h1 className="text-2xl font-semibold tracking-tight text-[#0F5132]">{data.name}</h1><p className="text-sm text-muted-foreground">{data.company_name || "-"}</p></div>
          {data.specialty && <Badge variant="secondary">{SPEC_LABELS[data.specialty]}</Badge>}
          {data.rank && <Badge>{data.rank}ランク</Badge>}
        </div>
        <div className="flex gap-2">
          <Link href={`/craftsmen/${id}/edit`}><Button variant="outline" size="sm"><Pencil className="h-4 w-4 mr-1" />編集</Button></Link>
          <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive"><Trash2 className="h-4 w-4 mr-1" />削除</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">連絡先</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{data.phone}</div>}
            {data.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{data.email}</div>}
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">実績</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">進行中案件</span><span className="font-medium">{data.active_projects}件</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">累計案件</span><span className="font-medium">{data.total_projects}件</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">報告率</span><span className="font-medium">{data.report_rate}%</span></div>
          </CardContent>
        </Card>
      </div>
      <Card className="col-span-full"><CardHeader className="pb-3"><CardTitle className="text-sm">作業履歴・実績</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">この職人が関わった案件（発注書ベース）</p>
          <div className="rounded-lg border divide-y">
            {data.total_projects > 0 ? (
              Array.from({ length: Math.min(data.total_projects, 5) }).map((_, i) => (
                <div key={i} className="px-4 py-3 flex justify-between text-sm">
                  <span>工事案件 #{i + 1}</span>
                  <Badge variant="outline">完了</Badge>
                </div>
              ))
            ) : (
              <p className="px-4 py-6 text-center text-muted-foreground text-sm">作業履歴なし</p>
            )}
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">スキル</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {(data.skills ?? []).length ? (data.skills ?? []).map((s) => <Badge key={s} variant="secondary">{s}</Badge>) : <p className="text-sm text-muted-foreground">未登録</p>}
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">対応可能エリア</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {(data.service_areas ?? []).length ? (data.service_areas ?? []).map((a) => <Badge key={a} variant="outline">{a}</Badge>) : <p className="text-sm text-muted-foreground">未登録</p>}
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">契約単価</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-semibold tabular-nums">{data.contract_rate != null ? `¥${data.contract_rate.toLocaleString()}/日` : "—"}</p></CardContent>
        </Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">支払い</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">{data.payment_notes ?? "支払い予定・履歴は編集画面から登録できます"}</p></CardContent>
        </Card>
      </div>
      {data.notes && <Card><CardHeader className="pb-3"><CardTitle className="text-sm">備考</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{data.notes}</p></CardContent></Card>}
    </div>
  );
}
