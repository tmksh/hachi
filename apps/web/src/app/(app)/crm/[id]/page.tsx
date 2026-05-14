"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  ArrowLeft, Pencil, Trash2, Phone, Mail, MapPin,
  Building2, Plus, FileText, Briefcase, HardHat, ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { getCustomer, deleteCustomer, getCustomerRelated } from "@/lib/actions/customers";
import type { Customer } from "@/lib/database.types";

type CustomerDetail = Customer & { assigned_to_profile: { id: string; display_name: string } | null };
type Related = Awaited<ReturnType<typeof getCustomerRelated>>;

const STAGE_LABELS: Record<string, string> = {
  lead: "リード", negotiation: "商談中", proposal: "提案中",
  won: "受注", lost: "失注",
};
const STATUS_LABELS_EST: Record<string, string> = {
  draft: "下書き", sent: "送付済", accepted: "受理", rejected: "却下",
};
const STATUS_LABELS_CON: Record<string, string> = {
  draft: "下書き", active: "有効", completed: "完了", cancelled: "解除",
};
const STATUS_LABELS_CONS: Record<string, string> = {
  preparing: "準備中", in_progress: "施工中", completed: "完了", suspended: "停止", delayed: "遅延",
};

export default function CrmDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<CustomerDetail | null>(null);
  const [related, setRelated] = useState<Related | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getCustomer(id as string),
      getCustomerRelated(id as string),
    ])
      .then(([c, r]) => {
        setData(c as CustomerDetail);
        setRelated(r);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm("この顧客を削除しますか？")) return;
    try { await deleteCustomer(id as string); toast.success("削除しました"); router.push("/crm"); }
    catch { toast.error("削除に失敗しました"); }
  };

  if (loading) return (
    <div className="p-4 md:p-6 space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-4"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
      <Skeleton className="h-64" />
    </div>
  );
  if (!data) return (
    <div className="p-4 md:p-6">
      <Link href="/crm" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
        <ArrowLeft className="h-4 w-4" />戻る
      </Link>
      <p>顧客が見つかりません</p>
    </div>
  );

  const totalDeal = related?.deals.reduce((s, d) => s + (d.value ?? 0), 0) ?? 0;
  const totalEst = related?.estimates.reduce((s, e) => s + (e.total_amount ?? 0), 0) ?? 0;
  const totalCon = related?.contracts.reduce((s, c) => s + (c.amount ?? 0), 0) ?? 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Link href="/crm" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />顧客一覧
      </Link>

      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-xl font-bold text-primary">{data.name.charAt(0)}</span>
          </div>
          <div>
            <h1 className="text-xl font-semibold">{data.name}</h1>
            <p className="text-sm text-muted-foreground">{data.company_name || "個人"}</p>
          </div>
          <Badge variant="secondary">{data.status}</Badge>
        </div>
        <div className="flex gap-2">
          <Link href={`/crm/${id}/edit`}>
            <Button variant="outline" size="sm"><Pencil className="h-4 w-4 mr-1" />編集</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-1" />削除
          </Button>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "商談数", value: related?.deals.length ?? 0, sub: `¥${(totalDeal / 10000).toFixed(0)}万` },
          { label: "見積数", value: related?.estimates.length ?? 0, sub: `¥${(totalEst / 10000).toFixed(0)}万` },
          { label: "契約数", value: related?.contracts.length ?? 0, sub: `¥${(totalCon / 10000).toFixed(0)}万` },
          { label: "工事数", value: related?.constructions.length ?? 0, sub: `進行中 ${related?.constructions.filter(c => c.status === "in_progress").length ?? 0}件` },
        ].map(({ label, value, sub }) => (
          <Card key={label} variant="inset">
            <CardContent className="px-4 py-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold tabular-nums">{value}</p>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 基本情報 + 関連データ */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* 左: 顧客情報 */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">連絡先</CardTitle></CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              {data.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground shrink-0" />{data.phone}</div>}
              {data.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground shrink-0" />{data.email}</div>}
              {data.address && <div className="flex items-start gap-2"><MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /><span>{data.address}</span></div>}
              {data.company_name && <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground shrink-0" />{data.company_name}</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">詳細</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">ソース</span><span>{data.source ?? "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">担当</span><span>{data.assigned_to_profile?.display_name ?? "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">予算</span><span>{data.budget_min || data.budget_max ? `¥${(data.budget_min ?? 0).toLocaleString()}〜` : "-"}</span></div>
              {data.tags?.length > 0 && (
                <div className="flex gap-1 flex-wrap pt-1">
                  {data.tags.map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                </div>
              )}
              {data.notes && <p className="text-muted-foreground pt-2 border-t text-xs">{data.notes}</p>}
            </CardContent>
          </Card>
        </div>

        {/* 右: 関連データタブ */}
        <Tabs defaultValue="deals">
          <TabsList>
            <TabsTrigger value="deals" className="gap-1.5">
              <Briefcase className="h-3.5 w-3.5" />商談 {related?.deals.length ? `(${related.deals.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="estimates" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />見積 {related?.estimates.length ? `(${related.estimates.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="contracts" className="gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" />契約 {related?.contracts.length ? `(${related.contracts.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="constructions" className="gap-1.5">
              <HardHat className="h-3.5 w-3.5" />工事 {related?.constructions.length ? `(${related.constructions.length})` : ""}
            </TabsTrigger>
          </TabsList>

          {/* 商談 */}
          <TabsContent value="deals" className="mt-3">
            <Card variant="inset">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/40">
                <p className="text-xs text-muted-foreground">この顧客に紐づく商談</p>
                <Link href={`/deals?customer_id=${id}`}>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                    <Plus className="h-3 w-3" />商談を追加
                  </Button>
                </Link>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>件名</TableHead><TableHead>ステージ</TableHead>
                  <TableHead className="text-right">金額</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {related?.deals.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground text-sm">商談なし</TableCell></TableRow>
                  ) : related?.deals.map(d => (
                    <TableRow key={d.id} className="glass-row cursor-pointer" onClick={() => router.push(`/deals`)}>
                      <TableCell className="font-medium text-sm">{d.title}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{STAGE_LABELS[d.stage ?? ""] ?? d.stage}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{d.value ? `¥${d.value.toLocaleString()}` : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* 見積 */}
          <TabsContent value="estimates" className="mt-3">
            <Card variant="inset">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/40">
                <p className="text-xs text-muted-foreground">この顧客に紐づく見積</p>
                <Link href={`/quotes/new?customer_id=${id}`}>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                    <Plus className="h-3 w-3" />見積を作成
                  </Button>
                </Link>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>番号</TableHead><TableHead>件名</TableHead>
                  <TableHead>ステータス</TableHead><TableHead className="text-right">金額</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {related?.estimates.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">見積なし</TableCell></TableRow>
                  ) : related?.estimates.map(e => (
                    <TableRow key={e.id} className="glass-row cursor-pointer" onClick={() => router.push(`/quotes/${e.id}`)}>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">{e.estimate_no}</TableCell>
                      <TableCell className="font-medium text-sm">{e.title}</TableCell>
                      <TableCell><StatusBadge status={e.status ?? "draft"} /></TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{e.total_amount ? `¥${e.total_amount.toLocaleString()}` : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* 契約 */}
          <TabsContent value="contracts" className="mt-3">
            <Card variant="inset">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/40">
                <p className="text-xs text-muted-foreground">この顧客に紐づく契約</p>
                <Link href={`/contracts/new?customer_id=${id}`}>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                    <Plus className="h-3 w-3" />契約を追加
                  </Button>
                </Link>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>番号</TableHead><TableHead>件名</TableHead>
                  <TableHead>ステータス</TableHead><TableHead className="text-right">金額</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {related?.contracts.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">契約なし</TableCell></TableRow>
                  ) : related?.contracts.map(c => (
                    <TableRow key={c.id} className="glass-row cursor-pointer" onClick={() => router.push(`/contracts/${c.id}`)}>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">{c.contract_no}</TableCell>
                      <TableCell className="font-medium text-sm">{c.title}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{STATUS_LABELS_CON[c.status ?? ""] ?? c.status}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{c.amount ? `¥${c.amount.toLocaleString()}` : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* 工事 */}
          <TabsContent value="constructions" className="mt-3">
            <Card variant="inset">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/40">
                <p className="text-xs text-muted-foreground">この顧客に紐づく工事</p>
                <Link href={`/constructions/new?customer_id=${id}`}>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                    <Plus className="h-3 w-3" />工事を追加
                  </Button>
                </Link>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>件名</TableHead><TableHead>ステータス</TableHead>
                  <TableHead>開始</TableHead><TableHead className="text-right">進捗</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {related?.constructions.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">工事なし</TableCell></TableRow>
                  ) : related?.constructions.map(c => (
                    <TableRow key={c.id} className="glass-row cursor-pointer" onClick={() => router.push(`/constructions/${c.id}`)}>
                      <TableCell className="font-medium text-sm">{c.title}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{STATUS_LABELS_CONS[c.status ?? ""] ?? c.status}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground tabular-nums">{c.start_date ?? "-"}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{c.progress_pct ?? 0}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
