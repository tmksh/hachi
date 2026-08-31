"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Receipt, Plus, Loader2, CalendarClock, ExternalLink,
  ArrowLeft, PackageCheck, Trash2, Wand2, FileText, Send,
  CheckCircle2, Undo2, CloudUpload, ChevronDown, ChevronUp, Link2, MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getProcurementMasters, listAccountItemHistory, type AccountItemHistory } from "@/lib/actions/procurement";
import { updateOrderAccountItem } from "@/lib/actions/procurement";
import {
  ORDER_DISPLAY_STATUS_META,
  PROCUREMENT_ACCOUNT_ITEMS,
  deriveOrderDisplayStatus,
  isAccountingRole,
  suggestAccountItem,
  yen,
} from "@/lib/procurement";
import { createInvoiceFromConstruction, generateMonthlyInvoices } from "@/lib/actions/invoices";
import {
  createContractorOrder,
  deleteContractorOrder,
  createOrdersFromEstimate,
  getConstructionEstimate,
} from "@/lib/actions/constructions";
import {
  submitContractorOrder,
  approveContractorOrder,
  rejectContractorOrder,
  sendContractorOrderToCloudSign,
  markContractorOrderAcknowledged,
} from "@/lib/actions/contractor-orders";
import { getOrCreatePartnerOrderLink } from "@/lib/actions/partner-portal";
import { getCraftsmen } from "@/lib/actions/craftsmen";
import { vendorNameMatches } from "@/lib/vendor-normalize";
import { OrderDocumentPreview, type OrderDocKind } from "@/components/constructions/order-document-preview";
import { getProfiles } from "@/lib/actions/profiles";
import { useAuth } from "@/hooks/use-auth";
import type { ContractorOrder, Craftsman, EstimateItem, Profile } from "@/lib/database.types";
import { buildPaymentSchedule, type PaymentScheduleItem } from "@/lib/construction/payment-schedule";

/* ══════════════════════════════════════════════════
   請求書タブ（InvoicesTab）
══════════════════════════════════════════════════ */

type InvoiceRow = {
  id: string;
  invoice_no: string;
  invoice_date: string | null;
  due_date: string | null;
  total: number;
  status: string;
  created_at: string;
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft: { label: "下書き", cls: "bg-gray-100 text-gray-600" },
  sent: { label: "送付済", cls: "bg-blue-100 text-blue-700" },
  paid: { label: "入金済", cls: "bg-green-100 text-green-700" },
  cancelled: { label: "取消", cls: "bg-red-100 text-red-600" },
};

interface Props {
  constructionId: string;
  initialInvoices: InvoiceRow[];
  hasSchedule: boolean;
  closingDayLabel: string;
  onRefresh: () => void;
}

export function InvoicesTab({
  constructionId,
  initialInvoices,
  hasSchedule,
  closingDayLabel,
  onRefresh,
}: Props) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setInvoices(initialInvoices);
  }, [initialInvoices]);

  async function handleCreate() {
    setCreating(true);
    try {
      const inv = await createInvoiceFromConstruction(constructionId);
      toast.success("請求書を作成しました");
      setInvoices(prev => [{
        id: inv.id,
        invoice_no: inv.invoice_no ?? "",
        invoice_date: inv.invoice_date,
        due_date: inv.due_date,
        total: inv.total,
        status: inv.status,
        created_at: inv.created_at,
      }, ...prev]);
      onRefresh();
    } catch {
      toast.error("請求書の作成に失敗しました");
    } finally {
      setCreating(false);
    }
  }

  async function handleGenerateMonthly() {
    setGenerating(true);
    try {
      const created = await generateMonthlyInvoices(constructionId);
      if (created.length === 0) {
        toast.info("新規作成対象の月次請求はありません（既に生成済みの可能性があります）");
      } else {
        toast.success(`${created.length}件の月次請求を生成しました`);
        onRefresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "月次請求の生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">
            工程表と連動した請求管理（締日: {closingDayLabel}）
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {invoices.length} 件の請求書
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleGenerateMonthly}
            disabled={generating || !hasSchedule}
            title={!hasSchedule ? "工期を設定すると月次請求を自動生成できます" : undefined}
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
            月次請求を自動生成
          </Button>
          <Button size="sm" className="gap-1.5 text-xs" onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            請求書を作成
          </Button>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="py-14 text-center text-sm text-muted-foreground rounded-xl border border-dashed border-border">
          <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>請求書がありません</p>
          <p className="text-xs mt-1">「月次請求を自動生成」で工期に応じた請求書を一括作成できます</p>
        </div>
      ) : (
        <Card variant="inset">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground">請求番号</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground">請求日</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground">支払期日</th>
                  <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-muted-foreground">ステータス</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-muted-foreground">金額</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const st = STATUS_MAP[inv.status] ?? STATUS_MAP.draft;
                  return (
                    <tr key={inv.id} className="border-t border-border/40 hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono text-xs">{inv.invoice_no}</td>
                      <td className="px-3 py-3 text-muted-foreground">{inv.invoice_date ?? "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{inv.due_date ?? "—"}</td>
                      <td className="px-3 py-3 text-center">
                        <Badge variant="outline" className={`text-[11px] ${st.cls}`}>{st.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        ¥{(inv.total ?? 0).toLocaleString()}
                      </td>
                      <td className="pr-3 py-3">
                        <Link href={`/invoices/${inv.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   発注書・請書タブ（OrdersTab）
══════════════════════════════════════════════════ */

export type OrderRow = ContractorOrder & {
  craftsman?: { id: string; name: string; company_name?: string | null } | null;
  submitted_comment?: string | null;
  submitted_to?: string | null;
  submitted_by?: string | null;
  submitted_at?: string | null;
};

function craftsmanLabel(c: { name: string; company_name?: string | null }) {
  const company = c.company_name?.trim();
  if (company && company !== c.name) return `${company}（${c.name}）`;
  return company || c.name;
}

const PAYMENT_COUNT_OPTIONS = ["1回", "2回", "3回", "4回", "6回", "12回", "その他"];

const APPROVER_ROLES = ["hq_admin", "admin", "executive", "contractor_admin"] as const;

/** 業者名 → 業者マスタ照合（会社名・表記ゆれを含む） */
function matchCraftsman(name: string, craftsmen: Craftsman[]): Craftsman | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const exact = craftsmen.find((c) =>
    c.name.trim() === trimmed || (c.company_name?.trim() ?? "") === trimmed,
  );
  if (exact) return exact;
  return craftsmen.find((c) =>
    vendorNameMatches(c.name, trimmed, c.bank_account_kana) ||
      (c.company_name ? vendorNameMatches(c.company_name, trimmed, c.bank_account_kana) : false),
  ) ?? null;
}

export function OrdersTab({ constructionId, initialOrders, constructionStartDate, constructionEndDate, estimateId, initialForm }: {
  constructionId: string;
  initialOrders: OrderRow[];
  constructionStartDate?: string | null;
  constructionEndDate?: string | null;
  estimateId?: string | null;
  initialForm?: { title?: string; amount?: string; workContent?: string; accountItem?: string } | null;
}) {
  const { profile, hasRole } = useAuth();
  const canApprove = hasRole(...APPROVER_ROLES);
  const canEditAccount = isAccountingRole(profile?.role) || hasRole("hq_admin", "admin", "administration");

  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const [showCreateForm, setShowCreateForm] = useState(() => !!(initialForm?.title || initialForm?.amount));
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [craftsmen, setCraftsmen] = useState<Craftsman[]>([]);
  const [pdfPreviewOrder, setPdfPreviewOrder] = useState<OrderRow | null>(null);
  const [pdfPreviewKind, setPdfPreviewKind] = useState<OrderDocKind>("order");
  const [estimateItems, setEstimateItems] = useState<EstimateItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [form, setForm] = useState({
    title: initialForm?.title ?? "",
    craftsmanName: initialForm?.title ?? "",
    amount: initialForm?.amount ?? "",
    craftsmanId: "",
    notes: "",
    orderDate: new Date().toISOString().split("T")[0],
    startDate: constructionStartDate ?? "",
    endDate: constructionEndDate ?? "",
    completionDate: constructionEndDate ?? "",
    paymentDate: "",
    paymentCount: "1回",
    workContent: initialForm?.workContent ?? "",
    specialNotes: "",
    department: "",
    accountItem: initialForm?.accountItem ?? "",
    accountItemSource: initialForm?.accountItem ? "budget" : "",
  });
  const [departments, setDepartments] = useState<string[]>([]);
  const [accountItems, setAccountItems] = useState<string[]>(PROCUREMENT_ACCOUNT_ITEMS.map((i) => i.name));
  const [accountHistory, setAccountHistory] = useState<AccountItemHistory[]>([]);
  const [listStatus, setListStatus] = useState("all");
  const [listDept, setListDept] = useState("all");
  const [unsetAccountOnly, setUnsetAccountOnly] = useState(false);
  const [customSchedule, setCustomSchedule] = useState<PaymentScheduleItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // 承認申請ダイアログ
  const [submitTarget, setSubmitTarget] = useState<OrderRow | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [approverId, setApproverId] = useState("");
  const [submitComment, setSubmitComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // 承認 / 差戻し / CloudSign 送信中
  const [actingId, setActingId] = useState<string | null>(null);
  const [cloudSignId, setCloudSignId] = useState<string | null>(null);

  const rebuildSchedule = (amount: string, paymentCount: string, startDate: string, endDate: string) => {
    const amt = Number(amount) || 0;
    if (paymentCount === "1回" || amt === 0) { setCustomSchedule([]); return; }
    const sched = buildPaymentSchedule(amt, paymentCount, startDate || null, endDate || null);
    setCustomSchedule(sched);
  };

  const scheduleTotal = customSchedule.reduce((s, r) => s + r.rate * 100, 0);
  const scheduleValid = customSchedule.length === 0 || Math.abs(scheduleTotal - 100) < 0.1;

  const suggestionPast = accountHistory.length > 0
    ? accountHistory
    : orders.map((o) => ({
        vendorName: o.craftsman?.name,
        companyName: o.craftsman?.company_name,
        accountItem: o.account_item,
        accountItemSource: o.account_item_source,
      }));

  useEffect(() => {
    void listAccountItemHistory().then(setAccountHistory).catch(() => {});
  }, []);

  const loadEstimateItems = async () => {
    if (!estimateId || estimateItems.length > 0) return;
    setLoadingItems(true);
    try {
      const est = await getConstructionEstimate(estimateId);
      setEstimateItems((est.items ?? []) as EstimateItem[]);
    } catch { /* silent */ } finally {
      setLoadingItems(false);
    }
  };

  // CostBudgetTabの「発注」ボタン経由で開いた場合、見積もり項目を自動ロード
  useEffect(() => {
    if (showCreateForm) {
      if (estimateId) void loadEstimateItems();
      if (craftsmen.length === 0) getCraftsmen().then(setCraftsmen).catch(() => {});
      if (departments.length === 0) {
        getProcurementMasters().then((m) => {
          setDepartments(m.departments);
          if (m.accountItems.length) setAccountItems(m.accountItems);
        }).catch(() => {});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreateForm]);

  // 業者マスタ読み込み後、施工業者名（自由入力）と自動照合して craftsman_id をセット
  useEffect(() => {
    if (!showCreateForm || craftsmen.length === 0) return;
    if (form.craftsmanId || !form.craftsmanName.trim()) return;
    const matched = matchCraftsman(form.craftsmanName, craftsmen);
    if (matched) {
      const suggested = suggestAccountItem(matched.company_name || matched.name, suggestionPast);
      setForm(f => ({
        ...f,
        craftsmanId: matched.id,
        craftsmanName: matched.name,
        title: f.title || matched.name,
        accountItem: f.accountItem || suggested.item,
        accountItemSource: f.accountItemSource || suggested.source,
      }));
    } else if (form.craftsmanName) {
      const suggested = suggestAccountItem(form.craftsmanName, suggestionPast);
      setForm(f => ({
        ...f,
        accountItem: f.accountItem || suggested.item,
        accountItemSource: f.accountItemSource || suggested.source,
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [craftsmen, showCreateForm, accountHistory]);

  const craftsmanUnmatched = !form.craftsmanId && form.craftsmanName.trim() !== "";

  const filteredEstimateItems = form.craftsmanName
    ? estimateItems.filter(i => (i.notes ?? "").trim() === form.craftsmanName.trim())
    : estimateItems;
  // 業者名フィルタで0件になる場合はフィルタを外してすべて表示するフォールバック
  const filterFallback = form.craftsmanName.trim() !== "" && filteredEstimateItems.length === 0 && estimateItems.length > 0;
  const displayItems = filterFallback ? estimateItems : filteredEstimateItems;

  const itemsTotal = displayItems.reduce((s, i) => s + (i.selling_amount ?? 0), 0);

  const openCreateForm = () => {
    setForm({
      title: "",
      craftsmanName: "",
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
      department: departments[0] ?? "",
      accountItem: "",
      accountItemSource: "",
    });
    setCustomSchedule([]);
    setShowCreateForm(true);
    if (craftsmen.length === 0) getCraftsmen().then(setCraftsmen).catch(() => {});
    void loadEstimateItems();
  };

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteContractorOrder(id);
      setOrders(prev => prev.filter(o => o.id !== id));
    } catch (e) { console.error(e); } finally { setDeletingId(null); }
  }

  const openSubmitDialog = (order: OrderRow) => {
    setSubmitTarget(order);
    setApproverId("");
    setSubmitComment("");
    if (profiles.length === 0) {
      getProfiles().then(setProfiles).catch(() => toast.error("承認者一覧の取得に失敗しました"));
    }
  };

  const handleSubmitForApproval = async () => {
    if (!submitTarget) return;
    if (!approverId) { toast.error("承認者を選択してください"); return; }
    setSubmitting(true);
    try {
      const updated = await submitContractorOrder({
        orderId: submitTarget.id,
        approverId,
        comment: submitComment,
      });
      setOrders(prev => prev.map(o => o.id === submitTarget.id ? { ...o, ...(updated as OrderRow) } : o));
      setSubmitTarget(null);
      toast.success("承認申請を送信しました", { description: "承認者に通知されます" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "承認申請に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (order: OrderRow) => {
    setActingId(order.id);
    try {
      const updated = await approveContractorOrder(order.id);
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...(updated as OrderRow) } : o));
      toast.success(`「${order.title}」を承認しました`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "承認に失敗しました");
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (order: OrderRow) => {
    setActingId(order.id);
    try {
      const updated = await rejectContractorOrder(order.id);
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...(updated as OrderRow) } : o));
      toast.success(`「${order.title}」を差戻しました`, { description: "申請者に通知されます" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "差戻しに失敗しました");
    } finally {
      setActingId(null);
    }
  };

  const handleCopyPartnerLink = async (order: OrderRow) => {
    const res = await getOrCreatePartnerOrderLink(order.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const url = `${window.location.origin}${res.url}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("協力業者用URLをコピーしました");
    } catch {
      toast.message(url);
    }
  };

  const handleSendCloudSign = async (order: OrderRow) => {
    setCloudSignId(order.id);
    try {
      const result = await sendContractorOrderToCloudSign(order.id);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "CloudSign送信に失敗しました");
    } finally {
      setCloudSignId(null);
    }
  };

  const handleMarkAcknowledged = async (order: OrderRow) => {
    setActingId(order.id);
    try {
      const updated = await markContractorOrderAcknowledged(order.id);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...updated, craftsman: o.craftsman } : o)));
      toast.success("請書を受領済みにしました。納品・検収へ進めます");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "請書の受領記録に失敗しました");
    } finally {
      setActingId(null);
    }
  };

  async function handleImportFromEstimate() {
    if (!estimateId) {
      toast.error("見積もりが紐付いていません");
      return;
    }
    setImporting(true);
    try {
      const created = await createOrdersFromEstimate(constructionId, estimateId);
      setOrders(prev => [...(created as OrderRow[]), ...prev]);
      toast.success(`${created.length}件の発注書を見積から取得しました`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "取得に失敗しました");
    } finally {
      setImporting(false);
    }
  }

  const visibleOrders = orders.filter((o) => {
    const display = deriveOrderDisplayStatus(o);
    if (listStatus !== "all" && display !== listStatus) return false;
    if (listDept !== "all" && (o.department ?? "") !== listDept) return false;
    if (unsetAccountOnly && o.account_item) return false;
    return true;
  });
  const total = visibleOrders.reduce((s, o) => s + o.amount, 0);
  const unsetAccountCount = orders.filter((o) => !o.account_item).length;
  const unsetVendorCount = orders.filter((o) => !o.craftsman?.name).length;

  /* ---- 発注書作成フォーム（フルパネル） ---- */
  if (showCreateForm) {
    const calcAmount = displayItems.length > 0 ? itemsTotal : (Number(form.amount) || 0);

    return (
      <div className="rounded-xl border border-border bg-card">
        {/* ヘッダー */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
          <button
            type="button"
            onClick={() => setShowCreateForm(false)}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="text-base font-semibold">発注書を作成</h2>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(100vh-280px)]">
          {/* Row 1: 発注先業者 | 発注日 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">
                発注先業者
                {craftsmanUnmatched && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">未登録</span>
                )}
              </Label>
              {craftsmanUnmatched ? (
                <div className="space-y-1.5">
                  <div className="h-10 rounded-md border bg-muted/40 px-3 flex items-center text-sm">
                    {form.craftsmanName}
                  </div>
                  <p className="text-[11px] text-orange-600">
                    「{form.craftsmanName}」は業者マスタに登録されていません。表示するだけで、担当者は登録も変更もできません（マスタの管理は管理者・事務）。
                  </p>
                </div>
              ) : (
                <Select
                  value={form.craftsmanId || undefined}
                  onValueChange={v => {
                    const id = v === "__none__" ? "" : v;
                    const picked = craftsmen.find(c => c.id === id);
                    const name = picked ? craftsmanLabel(picked) : "";
                    const suggested = suggestAccountItem(picked?.company_name || picked?.name || name, suggestionPast);
                    setForm(f => ({
                      ...f,
                      craftsmanId: id,
                      craftsmanName: name,
                      title: name || f.title,
                      accountItem: suggested.item,
                      accountItemSource: suggested.source,
                    }));
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="業者を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">指定なし</SelectItem>
                    {craftsmen.map(c => (
                      <SelectItem key={c.id} value={c.id}>{craftsmanLabel(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>発注日</Label>
              <Input type="date" value={form.orderDate} onChange={e => setForm(f => ({ ...f, orderDate: e.target.value }))} />
            </div>
          </div>

          {/* Row 2: 工期 | 完了予定日 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>工期（開始日〜終了日）</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" placeholder="開始日" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                <Input type="date" placeholder="終了日" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>完了予定日</Label>
              <Input type="date" value={form.completionDate} onChange={e => setForm(f => ({ ...f, completionDate: e.target.value }))} />
            </div>
          </div>

          {/* Row 3: 支払予定日 | 支払回数 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>支払予定日</Label>
              <Input type="date" value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>支払回数</Label>
              <Select
                value={form.paymentCount}
                onValueChange={v => {
                  setForm(f => ({ ...f, paymentCount: v }));
                  rebuildSchedule(form.amount, v, form.startDate, form.endDate);
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_COUNT_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>部門</Label>
                <Select
                  value={form.department || undefined}
                  onValueChange={v => setForm(f => ({ ...f, department: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="部門を選択" /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">帳票データの部門別集計に使います。</p>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  勘定科目
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">任意</span>
                </Label>
                <Select
                  value={form.accountItem || undefined}
                  onValueChange={v => setForm(f => ({ ...f, accountItem: v, accountItemSource: "manual" }))}
                >
                  <SelectTrigger>
                    <span className="flex items-center justify-between w-full gap-2">
                      <SelectValue placeholder="未設定（経理が後から確定）" />
                      {form.accountItemSource === "ai" && form.accountItem && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 shrink-0">✦ AIが入れた候補</span>
                      )}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {accountItems.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
              勘定科目は任意です。担当者が空でも作成でき、未設定は経理の「勘定科目の確定」で後からまとめます。帳票データ（全銀）に出す前に未設定があると警告します。
            </div>
          </div>

          {/* 支払スケジュール（複数回） */}
          {customSchedule.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>支払スケジュール</Label>
                <span className={`text-[11px] font-semibold ${scheduleValid ? "text-green-600" : "text-red-500"}`}>
                  合計 {scheduleTotal.toFixed(1)}%{scheduleValid ? " ✓" : " ← 100%にしてください"}
                </span>
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">区分</th>
                      <th className="px-2 py-1.5 text-center font-medium w-20">割合（%）</th>
                      <th className="px-3 py-1.5 text-right font-medium w-28">金額</th>
                      <th className="px-2 py-1.5 text-left font-medium">支払期日</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customSchedule.map((row, idx) => (
                      <tr key={idx} className="border-t border-border/40">
                        <td className="px-3 py-1.5 font-medium">{row.phase}</td>
                        <td className="px-1 py-1">
                          <input
                            type="number" min={0} max={100} step={1}
                            className="w-full text-center text-xs border rounded px-1 py-0.5 bg-background"
                            value={Math.round(row.rate * 1000) / 10}
                            onChange={e => {
                              const pct = Number(e.target.value) || 0;
                              const newRate = pct / 100;
                              const amt = Number(form.amount) || calcAmount;
                              setCustomSchedule(prev => prev.map((r, i) => i === idx ? { ...r, rate: newRate, amount: Math.round(amt * newRate) } : r));
                            }}
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                          ¥{Math.round(calcAmount * row.rate).toLocaleString()}
                        </td>
                        <td className="px-1 py-1">
                          <input
                            type="date"
                            className="w-full text-xs border rounded px-1 py-0.5 bg-background"
                            value={row.due_date ?? ""}
                            onChange={e => setCustomSchedule(prev => prev.map((r, i) => i === idx ? { ...r, due_date: e.target.value || null } : r))}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 明細項目（見積もりより自動取得） */}
          <div className="space-y-1.5">
            <Label>
              明細項目
              <span className="text-[11px] text-muted-foreground font-normal ml-2">（見積もりより自動取得。勘定科目は発注書単位で1つ）</span>
            </Label>
            {loadingItems ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />読み込み中…
              </div>
            ) : displayItems.length > 0 ? (
              <>
                {filterFallback && (
                  <p className="text-[11px] text-amber-600">
                    業者名「{form.craftsmanName}」に一致する明細がないため、すべての明細を表示しています
                  </p>
                )}
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr className="text-xs text-muted-foreground">
                        <th className="px-3 py-2 text-left font-medium">品名</th>
                        <th className="px-3 py-2 text-right font-medium w-16">数量</th>
                        <th className="px-3 py-2 text-center font-medium w-12">単位</th>
                        <th className="px-3 py-2 text-right font-medium w-28">金額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayItems.map(item => (
                        <tr key={item.id} className="border-t border-border/40">
                          <td className="px-3 py-2">{item.name}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                          <td className="px-3 py-2 text-center text-muted-foreground">{item.unit ?? "式"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">¥{(item.selling_amount ?? 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground py-2">
                {estimateId ? "見積もりに明細項目がありません" : "見積もりが紐付いていません"}
              </p>
            )}
          </div>

          {/* 工事内容 */}
          <div className="space-y-1.5">
            <Label>工事内容</Label>
            <Textarea value={form.workContent} onChange={e => setForm(f => ({ ...f, workContent: e.target.value }))}
              placeholder="工事内容を入力" rows={3} />
          </div>

          {/* Row: 金額 | 特記事項 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>金額（税抜）<span className="text-red-500 ml-1">*</span></Label>
              <Input
                type="number" min={0}
                value={form.amount || (displayItems.length > 0 ? String(itemsTotal) : "")}
                onChange={e => {
                  const v = e.target.value;
                  setForm(f => ({ ...f, amount: v }));
                  if (customSchedule.length > 0) {
                    const amt = Number(v) || 0;
                    setCustomSchedule(prev => prev.map(r => ({ ...r, amount: Math.round(amt * r.rate) })));
                  }
                }}
                placeholder={displayItems.length > 0 ? String(itemsTotal) : "1200000"}
              />
              {(() => {
                const amt = Number(form.amount) || (displayItems.length > 0 ? itemsTotal : 0);
                if (!amt) return null;
                return (
                  <p className="text-xs text-muted-foreground">
                    消費税: ¥{Math.round(amt * 0.1).toLocaleString()} / 合計: ¥{Math.round(amt * 1.1).toLocaleString()}
                  </p>
                );
              })()}
            </div>
            <div className="space-y-1.5">
              <Label>特記事項</Label>
              <Textarea value={form.specialNotes} onChange={e => setForm(f => ({ ...f, specialNotes: e.target.value }))}
                placeholder="特記事項を入力" rows={3} />
            </div>
          </div>

          {/* 備考 */}
          <div className="space-y-1.5">
            <Label>備考</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="備考・注意事項" rows={2} />
          </div>
        </div>

        {/* フッター */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={() => setShowCreateForm(false)}>キャンセル</Button>
          <Button
            onClick={async () => {
              const amt = Number(form.amount) || (displayItems.length > 0 ? itemsTotal : 0);
              if (!(form.title || form.craftsmanName).trim() || !amt) {
                toast.error("業者名と金額は必須です");
                return;
              }
              if (!scheduleValid) { toast.error("支払割合の合計が100%になっていません"); return; }
              setSaving(true);
              try {
                const scheduledItems = customSchedule.length > 0
                  ? customSchedule.map(s => ({ ...s, amount: Math.round(amt * s.rate) }))
                  : undefined;
                const created = await createContractorOrder({
                  constructionId,
                  title: form.title || form.craftsmanName,
                  amount: amt,
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
                  department: form.department || undefined,
                  accountItem: form.accountItem || undefined,
                  accountItemSource: form.accountItemSource || undefined,
                  customPaymentSchedule: scheduledItems,
                });
                setOrders(prev => [created as OrderRow, ...prev]);
                setShowCreateForm(false);
                setCustomSchedule([]);
                toast.success("発注書を作成しました");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "作成に失敗しました");
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            作成する
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={listStatus} onValueChange={setListStatus}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="ステータス" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ステータス: すべて</SelectItem>
              {Object.entries(ORDER_DISPLAY_STATUS_META).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={listDept}
            onValueChange={setListDept}
            onOpenChange={(open) => {
              if (open && departments.length === 0) {
                getProcurementMasters().then((m) => setDepartments(m.departments)).catch(() => {});
              }
            }}
          >
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="部門" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">部門: すべて</SelectItem>
              {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={() => setUnsetAccountOnly((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-xs font-medium transition-colors",
              unsetAccountOnly
                ? "bg-amber-50 border-amber-300 text-amber-900"
                : "bg-white border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <span className={cn(
              "h-3.5 w-3.5 rounded-[3px] border flex items-center justify-center",
              unsetAccountOnly ? "bg-amber-500 border-amber-500 text-white" : "border-slate-300 bg-white",
            )}>
              {unsetAccountOnly && <CheckCircle2 className="h-3 w-3" />}
            </span>
            勘定科目が未設定のみ
          </button>
        </div>
        <div className="flex gap-2">
          {estimateId && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleImportFromEstimate} disabled={importing}>
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              見積から一括作成
            </Button>
          )}
          <Button asChild variant="outline" size="sm" className="text-xs">
            <Link href="/fulfillment">納品・検収</Link>
          </Button>
          <Button size="sm" className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={openCreateForm}>
            <Plus className="h-3.5 w-3.5" />発注書を追加
          </Button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="py-14 text-center text-sm text-muted-foreground rounded-xl border border-dashed border-border">
          <PackageCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>発注書・請書がありません</p>
          <p className="text-xs mt-1">「発注書を追加」または工事台帳の「発注」から作成できます</p>
        </div>
      ) : (
        <Card variant="inset">
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-border/70">
              <p className="text-sm font-semibold">発注書・請書</p>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-border/70">
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wider whitespace-nowrap">発注No</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wider">件名（工種・内容）</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wider w-36 whitespace-nowrap">業者名</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wider w-24 whitespace-nowrap">部門</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wider w-32 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      勘定科目
                      <span className="text-[9px] font-semibold px-1 py-px rounded bg-slate-200 text-slate-600">任意</span>
                    </span>
                  </th>
                  <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wider w-28 whitespace-nowrap">発注金額</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wider w-24 whitespace-nowrap">支払予定日</th>
                  <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wider w-20 whitespace-nowrap">ステータス</th>
                  <th className="w-40" />
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((order) => {
                  const display = deriveOrderDisplayStatus(order);
                  const st = ORDER_DISPLAY_STATUS_META[display];
                  const schedule = order.payment_schedule?.length
                    ? order.payment_schedule
                    : buildPaymentSchedule(order.amount, order.payment_count ?? "1回", order.start_date, order.end_date);
                  const isExpanded = expandedId === order.id;
                  const tax = Math.round(order.amount * 0.1);
                  return (
                    <React.Fragment key={order.id}>
                    <tr
                      className="group cursor-pointer border-b border-border/60 hover:bg-slate-50/80"
                      onClick={() => setExpandedId(isExpanded ? null : order.id)}
                      title="クリックで詳細を表示"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-blue-700 whitespace-nowrap">
                        {order.po_no ?? "—"}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium flex items-center gap-1.5">
                          {order.title}
                          {order.work_content ? `（${order.work_content}）` : ""}
                          {isExpanded
                            ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </p>
                        {order.notes && <p className="text-xs text-muted-foreground mt-0.5">{order.notes}</p>}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        {order.craftsman ? craftsmanLabel(order.craftsman) : (
                          <span className="inline-flex items-center text-[11px] font-semibold px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">
                            ⚠️ 業者が未設定
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs">{order.department ?? "—"}</td>
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        {canEditAccount ? (
                          <Select
                            value={order.account_item || "__unset"}
                            onValueChange={async (v) => {
                              const next = v === "__unset" ? null : v;
                              setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, account_item: next, account_item_source: "accounting" } : o));
                              try {
                                await updateOrderAccountItem(order.id, next);
                              } catch {
                                toast.error("勘定科目の更新に失敗しました");
                              }
                            }}
                          >
                            <SelectTrigger className={cn(
                              "h-7 w-auto min-w-[4.5rem] text-[11px] shadow-none",
                              order.account_item
                                ? "border-transparent bg-transparent px-1"
                                : "border-amber-200 bg-amber-50 text-amber-800 font-semibold",
                            )}>
                              <SelectValue placeholder="未設定" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unset">未設定</SelectItem>
                              {accountItems.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : order.account_item ? (
                          <span className="text-xs">{order.account_item}</span>
                        ) : (
                          <span className="inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">未設定</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-semibold whitespace-nowrap">
                        {yen(order.amount)}
                      </td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap">{order.payment_date ? order.payment_date.replaceAll("-", "/") : "—"}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="pr-3 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          {order.status === "draft" && (
                            <button
                              className="text-[10px] font-semibold px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors whitespace-nowrap inline-flex items-center gap-1"
                              onClick={() => openSubmitDialog(order)}
                              title="承認者を選択して申請する"
                            >
                              <Send className="h-3 w-3" />申請する
                            </button>
                          )}
                          {order.status === "submitted" && canApprove && (
                            <>
                              <button
                                className="text-[10px] font-semibold px-2 py-1 rounded bg-green-500 text-white hover:bg-green-600 transition-colors whitespace-nowrap inline-flex items-center gap-1 disabled:opacity-50"
                                onClick={() => handleApprove(order)}
                                disabled={actingId === order.id}
                                title="発注書を承認する"
                              >
                                {actingId === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                承認
                              </button>
                              <button
                                className="text-[10px] font-semibold px-2 py-1 rounded bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors whitespace-nowrap inline-flex items-center gap-1 disabled:opacity-50"
                                onClick={() => handleReject(order)}
                                disabled={actingId === order.id}
                                title="下書きに差戻す"
                              >
                                <Undo2 className="h-3 w-3" />差戻し
                              </button>
                            </>
                          )}
                          {display === "sent" && (
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">署名待ち</span>
                          )}
                          {order.status === "approved" && display !== "sent" && display !== "concluded" && (
                            <button
                              className="text-[10px] font-semibold px-2 py-1 rounded bg-sky-500 text-white hover:bg-sky-600 transition-colors whitespace-nowrap inline-flex items-center gap-1 disabled:opacity-50"
                              onClick={() => handleSendCloudSign(order)}
                              disabled={cloudSignId === order.id}
                              title="CloudSignへ送信"
                            >
                              {cloudSignId === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CloudUpload className="h-3 w-3" />}
                              CloudSign送信
                            </button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="p-1 rounded hover:bg-slate-100 text-slate-500"
                                title="その他の操作"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => void handleCopyPartnerLink(order)}>
                                <Link2 className="h-3.5 w-3.5" />業者URL
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setPdfPreviewKind("order"); setPdfPreviewOrder(order); }}>
                                <FileText className="h-3.5 w-3.5" />発注書を確認
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!order.concluded_at}
                                title={order.concluded_at ? "請書を確認" : "業者の受領後に確認できます"}
                                onClick={() => {
                                  if (!order.concluded_at) return;
                                  setPdfPreviewKind("acknowledgment");
                                  setPdfPreviewOrder(order);
                                }}
                              >
                                <FileText className="h-3.5 w-3.5" />請書を確認
                              </DropdownMenuItem>
                              {order.status === "approved" && !order.concluded_at && (
                                <DropdownMenuItem
                                  disabled={actingId === order.id}
                                  onClick={() => void handleMarkAcknowledged(order)}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />請書を受領済みにする
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="text-red-600"
                                disabled={deletingId === order.id}
                                onClick={() => handleDelete(order.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />削除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-muted/20">
                        <td colSpan={9} className="px-4 py-3">
                          <div className="space-y-3 text-xs">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
                              <div><span className="text-muted-foreground">発注先：</span>{order.craftsman ? craftsmanLabel(order.craftsman) : "指定なし"}</div>
                              <div><span className="text-muted-foreground">発注日：</span>{order.order_date ?? "—"}</div>
                              <div><span className="text-muted-foreground">請書：</span>{order.concluded_at ? `受領済み（${order.concluded_at.slice(0, 10)}）` : "未受領"}</div>
                              <div><span className="text-muted-foreground">工期：</span>{order.start_date ?? "—"} 〜 {order.end_date ?? "—"}</div>
                              <div><span className="text-muted-foreground">完了予定日：</span>{order.completion_date ?? "—"}</div>
                              <div><span className="text-muted-foreground">支払予定日：</span>{order.payment_date ?? "—"}</div>
                              <div><span className="text-muted-foreground">支払回数：</span>{order.payment_count ?? "1回"}</div>
                              <div><span className="text-muted-foreground">金額（税抜）：</span>¥{order.amount.toLocaleString()}</div>
                              <div><span className="text-muted-foreground">合計（税込）：</span>¥{(order.amount + tax).toLocaleString()}</div>
                            </div>
                            {order.work_content && (
                              <div>
                                <p className="text-muted-foreground font-semibold mb-0.5">工事内容（明細）</p>
                                <p className="whitespace-pre-wrap">{order.work_content}</p>
                              </div>
                            )}
                            {schedule.length > 0 && (
                              <div>
                                <p className="text-muted-foreground font-semibold mb-1">支払条件（{order.payment_count ?? "1回"}）</p>
                                <div className="flex flex-wrap gap-2">
                                  {schedule.map((s, i) => (
                                    <span key={`${s.phase}-${i}`} className="text-[11px] bg-white border rounded px-2 py-1 tabular-nums">
                                      {s.phase}: ¥{s.amount.toLocaleString()}
                                      {s.due_date && <span className="text-muted-foreground ml-1">({s.due_date})</span>}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {order.special_notes && (
                              <div>
                                <p className="text-muted-foreground font-semibold mb-0.5">特記事項</p>
                                <p className="whitespace-pre-wrap">{order.special_notes}</p>
                              </div>
                            )}
                            {order.submitted_comment && (
                              <div>
                                <p className="text-muted-foreground font-semibold mb-0.5">申請コメント</p>
                                <p className="whitespace-pre-wrap">{order.submitted_comment}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-slate-50/80">
                  <td colSpan={5} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{visibleOrders.length}件</span>
                      {unsetAccountCount > 0 && (
                        <span className="inline-flex items-center font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                          ⚠️ 勘定科目未確定 {unsetAccountCount}件
                        </span>
                      )}
                      {unsetVendorCount > 0 && (
                        <span className="inline-flex items-center font-semibold px-2 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-200">
                          ⚠️ 業者が未設定 {unsetVendorCount}件
                        </span>
                      )}
                    </div>
                  </td>
                  <td colSpan={4} className="px-4 py-3 text-right whitespace-nowrap">
                    <span className="text-xs text-muted-foreground mr-2">合計発注額</span>
                    <span className="tabular-nums font-bold text-blue-700">{yen(total)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 承認申請ダイアログ */}
      <Dialog open={!!submitTarget} onOpenChange={(o) => { if (!o) setSubmitTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>発注書の承認申請</DialogTitle>
          </DialogHeader>
          {submitTarget && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <p className="font-medium">{submitTarget.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {submitTarget.craftsman?.name ?? "業者指定なし"} / ¥{submitTarget.amount.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>承認者<span className="text-red-500 ml-1">*</span></Label>
                <Select value={approverId || undefined} onValueChange={setApproverId}>
                  <SelectTrigger>
                    <SelectValue placeholder="承認者を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles
                      .filter(p => p.id !== profile?.id)
                      .map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.display_name}{p.role ? `（${p.role === "hq_admin" ? "管理者" : p.position ?? p.role}）` : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>申請コメント</Label>
                <Textarea
                  value={submitComment}
                  onChange={e => setSubmitComment(e.target.value)}
                  placeholder="承認者へのコメントを入力（任意）"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitTarget(null)}>キャンセル</Button>
            <Button onClick={handleSubmitForApproval} disabled={submitting || !approverId}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              申請する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {pdfPreviewOrder && (
        <Dialog open={!!pdfPreviewOrder} onOpenChange={() => setPdfPreviewOrder(null)}>
          <DialogContent className="flex flex-col gap-0 p-0 overflow-hidden max-h-[92vh] w-[min(calc(100%-1.5rem),calc(210mm+4rem))] max-w-[min(calc(100%-1.5rem),calc(210mm+4rem))] sm:max-w-[min(calc(100%-1.5rem),calc(210mm+4rem))]">
            <DialogHeader className="px-5 py-3 bg-slate-100 border-b">
              <DialogTitle>{pdfPreviewKind === "acknowledgment" ? "請書プレビュー" : "発注書プレビュー"}</DialogTitle>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant={pdfPreviewKind === "order" ? "default" : "outline"} className="h-7 text-xs" onClick={() => setPdfPreviewKind("order")}>発注書</Button>
                <Button size="sm" variant={pdfPreviewKind === "acknowledgment" ? "default" : "outline"} className="h-7 text-xs" onClick={() => setPdfPreviewKind("acknowledgment")}>請書</Button>
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto bg-slate-200 py-6 px-4">
              <OrderDocumentPreview
                kind={pdfPreviewKind}
                data={{
                  title: pdfPreviewOrder.title,
                  amount: pdfPreviewOrder.amount,
                  orderDate: pdfPreviewOrder.order_date,
                  acceptedAt: pdfPreviewOrder.concluded_at,
                  startDate: pdfPreviewOrder.start_date,
                  endDate: pdfPreviewOrder.end_date,
                  completionDate: pdfPreviewOrder.completion_date,
                  paymentDate: pdfPreviewOrder.payment_date,
                  paymentCount: pdfPreviewOrder.payment_count,
                  workContent: pdfPreviewOrder.work_content,
                  specialNotes: pdfPreviewOrder.special_notes,
                  craftsmanName: pdfPreviewOrder.craftsman ? craftsmanLabel(pdfPreviewOrder.craftsman) : null,
                  paymentSchedule: (pdfPreviewOrder.payment_schedule && pdfPreviewOrder.payment_schedule.length > 0)
                    ? pdfPreviewOrder.payment_schedule
                    : buildPaymentSchedule(pdfPreviewOrder.amount, pdfPreviewOrder.payment_count ?? "1回", pdfPreviewOrder.start_date, pdfPreviewOrder.end_date),
                }}
              />
            </div>
            <DialogFooter className="px-5 py-3 border-t">
              <Button variant="outline" onClick={() => setPdfPreviewOrder(null)}>閉じる</Button>
              <Button onClick={() => window.print()} variant="outline">
                <FileText className="h-4 w-4 mr-1" />印刷
              </Button>
              {pdfPreviewOrder.status === "draft" && pdfPreviewKind === "order" && (
                <Button
                  onClick={() => {
                    const target = pdfPreviewOrder;
                    setPdfPreviewOrder(null);
                    openSubmitDialog(target);
                  }}
                >
                  申請する
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
