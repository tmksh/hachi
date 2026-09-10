"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pencil, Trash2, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { CustomerAvatar } from "@/components/shared/customer-avatar";
import { deleteCraftsman } from "@/lib/actions/craftsmen";
import type { Craftsman } from "@/lib/database.types";
import { specialtyLabel } from "@/lib/craftsmen-options";

type CraftsmanDetailClientProps = {
  initialData: Craftsman | null;
};

export function CraftsmanDetailClient({ initialData }: CraftsmanDetailClientProps) {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<Craftsman | null>(initialData);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const isSystem = data?.kind === "system";

  const handleDelete = async () => {
    if (isSystem) { toast.error("システム予約の業者（未登録業者・予備費）は削除できません"); return; }
    if (!confirm("この職人を削除しますか？")) return;
    try { await deleteCraftsman(id as string); toast.success("削除しました"); router.push("/craftsmen"); } catch (e) { toast.error(e instanceof Error ? e.message : "削除に失敗"); }
  };

  if (!data) return <div className="p-4 md:p-8"><Link href="/craftsmen" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"><ArrowLeft className="h-4 w-4" />戻る</Link><p className="mt-4">見つかりません</p></div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Link href="/craftsmen" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />職人一覧</Link>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <CustomerAvatar seed={data.id} name={data.name} size="lg" />
          <div><h1 className="text-2xl font-semibold tracking-tight text-foreground">{data.name}</h1><p className="text-sm text-muted-foreground">{data.company_name || "-"}</p></div>
          {isSystem && <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">システム予約</Badge>}
          {data.specialty && <Badge variant="secondary">{specialtyLabel(data.specialty)}</Badge>}
          {data.rank && <Badge>{data.rank}ランク</Badge>}
        </div>
        <div className="flex gap-2">
          {isSystem ? (
            <span className="text-xs text-muted-foreground self-center">システム予約のため削除・改名できません</span>
          ) : (
            <>
              <Link href={`/craftsmen/${id}/edit`}><Button variant="outline" size="sm"><Pencil className="h-4 w-4 mr-1" />編集</Button></Link>
              <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive"><Trash2 className="h-4 w-4 mr-1" />削除</Button>
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">連絡先</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{data.phone}</div>}
            {data.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{data.email}</div>}
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">請求書</span>
              {data.invoice_channel === "paper"
                ? <Badge className="bg-amber-200 text-amber-950 hover:bg-amber-200">紙発注・自社書式</Badge>
                : <Badge variant="secondary">メール認証（ログイン不要）</Badge>}
            </div>
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
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">資格・保有免許</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {(data.qualifications ?? []).length ? (data.qualifications ?? []).map((q) => <Badge key={q} variant="secondary">{q}</Badge>) : <p className="text-sm text-muted-foreground">未登録</p>}
          </CardContent>
        </Card>
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
        <Card className="lg:col-span-2"><CardHeader className="pb-3"><CardTitle className="text-sm">振込先（全銀）</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">銀行コード</span><span className="font-mono">{data.bank_code || "—"}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">銀行名カナ</span><span>{data.bank_name_kana || data.bank_name || "—"}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">支店コード</span><span className="font-mono">{data.bank_branch_code || "—"}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">支店名カナ</span><span>{data.bank_branch_kana || data.bank_branch || "—"}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">種目 / 口座</span><span>{data.bank_account_type || "普通"} {data.bank_account_number || "—"}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">受取人カナ</span><span>{data.bank_account_kana || "—"}</span></div>
          </CardContent>
        </Card>
      </div>
      {data.notes && <Card><CardHeader className="pb-3"><CardTitle className="text-sm">備考</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{data.notes}</p></CardContent></Card>}
    </div>
  );
}
