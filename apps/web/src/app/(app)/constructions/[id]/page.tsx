"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  ArrowLeft, Pencil, CheckCircle2, MapPin, CalendarRange,
  Wallet, User2, FileText, FilePlus2,
  PackageCheck, FolderOpen, ExternalLink,
  Plus, Trash2, Loader2, Wand2,
} from "lucide-react";
import {
  getConstruction,
  getConstructionContractDocs,
  createContractorOrder,
  deleteContractorOrder,
  updateContractorOrder,
  seedContractorOrders,
} from "@/lib/actions/constructions";
import { CostBudgetTab } from "@/components/constructions/cost-budget-tab";
import { GanttTab } from "@/components/constructions/gantt-tab";
import { CompletionDialog } from "@/components/constructions/completion-dialog";
import { ContractTab } from "@/components/constructions/contract-tab";
import type { EstimateCategory, EstimateItem } from "@/lib/database.types";

type Detail = Awaited<ReturnType<typeof getConstruction>>;
type Order = Detail["orders"][number] & { craftsman?: { id: string; name: string } | null };

/* ──────────────────────────────────────────────────
   ヘッダー情報カード
────────────────────────────────────────────────── */
function InfoCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <div className="mt-0.5 text-muted-foreground flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value ?? "—"}</p>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────
   見積もりタブ
────────────────────────────────────────────────── */
function EstimateTab({ data }: { data: Detail }) {
  const contract = data.contract as (typeof data.contract & {
    amount?: number; contract_date?: string | null; notes?: string | null; estimate_id?: string | null;
  }) | null;
  const estimate = (data as Detail & { estimate?: (typeof data & {
    estimate_no?: string; title?: string | null; subtotal?: number; tax?: number; total?: number;
    gross_profit?: number; gross_profit_rate?: number; notes?: string | null; status?: string;
    categories?: EstimateCategory[]; items?: EstimateItem[];
  }) | null }).estimate;

  if (!estimate && !contract) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p>見積もりデータがありません</p>
        <p className="text-xs mt-1">契約書に見積もりを紐付けると明細が表示されます</p>
      </div>
    );
  }

  if (!estimate && contract) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              契約情報（見積もり未連携）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">契約番号</span><span className="font-mono">{contract.contract_no}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">契約金額</span><span className="font-semibold">¥{(contract.amount ?? 0).toLocaleString()}</span></div>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground text-center">
          契約書に見積もりを紐付けると、明細金額が自動で表示されます
        </p>
      </div>
    );
  }

  if (!estimate) return null;

  const statusMap: Record<string, string> = {
    draft: "下書き", issued: "発行済", sent: "送付済", accepted: "受注", rejected: "失注",
  };

  // カテゴリ別に明細を整理
  const categories = estimate.categories ?? [];
  const items = estimate.items ?? [];
  const itemsByCategory = categories.map(cat => ({
    category: cat,
    items: items.filter(item => item.category_id === cat.id),
  }));
  const uncategorized = items.filter(item => !item.category_id);

  return (
    <div className="space-y-4">
      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "小計", value: `¥${(estimate.subtotal ?? 0).toLocaleString()}` },
          { label: "消費税（10%）", value: `¥${(estimate.tax ?? 0).toLocaleString()}` },
          { label: "合計金額", value: `¥${(estimate.total ?? 0).toLocaleString()}`, highlight: true },
          { label: "粗利率", value: `${(estimate.gross_profit_rate ?? 0).toFixed(1)}%`, color: (estimate.gross_profit_rate ?? 0) >= 20 ? "text-green-600" : "text-amber-600" },
        ].map(c => (
          <div key={c.label} className={`rounded-xl border p-3 ${c.highlight ? "bg-primary/5 border-primary/20" : "bg-card border-border"}`}>
            <p className="text-[11px] text-muted-foreground">{c.label}</p>
            <p className={`text-base font-bold mt-0.5 tabular-nums ${c.color ?? ""}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* ステータス＋番号 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {estimate.estimate_no}
          </span>
          {estimate.status && (
            <Badge variant="outline" className="text-xs">{statusMap[estimate.status] ?? estimate.status}</Badge>
          )}
        </div>
        <Link href={`/quotes`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <ExternalLink className="h-4 w-4" />見積一覧を開く
          </Button>
        </Link>
      </div>

      {/* 明細テーブル */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-muted/60">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">工種・品名</th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground w-16">数量</th>
              <th className="text-left px-2 py-2.5 text-xs font-semibold text-muted-foreground w-12">単位</th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground w-28">単価</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground w-28">金額</th>
            </tr>
          </thead>
          <tbody>
            {itemsByCategory.map(({ category, items: catItems }) => (
              <>
                <tr key={category.id} className="bg-muted/30">
                  <td colSpan={5} className="px-4 py-1.5 text-xs font-semibold text-slate-600">{category.name}</td>
                </tr>
                {catItems.map(item => (
                  <tr key={item.id} className="border-t border-border/40 hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <p className="text-sm">{item.name}</p>
                      {item.specification && <p className="text-xs text-muted-foreground">{item.specification}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-sm">{item.quantity}</td>
                    <td className="px-2 py-2.5 text-xs text-muted-foreground">{item.unit ?? ""}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-sm">¥{item.selling_price.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-sm font-medium">¥{item.selling_amount.toLocaleString()}</td>
                  </tr>
                ))}
              </>
            ))}
            {uncategorized.map(item => (
              <tr key={item.id} className="border-t border-border/40 hover:bg-muted/20">
                <td className="px-4 py-2.5">
                  <p className="text-sm">{item.name}</p>
                  {item.specification && <p className="text-xs text-muted-foreground">{item.specification}</p>}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-sm">{item.quantity}</td>
                <td className="px-2 py-2.5 text-xs text-muted-foreground">{item.unit ?? ""}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-sm">¥{item.selling_price.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-sm font-medium">¥{item.selling_amount.toLocaleString()}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={5} className="py-10 text-center text-sm text-muted-foreground">明細がありません</td></tr>
            )}
          </tbody>
          <tfoot className="bg-muted/40 border-t-2 border-border">
            <tr>
              <td colSpan={4} className="px-4 py-2.5 text-sm font-semibold text-right">小計</td>
              <td className="px-4 py-2.5 text-right tabular-nums font-semibold">¥{(estimate.subtotal ?? 0).toLocaleString()}</td>
            </tr>
            <tr>
              <td colSpan={4} className="px-4 py-1.5 text-xs text-right text-muted-foreground">消費税（10%）</td>
              <td className="px-4 py-1.5 text-right tabular-nums text-xs text-muted-foreground">¥{(estimate.tax ?? 0).toLocaleString()}</td>
            </tr>
            <tr className="bg-primary/5">
              <td colSpan={4} className="px-4 py-2.5 text-sm font-bold text-right">合計</td>
              <td className="px-4 py-2.5 text-right tabular-nums font-bold text-base">¥{(estimate.total ?? 0).toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────
   追加変更タブ
────────────────────────────────────────────────── */
function ChangeOrderTab() {
  return (
    <div className="py-16 text-center text-sm text-muted-foreground">
      <FilePlus2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
      <p>追加・変更工事の記録</p>
      <p className="text-xs mt-1">追加変更管理機能は今後実装予定です</p>
    </div>
  );
}

/* ──────────────────────────────────────────────────
   発注書・請書タブ
────────────────────────────────────────────────── */
const ORDER_STATUS_MAP = {
  draft:     { label: "下書き",   cls: "bg-gray-100 text-gray-600" },
  submitted: { label: "提出済み", cls: "bg-blue-100 text-blue-700" },
  approved:  { label: "承認済み", cls: "bg-green-100 text-green-700" },
  rejected:  { label: "差戻し",   cls: "bg-red-100 text-red-600" },
} as const;

function OrdersTab({ constructionId, initialOrders }: { constructionId: string; initialOrders: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [dialog, setDialog] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", amount: "", craftsmanId: "", notes: "", status: "draft" });
  const [saving, setSaving] = useState(false);

  async function handleSeed() {
    setSeeding(true);
    try {
      const created = await seedContractorOrders(constructionId);
      setOrders(prev => [...(created as Order[]), ...prev]);
    } catch (e) { console.error(e); } finally { setSeeding(false); }
  }

  async function handleAdd() {
    if (!form.title.trim() || !form.amount) return;
    setSaving(true);
    try {
      const created = await createContractorOrder({
        constructionId,
        title: form.title,
        amount: Number(form.amount),
        craftsmanId: form.craftsmanId || undefined,
        notes: form.notes || undefined,
      });
      setOrders(prev => [created as Order, ...prev]);
      setDialog(false);
      setForm({ title: "", amount: "", craftsmanId: "", notes: "", status: "draft" });
    } catch (e) { console.error(e); } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteContractorOrder(id);
      setOrders(prev => prev.filter(o => o.id !== id));
    } catch (e) { console.error(e); } finally { setDeletingId(null); }
  }

  async function handleStatusChange(id: string, status: "draft" | "submitted" | "approved" | "rejected") {
    await updateContractorOrder(id, { status }).catch(console.error);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
  }

  const total = orders.reduce((s, o) => s + o.amount, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{orders.length} 件</p>
        <div className="flex gap-2">
          {orders.length === 0 && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleSeed} disabled={seeding}>
              {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              サンプルデータを追加
            </Button>
          )}
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setDialog(true)}>
            <Plus className="h-3.5 w-3.5" />発注書を追加
          </Button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="py-14 text-center text-sm text-muted-foreground rounded-xl border border-dashed border-border">
          <PackageCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>発注書・請書がありません</p>
          <p className="text-xs mt-1">「サンプルデータを追加」で3件の仮データを挿入できます</p>
        </div>
      ) : (
        <Card variant="inset">
          <CardContent className="p-0">
            <div className="px-2 pb-2 pt-0.5">
            <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: "0 4px" }}>
              <thead>
                <tr>
                  <th className="text-left px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">件名</th>
                  <th className="text-left px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-28">業者</th>
                  <th className="text-center px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-24">ステータス</th>
                  <th className="text-right px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-28">発注金額</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const st = ORDER_STATUS_MAP[order.status as keyof typeof ORDER_STATUS_MAP] ?? ORDER_STATUS_MAP.draft;
                  return (
                    <tr key={order.id} className="glass-row group cursor-default">
                      <td className="px-4 py-3 rounded-l-[10px]">
                        <p className="font-medium">{order.title}</p>
                        {order.notes && <p className="text-xs text-muted-foreground mt-0.5">{order.notes}</p>}
                      </td>
                      <td className="px-3 py-3 text-sm text-muted-foreground">
                        {order.craftsman?.name ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Select
                          value={order.status}
                          onValueChange={(v) => handleStatusChange(order.id, v as "draft" | "submitted" | "approved" | "rejected")}
                        >
                          <SelectTrigger className="h-6 text-[11px] font-semibold px-2 border-0 shadow-none">
                            <span className={`px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ORDER_STATUS_MAP).map(([val, { label }]) => (
                              <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        ¥{order.amount.toLocaleString()}
                      </td>
                      <td className="pr-2 py-3 rounded-r-[10px]">
                        <button
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500 transition-all"
                          onClick={() => handleDelete(order.id)}
                          disabled={deletingId === order.id}
                        >
                          {deletingId === order.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="px-4 pt-1 pb-3 text-sm font-semibold text-right text-muted-foreground">合計発注額</td>
                  <td className="px-4 pt-1 pb-3 text-right tabular-nums font-bold">¥{total.toLocaleString()}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 発注書追加ダイアログ */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>発注書を追加</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>件名 <span className="text-red-500">*</span></Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="例: 基礎工事 下請発注" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>発注金額（円） <span className="text-red-500">*</span></Label>
              <Input type="number" min={0} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="1200000" />
            </div>
            <div className="space-y-1.5">
              <Label>備考</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="備考・注意事項" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>キャンセル</Button>
            <Button onClick={handleAdd} disabled={saving || !form.title.trim() || !form.amount}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              追加する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ──────────────────────────────────────────────────
   ドキュメント一覧タブ
────────────────────────────────────────────────── */
function DocumentsTab() {
  return (
    <div className="py-16 text-center text-sm text-muted-foreground">
      <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
      <p>工事関連書類</p>
      <p className="text-xs mt-1">設計図・仕様書・写真などを登録できます（実装予定）</p>
    </div>
  );
}

/* ──────────────────────────────────────────────────
   メインページ
────────────────────────────────────────────────── */
type ContractDoc = Awaited<ReturnType<typeof getConstructionContractDocs>>[number];

export default function ConstructionDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<Detail | null>(null);
  const [docs, setDocs] = useState<ContractDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [completeOpen, setCompleteOpen] = useState(false);

  const reload = () => {
    if (id) getConstruction(id as string).then(setData).catch(() => {});
  };

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getConstruction(id as string).catch(() => null),
      getConstructionContractDocs(id as string).catch(() => []),
    ]).then(([d, docsList]) => {
      setData(d);
      setDocs(docsList);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="p-4 md:p-6 space-y-4">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-20" />
      <Skeleton className="h-64" />
    </div>
  );
  if (!data) return (
    <div className="p-4 md:p-6">
      <Link href="/constructions" className="text-sm text-muted-foreground flex items-center gap-1"><ArrowLeft className="h-4 w-4" />戻る</Link>
      <p className="mt-4">見つかりません</p>
    </div>
  );

  const isCompletable = data.status !== "completed" && data.status !== "cancelled";
  const customer = data.customer as (typeof data.customer & { address?: string | null }) | null;
  const contract = data.contract as (typeof data.contract & {
    amount?: number; contract_date?: string | null; start_date?: string | null;
    end_date?: string | null; notes?: string | null; status?: string; estimate_id?: string | null;
  }) | null;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <Link href="/constructions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />工事一覧
      </Link>

      {/* ── ヘッダー ── */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{data.construction_no}</span>
              <StatusBadge status={data.status} />
              {customer && <Badge variant="outline" className="text-xs">{customer.name}</Badge>}
            </div>
            <h1 className="text-xl font-semibold mt-1.5">{data.title}</h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isCompletable && (
              <Button size="sm" variant="outline" className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50" onClick={() => setCompleteOpen(true)}>
                <CheckCircle2 className="h-4 w-4" />完了にする
              </Button>
            )}
            <Link href={`/constructions/${id}/edit`}>
              <Button variant="outline" size="sm"><Pencil className="h-4 w-4 mr-1" />編集</Button>
            </Link>
          </div>
        </div>

        {/* 4カラム情報 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 rounded-xl border border-border bg-card p-4">
          <InfoCell icon={<MapPin className="h-4 w-4" />} label="工事場所" value={customer?.address ?? "未設定"} />
          <InfoCell
            icon={<CalendarRange className="h-4 w-4" />}
            label="工期"
            value={data.start_date && data.end_date ? `${data.start_date} 〜 ${data.end_date}` : data.start_date ?? data.end_date ?? "未設定"}
          />
          <InfoCell
            icon={<Wallet className="h-4 w-4" />}
            label="予算 / 実績"
            value={<span>¥{(data.budget_cost ?? 0).toLocaleString()} <span className="text-muted-foreground text-xs">/ ¥{(data.actual_cost ?? 0).toLocaleString()}</span></span>}
          />
          <InfoCell icon={<User2 className="h-4 w-4" />} label="プロジェクト担当者" value={data.assignee?.display_name ?? "未設定"} />
        </div>

        {/* 進捗 */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">進捗</span>
          <div className="flex-1">
            <Progress value={data.progress ?? 0} className="h-2.5 rounded-full bg-slate-200/80" />
          </div>
          <span className={cn(
            "text-sm font-semibold tabular-nums w-10 text-right",
            (data.progress ?? 0) === 0 ? "text-muted-foreground/60" :
            (data.progress ?? 0) >= 100 ? "text-emerald-600" :
            (data.progress ?? 0) >= 50  ? "text-blue-600" :
            "text-amber-600"
          )}>
            {data.progress ?? 0}%
          </span>
        </div>
      </div>

      {/* ── タブ ── */}
      <Tabs defaultValue="schedule">
        <TabsList className="flex w-full overflow-x-auto h-auto flex-wrap gap-0.5">
          <TabsTrigger value="schedule"  className="text-xs">工程表</TabsTrigger>
          <TabsTrigger value="estimate"  className="text-xs">見積もり</TabsTrigger>
          <TabsTrigger value="contract"  className="text-xs">契約書</TabsTrigger>
          <TabsTrigger value="change"    className="text-xs">追加変更</TabsTrigger>
          <TabsTrigger value="budget"    className="text-xs">工事台帳</TabsTrigger>
          <TabsTrigger value="orders"    className="text-xs">発注書・請書</TabsTrigger>
          <TabsTrigger value="documents" className="text-xs">ドキュメント一覧</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="mt-4">
          <GanttTab
            constructionId={id as string}
            initialTasks={(data.tasks ?? []) as { id: string; name: string; start_date: string | null; end_date: string | null; progress: number; status: string }[]}
          />
        </TabsContent>

        <TabsContent value="estimate" className="mt-4">
          <EstimateTab data={{ ...data, contract }} />
        </TabsContent>

        <TabsContent value="contract" className="mt-4">
          <ContractTab
            constructionId={id as string}
            initialDocs={docs}
            ctx={{
              construction: {
                title: data.title,
                start_date: data.start_date,
                end_date: data.end_date,
                order_amount: data.order_amount ?? 0,
              },
              customer: customer ? { name: customer.name, address: customer.address ?? null } : null,
            }}
          />
        </TabsContent>

        <TabsContent value="change" className="mt-4">
          <ChangeOrderTab />
        </TabsContent>

        <TabsContent value="budget" className="mt-4">
          <CostBudgetTab
            constructionId={id as string}
            contractAmount={contract?.amount ?? data.order_amount ?? undefined}
          />
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <OrdersTab
            constructionId={id as string}
            initialOrders={data.orders as Order[]}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <DocumentsTab />
        </TabsContent>
      </Tabs>

      {completeOpen && (
        <CompletionDialog
          open={completeOpen}
          onOpenChange={setCompleteOpen}
          construction={{
            id: data.id,
            title: data.title,
            order_amount: data.order_amount,
            actual_cost: data.actual_cost,
            customer: data.customer,
          }}
          onCompleted={reload}
        />
      )}
    </div>
  );
}
