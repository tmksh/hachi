"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
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
  ArrowLeft, MapPin, CalendarRange,
  Wallet, User2, FileText, Users,
  PackageCheck, CheckCircle2,
  Plus, Trash2, Loader2, Wand2,
  CalendarDays, ScrollText, PencilLine, BookOpen, FolderOpen, Receipt,
} from "lucide-react";
import {
  getConstruction,
  getConstructionContractDocs,
  createContractorOrder,
  deleteContractorOrder,
  updateContractorOrder,
  seedContractorOrders,
} from "@/lib/actions/constructions";
import { getCraftsmen } from "@/lib/actions/craftsmen";
import type { Craftsman } from "@/lib/database.types";
import { CostBudgetTab } from "@/components/constructions/cost-budget-tab";
import { GanttTab } from "@/components/constructions/gantt-tab";
import { ContractTab } from "@/components/constructions/contract-tab";
import { ChangeOrderTab } from "@/components/constructions/change-order-tab";
import { InvoicesTab } from "@/components/constructions/invoices-tab";
import { CompletionDialog } from "@/components/constructions/completion-dialog";
import { CustomerInfoPanel } from "@/components/crm/customer-info-panel";
import { CustomerFilesTab, CUSTOMER_DOCUMENTS_DESCRIPTION } from "@/components/crm/customer-files-tab";
import { CustomerAvatar } from "@/components/shared/customer-avatar";
import { EstimateDetailView, type EstimateForView } from "@/components/estimate/estimate-detail-view";
import { EstimateListView, type EstimateListItem } from "@/components/estimate/estimate-list-view";
import { CreateEstimateDialog } from "@/components/estimate/create-estimate-dialog";
import { useAuth } from "@/hooks/use-auth";
import type { EstimateCategory, EstimateItem } from "@/lib/database.types";
import {
  getConstructionEstimate,
  createOrdersFromEstimate,
  seedConstructionEstimates,
  createEmptyEstimateForConstruction,
  copyEstimateForConstruction,
} from "@/lib/actions/constructions";
import { getChangeOrders } from "@/lib/actions/change-orders";
import { getInvoicesForConstruction } from "@/lib/actions/invoices";
import { buildPaymentSchedule } from "@/lib/construction/payment-schedule";

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
   見積もりタブ - 空状態モック（プロトタイプ表示）
────────────────────────────────────────────────── */
function EstimateEmptyMock({ constructionId }: { constructionId: string }) {
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const created = await seedConstructionEstimates(constructionId);
      toast.success(`サンプル見積 ${created.length} 件を作成しました`);
      window.location.reload();
    } catch (e) {
      toast.error(`サンプル作成に失敗: ${e instanceof Error ? e.message : "不明なエラー"}`);
      setSeeding(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
      <FileText className="h-12 w-12 text-muted-foreground/40" />
      <div>
        <p className="text-base font-semibold">見積もりデータがありません</p>
        <p className="text-sm text-muted-foreground mt-1">サンプルデータを投入して機能を確認できます</p>
      </div>
      <Button size="sm" className="gap-1.5" disabled={seeding} onClick={() => void handleSeed()}>
        {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        {seeding ? "作成中..." : "サンプル見積を5件作成"}
      </Button>
      <p className="text-[11px] text-muted-foreground max-w-md">
        ※ 初回提案・変更見積・追加工事・最終提案・追加変更の5バージョンを、明細・カテゴリ込みで生成します。
      </p>
    </div>
  );
}

/* ──────────────────────────────────────────────────
   見積もりタブ
────────────────────────────────────────────────── */

function EstimateTab({ data, constructionId, onEstimateChange, onRefresh, initialSelectedId }: {
  data: Detail;
  constructionId: string;
  onEstimateChange: (est: Detail["estimate"]) => void;
  onRefresh?: () => void;
  initialSelectedId?: string | null;
}) {
  const contract = data.contract as (typeof data.contract & {
    amount?: number; contract_date?: string | null; notes?: string | null; estimate_id?: string | null;
  }) | null;
  const estimate = (data as Detail & { estimate?: (typeof data & {
    id?: string;
    estimate_no?: string; title?: string | null; subtotal?: number; tax?: number; total?: number;
    gross_profit?: number; gross_profit_rate?: number; notes?: string | null; status?: string;
    categories?: EstimateCategory[]; items?: EstimateItem[];
    reserve_fee_1_rate?: number; reserve_fee_2_rate?: number;
  }) | null }).estimate;

  const estimateList = ((data as Detail & { estimates?: EstimateListItem[] }).estimates ?? []) as EstimateListItem[];

  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const openedEstimateRef = useRef<string | null>(null);

  async function handleSelectEstimate(id: string) {
    setSelectedId(id);
    setLoadingEstimate(true);
    try {
      const est = await getConstructionEstimate(id);
      onEstimateChange(est as Detail["estimate"]);
    } catch { toast.error("見積もりの読み込みに失敗しました"); }
    finally { setLoadingEstimate(false); }
  }

  useEffect(() => {
    if (!initialSelectedId || openedEstimateRef.current === initialSelectedId) return;
    openedEstimateRef.current = initialSelectedId;
    void handleSelectEstimate(initialSelectedId);
  }, [initialSelectedId]);

  async function handleEstimateCreated(estimateId: string) {
    setCreateOpen(false);
    setLoadingEstimate(true);
    try {
      const est = await getConstructionEstimate(estimateId);
      onEstimateChange(est as Detail["estimate"]);
      setSelectedId(estimateId);
      onRefresh?.();
      toast.success("見積を作成しました");
    } catch {
      toast.error("見積の読み込みに失敗しました");
    } finally {
      setLoadingEstimate(false);
    }
  }

  // 詳細モード（作成直後もここへ遷移）
  if (selectedId && estimate?.id === selectedId) {
    return (
      <EstimateDetailView
        estimate={estimate as EstimateForView}
        onBack={() => { setSelectedId(null); }}
        loading={loadingEstimate}
        onEstimateChange={(est) => onEstimateChange(est as Detail["estimate"])}
        pdfCustomer={data.customer ? { name: data.customer.name, company_name: (data.customer as { company_name?: string | null }).company_name } : null}
      />
    );
  }

  // データなし
  if (estimateList.length === 0 && !contract) {
    return (
      <>
        <EstimateEmptyMock constructionId={constructionId} />
        <CreateEstimateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          estimateList={estimateList}
          onCreate={async ({ title, author, sourceId }) => {
            if (sourceId) {
              return copyEstimateForConstruction(constructionId, sourceId, title, author);
            }
            return createEmptyEstimateForConstruction(constructionId, title, author);
          }}
          onCreated={(id) => void handleEstimateCreated(id)}
        />
      </>
    );
  }

  // 契約のみ
  if (estimateList.length === 0 && contract) {
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

  // 一覧モード
  return (
    <>
      <EstimateListView
        estimateList={estimateList}
        loadingEstimate={loadingEstimate}
        loading={false}
        onSelectEstimate={handleSelectEstimate}
        onOpenCreate={() => setCreateOpen(true)}
        title="見積一覧"
        description="この工事に関連する見積を管理"
        showCustomer={false}
        showConstruction={false}
        hideCreate={false}
      />

      <CreateEstimateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        estimateList={estimateList}
        onCreate={async ({ title, author, sourceId }) => {
          if (sourceId) {
            return copyEstimateForConstruction(constructionId, sourceId, title, author);
          }
          return createEmptyEstimateForConstruction(constructionId, title, author);
        }}
        onCreated={(id) => void handleEstimateCreated(id)}
      />
    </>
  );
}

/* ──────────────────────────────────────────────────
   発注書タブ
────────────────────────────────────────────────── */
const ORDER_STATUS_MAP = {
  draft:     { label: "下書き",     cls: "bg-gray-100 text-gray-600" },
  submitted: { label: "発注済",     cls: "bg-blue-100 text-blue-700" },
  approved:  { label: "請書受領済", cls: "bg-green-100 text-green-700" },
  rejected:  { label: "差戻し",     cls: "bg-red-100 text-red-600" },
} as const;

const PAYMENT_COUNT_OPTIONS = ["1回", "2回", "3回", "4回", "6回", "12回", "その他"];

function OrdersTab({ constructionId, initialOrders, constructionStartDate, constructionEndDate, estimateId }: {
  constructionId: string;
  initialOrders: Order[];
  constructionStartDate?: string | null;
  constructionEndDate?: string | null;
  estimateId?: string | null;
}) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [dialog, setDialog] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [craftsmen, setCraftsmen] = useState<Craftsman[]>([]);
  const [form, setForm] = useState({
    title: "",
    amount: "",
    craftsmanId: "",
    notes: "",
    orderDate: new Date().toISOString().split("T")[0],
    startDate: constructionStartDate ?? "",
    endDate: constructionEndDate ?? "",
    completionDate: constructionEndDate ?? "",
    paymentDate: "",
    paymentCount: "1回",
    workContent: "",
    specialNotes: "",
  });
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const openDialog = () => {
    setForm(f => ({
      ...f,
      startDate: constructionStartDate ?? "",
      endDate: constructionEndDate ?? "",
      completionDate: constructionEndDate ?? "",
    }));
    setDialog(true);
    if (craftsmen.length === 0) {
      getCraftsmen().then(setCraftsmen).catch(() => {});
    }
  };

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
        orderDate: form.orderDate || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        completionDate: form.completionDate || undefined,
        paymentDate: form.paymentDate || undefined,
        paymentCount: form.paymentCount || undefined,
        workContent: form.workContent || undefined,
        specialNotes: form.specialNotes || undefined,
      });
      setOrders(prev => [created as Order, ...prev]);
      setDialog(false);
      setForm({
        title: "",
        amount: "",
        craftsmanId: "",
        notes: "",
        orderDate: new Date().toISOString().split("T")[0],
        startDate: constructionStartDate ?? "",
        endDate: constructionEndDate ?? "",
        completionDate: constructionEndDate ?? "",
        paymentDate: "",
        paymentCount: "1回",
        workContent: "",
        specialNotes: "",
      });
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
    const prev = orders;
    const target = prev.find(o => o.id === id);
    if (!target || target.status === status) return;
    setOrders(prev.map(o => o.id === id ? { ...o, status } : o));
    try {
      await updateContractorOrder(id, { status });
      toast.success(`ステータスを「${ORDER_STATUS_MAP[status].label}」に変更しました`);
    } catch (e) {
      console.error(e);
      setOrders(prev);
      toast.error("ステータスの更新に失敗しました", {
        description: "権限または通信エラーの可能性があります",
      });
    }
  }

  async function handleImportFromEstimate() {
    if (!estimateId) {
      toast.error("見積もりが紐付いていません");
      return;
    }
    setImporting(true);
    try {
      const created = await createOrdersFromEstimate(constructionId, estimateId);
      setOrders(prev => [...(created as Order[]), ...prev]);
      toast.success(`${created.length}件の発注書を見積から取得しました`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "取得に失敗しました");
    } finally {
      setImporting(false);
    }
  }

  const total = orders.reduce((s, o) => s + o.amount, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{orders.length} 件（見積項目から自動取得・支払回数別配分）</p>
        <div className="flex gap-2">
          {estimateId && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleImportFromEstimate} disabled={importing}>
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              見積から発注書を取得
            </Button>
          )}
          {orders.length === 0 && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleSeed} disabled={seeding}>
              {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              サンプルデータを追加
            </Button>
          )}
          <Button size="sm" className="gap-1.5 text-xs" onClick={openDialog}>
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
                  const schedule = (order as Order & { payment_schedule?: Array<{ phase: string; amount: number; due_date: string | null }> }).payment_schedule
                    ?? buildPaymentSchedule(order.amount, order.payment_count ?? "1回", order.start_date, order.end_date);
                  const isExpanded = expandedId === order.id;
                  return (
                    <>
                    <tr key={order.id} className="glass-row group cursor-default">
                      <td className="px-4 py-3 rounded-l-[10px]">
                        <p className="font-medium">{order.title}</p>
                        {order.notes && <p className="text-xs text-muted-foreground mt-0.5">{order.notes}</p>}
                        {schedule.length > 1 && (
                          <button
                            className="text-[10px] text-blue-600 mt-1 hover:underline"
                            onClick={() => setExpandedId(isExpanded ? null : order.id)}
                          >
                            支払スケジュール ({order.payment_count ?? "1回"})
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-muted-foreground">
                        {order.craftsman?.name ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Select
                          value={order.status}
                          onValueChange={(v) => handleStatusChange(order.id, v as "draft" | "submitted" | "approved" | "rejected")}
                        >
                          <SelectTrigger
                            title="クリックでステータスを変更"
                            className={`h-7 text-[11px] font-semibold pl-2.5 pr-1.5 gap-1 cursor-pointer rounded-full border ${st.cls} hover:brightness-95 hover:shadow-sm transition-all`}
                          >
                            <span>{st.label}</span>
                          </SelectTrigger>
                          <SelectContent align="center">
                            {Object.entries(ORDER_STATUS_MAP).map(([val, { label, cls }]) => (
                              <SelectItem key={val} value={val} className="text-xs">
                                <span className={`px-1.5 py-0.5 rounded-full ${cls}`}>{label}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        ¥{order.amount.toLocaleString()}
                      </td>
                      <td className="pr-2 py-3 rounded-r-[10px]">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-all">
                          {order.status === "submitted" && (
                            <button
                              className="text-[10px] font-semibold px-2 py-1 rounded bg-green-500 text-white hover:bg-green-600 transition-colors whitespace-nowrap"
                              onClick={() => handleStatusChange(order.id, "approved")}
                              title="請書を受領済みにする"
                            >
                              請書受領
                            </button>
                          )}
                          <button
                            className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500 transition-all"
                            onClick={() => handleDelete(order.id)}
                            disabled={deletingId === order.id}
                          >
                            {deletingId === order.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && schedule.length > 0 && (
                      <tr key={`${order.id}-schedule`} className="bg-muted/20">
                        <td colSpan={5} className="px-4 py-2">
                          <div className="flex flex-wrap gap-2">
                            {schedule.map((s: { phase: string; amount: number; due_date: string | null }) => (
                              <span key={s.phase} className="text-[11px] bg-white border rounded px-2 py-1 tabular-nums">
                                {s.phase}: ¥{s.amount.toLocaleString()}
                                {s.due_date && <span className="text-muted-foreground ml-1">({s.due_date})</span>}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                    </>
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
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>発注書を追加</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 space-y-4 py-2 pr-1">
            {/* 件名 */}
            <div className="space-y-1.5">
              <Label>件名 <span className="text-red-500">*</span></Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="例: 基礎工事 下請発注" autoFocus />
            </div>

            {/* 発注先業者 */}
            <div className="space-y-1.5">
              <Label>発注先業者</Label>
              <Select
                value={form.craftsmanId || "__none__"}
                onValueChange={v => setForm(f => ({ ...f, craftsmanId: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger><SelectValue placeholder="業者を選択" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">指定なし</SelectItem>
                  {craftsmen.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 発注日 */}
            <div className="space-y-1.5">
              <Label>発注日</Label>
              <Input type="date" value={form.orderDate} onChange={e => setForm(f => ({ ...f, orderDate: e.target.value }))} />
            </div>

            {/* 工期 */}
            <div className="space-y-1.5">
              <Label>工期（開始日〜終了日）</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>

            {/* 完了予定日 / 支払予定日 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>完了予定日</Label>
                <Input type="date" value={form.completionDate} onChange={e => setForm(f => ({ ...f, completionDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>支払予定日</Label>
                <Input type="date" value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))} />
              </div>
            </div>

            {/* 支払回数 */}
            <div className="space-y-1.5">
              <Label>支払回数</Label>
              <Select value={form.paymentCount} onValueChange={v => setForm(f => ({ ...f, paymentCount: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_COUNT_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* 工事内容 */}
            <div className="space-y-1.5">
              <Label>工事内容</Label>
              <Textarea value={form.workContent} onChange={e => setForm(f => ({ ...f, workContent: e.target.value }))}
                placeholder="発注する工事の内容を記入" rows={3} />
            </div>

            {/* 発注金額 */}
            <div className="space-y-1.5">
              <Label>発注金額（税抜・円） <span className="text-red-500">*</span></Label>
              <Input type="number" min={0} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="1200000" />
              {form.amount && (
                <p className="text-xs text-muted-foreground">
                  消費税（10%）: ¥{Math.round(Number(form.amount) * 0.1).toLocaleString()} &nbsp;／&nbsp;
                  合計: ¥{Math.round(Number(form.amount) * 1.1).toLocaleString()}
                </p>
              )}
            </div>

            {/* 備考 / 特記事項 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>備考</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="備考・注意事項" rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label>特記事項</Label>
                <Textarea value={form.specialNotes} onChange={e => setForm(f => ({ ...f, specialNotes: e.target.value }))}
                  placeholder="特記事項" rows={2} />
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 pt-2">
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
   メインページ
────────────────────────────────────────────────── */
type ContractDoc = Awaited<ReturnType<typeof getConstructionContractDocs>>[number];
type ChangeOrderRow = Awaited<ReturnType<typeof getChangeOrders>>[number];

type InvoiceRow = {
  id: string;
  invoice_no: string;
  invoice_date: string | null;
  due_date: string | null;
  total: number;
  status: string;
  created_at: string;
};

type ConstructionDetailClientProps = {
  initialData: Detail | null;
  initialDocs: ContractDoc[];
  initialChangeOrders: ChangeOrderRow[];
  initialClosingDayLabel: string;
  initialInvoices: InvoiceRow[];
};

function ConstructionDetailPageContent({
  initialData,
  initialDocs,
  initialChangeOrders,
  initialClosingDayLabel,
  initialInvoices,
}: ConstructionDetailClientProps) {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const [data, setData] = useState<Detail | null>(initialData);
  const [docs, setDocs] = useState<ContractDoc[]>(initialDocs);
  const [changeOrders, setChangeOrders] = useState<ChangeOrderRow[]>(initialChangeOrders);
  const [closingDayLabel, setClosingDayLabel] = useState(initialClosingDayLabel);
  const [invoices, setInvoices] = useState<InvoiceRow[]>(initialInvoices);
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") ?? "schedule");
  const [completionOpen, setCompletionOpen] = useState(false);
  const initialEstimateId = searchParams.get("estimateId");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const reload = () => {
    if (!id) return;
    Promise.all([
      getConstruction(id as string).catch(() => null),
      getConstructionContractDocs(id as string).catch(() => []),
      getChangeOrders(id as string).catch(() => []),
      getInvoicesForConstruction(id as string).catch(() => []),
    ]).then(([d, docsList, cos, invs]) => {
      setData(d);
      setDocs(docsList);
      setChangeOrders(cos);
      setInvoices(invs);
    });
  };

  useEffect(() => {
    setData(initialData);
    setDocs(initialDocs);
    setChangeOrders(initialChangeOrders);
    setClosingDayLabel(initialClosingDayLabel);
    setInvoices(initialInvoices);
  }, [initialData, initialDocs, initialChangeOrders, initialClosingDayLabel, initialInvoices]);

  if (!data) return (
    <div className="p-4 md:p-8">
      <Link href="/constructions" className="text-sm text-muted-foreground flex items-center gap-1"><ArrowLeft className="h-4 w-4" />戻る</Link>
      <p className="mt-4">見つかりません</p>
    </div>
  );

  const customer = data.customer as (typeof data.customer & { address?: string | null }) | null;
  const contract = data.contract as (typeof data.contract & {
    amount?: number; contract_date?: string | null; start_date?: string | null;
    end_date?: string | null; notes?: string | null; status?: string; estimate_id?: string | null;
  }) | null;
  const estimate = (data as Detail & { estimate?: { id?: string } | null }).estimate;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Link href="/constructions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />工事一覧
      </Link>

      {/* ── ヘッダー ── */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{data.title}</h1>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
              <span className="font-mono">{data.construction_no}</span>
              {customer && (
                <>
                  <span aria-hidden className="text-border/80">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <CustomerAvatar seed={customer.id} name={customer.name} className="h-6 w-6 text-[10px]" />
                    <Link
                      href={`/crm/${customer.id}`}
                      className="hover:text-foreground hover:underline transition-colors"
                    >
                      {customer.name}
                    </Link>
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={data.status} className="mt-0.5" />
            {data.status !== "completed" && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1 border-green-500 text-green-700 hover:bg-green-50"
                onClick={() => setCompletionOpen(true)}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                完了にする
              </Button>
            )}
          </div>
        </div>
        {completionOpen && data && (
          <CompletionDialog
            open={completionOpen}
            onOpenChange={setCompletionOpen}
            construction={{
              id: data.id,
              title: data.title,
              order_amount: data.order_amount ?? null,
              actual_cost: data.actual_cost ?? null,
              customer: customer ?? null,
            }}
            onCompleted={reload}
          />
        )}

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
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full overflow-x-auto h-auto flex-wrap gap-0.5">
          <TabsTrigger value="customer"  className="text-xs gap-1.5"><Users       className="h-3.5 w-3.5" />顧客情報</TabsTrigger>
          <TabsTrigger value="schedule"  className="text-xs gap-1.5"><CalendarDays className="h-3.5 w-3.5" />工程表</TabsTrigger>
          <TabsTrigger value="estimate"  className="text-xs gap-1.5"><FileText     className="h-3.5 w-3.5" />見積もり</TabsTrigger>
          <TabsTrigger value="contract"  className="text-xs gap-1.5"><ScrollText   className="h-3.5 w-3.5" />契約書</TabsTrigger>
          <TabsTrigger value="change"    className="text-xs gap-1.5"><PencilLine   className="h-3.5 w-3.5" />追加変更</TabsTrigger>
          <TabsTrigger value="budget"    className="text-xs gap-1.5"><BookOpen     className="h-3.5 w-3.5" />工事台帳</TabsTrigger>
          <TabsTrigger value="orders"    className="text-xs gap-1.5"><PackageCheck className="h-3.5 w-3.5" />発注書・請書</TabsTrigger>
          <TabsTrigger value="invoices"  className="text-xs gap-1.5"><Receipt      className="h-3.5 w-3.5" />請求書</TabsTrigger>
          <TabsTrigger value="documents" className="text-xs gap-1.5"><FolderOpen   className="h-3.5 w-3.5" />ドキュメント一覧</TabsTrigger>
        </TabsList>

        <TabsContent value="customer" className="mt-4">
          {customer?.id ? (
            <CustomerInfoPanel
              customerId={customer.id}
              context="construction"
              onSaved={reload}
            />
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">顧客が紐づいていません</p>
          )}
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <div className="flex justify-end mb-2">
            <Link href={`/constructions/${id}/reports/new`}>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />日報を追加
              </Button>
            </Link>
          </div>
          <GanttTab
            constructionId={id as string}
            initialTasks={(data.tasks ?? []) as { id: string; name: string; start_date: string | null; end_date: string | null; progress: number; status: string }[]}
          />
        </TabsContent>

        <TabsContent value="estimate" className="mt-4">
          <EstimateTab
            data={{ ...data, contract }}
            constructionId={id as string}
            onEstimateChange={(est) => setData((prev: Detail | null) => prev ? { ...prev, estimate: est } : prev)}
            onRefresh={reload}
            initialSelectedId={initialEstimateId}
          />
        </TabsContent>

        <TabsContent value="contract" className="mt-4">
          <ContractTab
            constructionId={id as string}
            customerId={customer?.id}
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
          <ChangeOrderTab
            constructionId={id as string}
            initialOrders={changeOrders}
            baseAmount={contract?.amount ?? data.order_amount ?? 0}
            estimateList={((data as Detail & { estimates?: EstimateListItem[] }).estimates ?? []) as EstimateListItem[]}
            constructionInfo={{
              title: data.title,
              constructionNo: data.construction_no,
              customerName: customer?.name ?? null,
              location: customer?.address ?? null,
              assigneeName: (data.assignee as { display_name?: string } | null)?.display_name ?? null,
            }}
            onRefresh={reload}
          />
        </TabsContent>

        <TabsContent value="budget" className="mt-4">
          <CostBudgetTab
            constructionId={id as string}
            contractAmount={contract?.amount ?? data.order_amount ?? undefined}
            initialOrders={data.orders as Order[]}
            initialEstimateItems={(estimate as { items?: EstimateItem[] } | null)?.items?.map(i => ({
              id: i.id,
              name: i.name,
              cost_amount: i.cost_amount,
              selling_amount: i.selling_amount,
              category_id: i.category_id,
            }))}
            periodStart={data.start_date}
            authorName={profile?.display_name ?? "ユーザー"}
            onNavigateToOrders={() => setActiveTab("orders")}
          />
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <OrdersTab
            constructionId={id as string}
            initialOrders={data.orders as Order[]}
            constructionStartDate={data.start_date}
            constructionEndDate={data.end_date}
            estimateId={estimate?.id ?? contract?.estimate_id ?? null}
          />
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <InvoicesTab
            constructionId={id as string}
            initialInvoices={invoices}
            hasSchedule={!!(data.start_date && data.end_date)}
            closingDayLabel={closingDayLabel}
            onRefresh={reload}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          {customer?.id ? (
            <CustomerFilesTab
              customerId={customer.id}
              constructionId={id as string}
              description={CUSTOMER_DOCUMENTS_DESCRIPTION}
            />
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">顧客が紐づいていません</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function ConstructionDetailClient(props: ConstructionDetailClientProps) {
  return (
    <Suspense fallback={<div className="p-4 md:p-6 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-96 w-full rounded-xl" /></div>}>
      <ConstructionDetailPageContent {...props} />
    </Suspense>
  );
}
