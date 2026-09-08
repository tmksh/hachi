"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";
import { fetchProcurementOrders, LIST_STALE_MS, QK } from "@/lib/queries/portal";
import { ArrowUpDown, ChevronDown, ChevronUp, CircleCheck, ClipboardList, FileText, PackageCheck, Paperclip, Receipt } from "lucide-react";
import { buildPaymentSchedule } from "@/lib/construction/payment-schedule";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { IntegerInput } from "@/components/ui/integer-input";
import { useAuth } from "@/hooks/use-auth";
import { useCompanyPermissions } from "@/hooks/use-company-permissions";
import { permissionRoleSlugs } from "@/lib/role-assignment";
import {
  attachStaffInvoicePdf,
  confirmVendorInvoice,
  approveVendorInvoice,
  returnVendorInvoice,
  registerDeliveryAndInspect,
  resendInvoiceUrl,
  uploadDeliveryAttachments,
  getProcurementFileUrl,
  type ProcurementAttachment,
  type ProcurementOrder,
} from "@/lib/actions/procurement";
import { markContractorOrderAcknowledged } from "@/lib/actions/contractor-orders";
import { VendorInvoicePreviewDialog } from "@/components/procurement/vendor-invoice-preview-dialog";
import {
  LEDGER_STATUS_META,
  deriveLedgerStatus,
  formatDateSlash,
  billedExclOf,
  inclOf,
  isPaperInvoice,
  taxOf,
  todayIso,
  yen,
  type LedgerStatus,
} from "@/lib/procurement";

type Props = {
  initialOrders?: ProcurementOrder[];
};

const FLOW: LedgerStatus[] = [
  "ordered", "inspected", "invoice_received", "confirmed", "payment_approved",
];

const STATUS_FILTER: LedgerStatus[] = [
  "ordered", "delivered", "inspected", "invoice_received", "confirmed", "payment_approved",
];

type SortKey = "po" | "project" | "vendor" | "amount" | "due" | "delivery" | "status" | "updated";

function poLabel(o: ProcurementOrder) {
  const base = o.po_no ?? o.id.slice(0, 8);
  return o.lot_no && o.lot_no > 1 ? `${base}-${o.lot_no}` : base;
}

function orderAssignee(o: ProcurementOrder): { id: string; name: string } | null {
  const raw = o.construction?.assignee;
  const a = Array.isArray(raw) ? raw[0] ?? null : raw ?? null;
  if (a?.id) return { id: a.id, name: a.display_name?.trim() || "担当者" };
  return null;
}

function toastInvoiceMail(res: { emailSent?: boolean; emailTo?: string; emailError?: string; invoiceUrl?: string; url?: string }) {
  const path = res.invoiceUrl ?? res.url;
  const url = path ? `${window.location.origin}${path}` : "";
  if (url) {
    try { void navigator.clipboard.writeText(url); } catch { /* ignore */ }
  }
  if (res.emailSent) {
    toast.success("業者へ請求書URLをメール送信しました", { description: res.emailTo ?? url });
    return;
  }
  toast.success(res.emailError ? "納品検収しました。メールは送れなかったためURLをコピーしました" : "業者向けURLをコピーしました", {
    description: res.emailError ? `${res.emailError}\n${url}` : url,
  });
}

async function openProcurementFile(path: string) {
  const res = await getProcurementFileUrl(path);
  if (!res.ok) {
    toast.error(res.error);
    return;
  }
  window.open(res.url, "_blank", "noopener,noreferrer");
}

export function FulfillmentClient({ initialOrders }: Props) {
  const { profile } = useAuth();
  const { canAccess } = useCompanyPermissions();
  const canAccount = profile?.role ? canAccess("fulfillment_approve", permissionRoleSlugs(profile)) : false;
  const queryClient = useQueryClient();
  const { data: orders = [], isPending } = useQuery({
    queryKey: QK.procurementOrders,
    queryFn: fetchProcurementOrders,
    staleTime: LIST_STALE_MS,
    initialData: initialOrders,
    initialDataUpdatedAt: initialOrders ? Date.now() : undefined,
  });
  const setOrders = (updater: ProcurementOrder[] | ((prev: ProcurementOrder[]) => ProcurementOrder[])) => {
    queryClient.setQueryData<ProcurementOrder[]>(QK.procurementOrders, (prev = []) =>
      typeof updater === "function" ? updater(prev) : updater,
    );
  };
  const [project, setProject] = useState("all");
  const [vendor, setVendor] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [status, setStatus] = useState<string>("active");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [deliveryTarget, setDeliveryTarget] = useState<ProcurementOrder | null>(null);
  const [attachTarget, setAttachTarget] = useState<ProcurementOrder | null>(null);
  const [returnTarget, setReturnTarget] = useState<ProcurementOrder | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewTarget, setPreviewTarget] = useState<ProcurementOrder | null>(null);
  const [paperOnly, setPaperOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const listed = useMemo(() => {
    const rows = orders.filter((o) => {
      const ls = deriveLedgerStatus(o);
      if (ls === "none" && o.status !== "approved") return false;
      if (status === "active" && ls === "payment_approved") return false;
      if (status !== "all" && status !== "active" && ls !== status) return false;
      if (project !== "all" && o.construction_id !== project) return false;
      if (vendor !== "all" && (o.craftsman?.name ?? "") !== vendor) return false;
      const assigned = orderAssignee(o);
      if (assignee === "unassigned" && assigned) return false;
      if (assignee !== "all" && assignee !== "unassigned" && assigned?.id !== assignee) return false;
      if (paperOnly && !isPaperInvoice(o.craftsman)) return false;
      const due = o.completion_date ?? o.end_date ?? "";
      if (from && due && due < from) return false;
      if (to && due && due > to) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = (() => {
        if (sortKey === "po") return poLabel(a);
        if (sortKey === "project") return a.construction ? `${a.construction.construction_no} ${a.construction.title}` : "";
        if (sortKey === "vendor") return a.craftsman?.name ?? "";
        if (sortKey === "amount") return inclOf(Number(a.amount ?? 0));
        if (sortKey === "due") return a.completion_date ?? a.end_date ?? "";
        if (sortKey === "delivery") return a.delivery_date ?? "";
        if (sortKey === "status") return deriveLedgerStatus(a);
        return a.updated_at ?? "";
      })();
      const bv = (() => {
        if (sortKey === "po") return poLabel(b);
        if (sortKey === "project") return b.construction ? `${b.construction.construction_no} ${b.construction.title}` : "";
        if (sortKey === "vendor") return b.craftsman?.name ?? "";
        if (sortKey === "amount") return inclOf(Number(b.amount ?? 0));
        if (sortKey === "due") return b.completion_date ?? b.end_date ?? "";
        if (sortKey === "delivery") return b.delivery_date ?? "";
        if (sortKey === "status") return deriveLedgerStatus(b);
        return b.updated_at ?? "";
      })();
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "ja") * dir;
    });
  }, [orders, project, vendor, assignee, status, from, to, paperOnly, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "amount" || key === "updated" ? "desc" : "asc");
    }
  };

  const counts = useMemo(() => {
    const map = Object.fromEntries(
      STATUS_FILTER.map((s) => [s, 0]),
    ) as Record<LedgerStatus, number>;
    for (const o of orders) {
      const ls = deriveLedgerStatus(o);
      if (ls !== "none") map[ls] += 1;
    }
    return map;
  }, [orders]);

  const projects = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of orders) {
      if (o.construction) m.set(o.construction.id, `${o.construction.construction_no} ${o.construction.title}`);
    }
    return [...m.entries()];
  }, [orders]);
  const vendors = useMemo(
    () => [...new Set(orders.map((o) => o.craftsman?.name).filter(Boolean))] as string[],
    [orders],
  );
  const assignees = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of orders) {
      const a = orderAssignee(o);
      if (a) m.set(a.id, a.name);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "ja"));
  }, [orders]);

  const replace = (updated: ProcurementOrder, extra?: ProcurementOrder) => {
    setOrders((prev) => {
      const next = prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o));
      if (extra && !next.some((o) => o.id === extra.id)) next.unshift(extra);
      return next;
    });
  };

  const handleBulkInspect = async () => {
    const targets = listed.filter((o) => selected.includes(o.id) && deriveLedgerStatus(o) === "delivered");
    if (targets.length === 0) {
      toast.error("旧データの検収待ち行を選択してください");
      return;
    }
    for (const t of targets) {
      const res = await registerDeliveryAndInspect({
        orderId: t.id,
        deliveryDate: t.delivery_date || todayIso(),
        content: t.delivery_content || "",
        sendEmail: true,
      });
      if (res.ok) replace(res.order);
    }
    toast.success(`${targets.length}件を納品検収しました`);
    setSelected([]);
  };

  if (isPending && orders.length === 0) {
    return <PageLoadingFallback />;
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="text-xs text-muted-foreground">工事管理 &gt; 発注・納品・検収</div>
      <PageHeader
        title="納品・検収管理"
        description="業者から納品連絡を受けたら自社で納品検収します。紙・PDFは添付して金額を突合し、総務が支払い確定します。"
      >
        <Button asChild variant="outline" size="sm">
          <Link href="/ledger">帳票データ作成 ↗</Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {FLOW.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-xl border px-3 py-2 text-left ${LEDGER_STATUS_META[s].bar} ${status === s ? "ring-2 ring-emerald-500" : ""}`}
          >
            <p className="text-[11px] font-semibold">{LEDGER_STATUS_META[s].label}</p>
            <p className="text-lg font-bold tabular-nums">{counts[s]}</p>
            <p className="text-[10px] opacity-80 leading-snug">{LEDGER_STATUS_META[s].nextActor}</p>
          </button>
        ))}
      </div>
      {counts.delivered > 0 && (
        <button
          type="button"
          onClick={() => setStatus("delivered")}
          className={`w-full rounded-xl border px-3 py-2 text-left ${LEDGER_STATUS_META.delivered.bar} ${status === "delivered" ? "ring-2 ring-emerald-500" : ""}`}
        >
          <p className="text-[11px] font-semibold">{LEDGER_STATUS_META.delivered.label} {counts.delivered}件</p>
          <p className="text-[10px] opacity-80">旧フローの検収待ちです。納品検収へ進めてください。</p>
        </button>
      )}

      <div className="rounded-xl border bg-card p-3">
        <div className="flex flex-wrap items-end gap-3">
          <FilterSelect label="案件" value={project} onChange={setProject} options={[["all", "すべて"], ...projects]} />
          <FilterSelect label="業者" value={vendor} onChange={setVendor} options={[["all", "すべて"], ...vendors.map((v) => [v, v] as [string, string])]} />
          <FilterSelect
            label="担当者"
            value={assignee}
            onChange={setAssignee}
            options={[["all", "すべて"], ["unassigned", "未割り当て"], ...assignees]}
          />
          <FilterSelect
            label="ステータス"
            value={status}
            onChange={setStatus}
            options={[["active", "支払い確定以外"], ["all", "すべて"], ...STATUS_FILTER.map((s) => [s, LEDGER_STATUS_META[s].label] as [string, string])]}
          />
          <div className="space-y-1 min-w-0 flex-[1.4]">
            <Label className="text-xs">納品予定日</Label>
            <div className="flex gap-1">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="flex-1 min-w-0" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="flex-1 min-w-0" />
            </div>
          </div>
          <label className="flex items-center gap-2 pb-2 shrink-0 text-xs cursor-pointer">
            <Checkbox checked={paperOnly} onCheckedChange={(c) => setPaperOnly(c === true)} />
            紙発注のみ
          </label>
          <p className="text-[11px] text-muted-foreground pb-2 shrink-0 whitespace-nowrap">請求書URLの有効期限は30日です。</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[980px]">
          <thead>
            <tr className="bg-slate-50 text-[11px] text-muted-foreground border-b">
              <th className="px-3 py-2.5 w-8" />
              <Th onClick={() => toggleSort("po")}>発注番号</Th>
              <Th onClick={() => toggleSort("project")}>案件</Th>
              <Th onClick={() => toggleSort("vendor")}>業者名</Th>
              <Th onClick={() => toggleSort("amount")} className="text-right">発注金額（税込）</Th>
              <Th onClick={() => toggleSort("due")}>納品予定日</Th>
              <Th onClick={() => toggleSort("delivery")}>納品日（=取引日）</Th>
              <Th onClick={() => toggleSort("status")}>ステータス</Th>
              <Th onClick={() => toggleSort("updated")}>最終更新</Th>
              <th className="px-3 py-2.5 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {listed.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">対象の発注がありません。承認・締結後の発注書がここに並びます。</td></tr>
            ) : listed.map((o) => {
              const ls = deriveLedgerStatus(o);
              const meta = LEDGER_STATUS_META[ls];
              const paper = isPaperInvoice(o.craftsman);
              const isExpanded = expandedId === o.id;
              return (
                <Fragment key={o.id}>
                <tr
                  className={cn(
                    "group/row border-t cursor-pointer transition-colors",
                    paper && !isExpanded && "bg-amber-50/70",
                    isExpanded ? "bg-slate-50" : "hover:bg-slate-50/80",
                  )}
                  onClick={() => setExpandedId(isExpanded ? null : o.id)}
                  title="クリックで詳細を表示"
                >
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.includes(o.id)}
                      onCheckedChange={(c) => setSelected((p) => c === true ? [...p, o.id] : p.filter((id) => id !== o.id))}
                    />
                  </td>
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Link href={`/constructions/${o.construction_id}?tab=orders`} className="text-blue-700 hover:underline font-mono text-xs">
                        {poLabel(o)}
                      </Link>
                      {o.lot_no && o.lot_no > 1 && (
                        <Badge variant="outline" className="text-[10px] font-normal">分納{o.lot_no}</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-start gap-1.5 min-w-0">
                      <div className="min-w-0">
                        {o.construction ? (
                          <>
                            <p className="text-[11px] font-mono text-muted-foreground leading-none">{o.construction.construction_no}</p>
                            <p className="mt-0.5 font-medium leading-snug line-clamp-2">{o.construction.title}</p>
                          </>
                        ) : "—"}
                      </div>
                      {isExpanded
                        ? <ChevronUp className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                        : <ChevronDown className="h-4 w-4 text-slate-300 shrink-0 mt-0.5 group-hover/row:text-slate-500 transition-colors" />}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium">{o.craftsman?.name ?? "—"}</span>
                      {paper && <Badge className="bg-amber-200 text-amber-950 hover:bg-amber-200">紙発注</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums whitespace-nowrap">{yen(inclOf(billedExclOf(o)))}</td>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground whitespace-nowrap">{formatDateSlash(o.completion_date ?? o.end_date)}</td>
                  <td className="px-3 py-2.5 tabular-nums font-medium text-orange-700 whitespace-nowrap">{formatDateSlash(o.delivery_date)}</td>
                  <td className="px-3 py-2.5"><Badge className={cn("font-medium", meta.cls)}>{meta.label}</Badge></td>
                  <td className="px-3 py-2.5 text-xs tabular-nums text-muted-foreground whitespace-nowrap">{formatDateSlash(o.updated_at)}</td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <RowActions
                      order={o}
                      status={ls}
                      canAccount={canAccount}
                      onDelivery={() => setDeliveryTarget(o)}
                      onAttach={() => setAttachTarget(o)}
                      onReturn={() => setReturnTarget(o)}
                      onPreview={() => setPreviewTarget(o)}
                      onDetail={() => setExpandedId(isExpanded ? null : o.id)}
                      onReplace={replace}
                    />
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-slate-50">
                    <td colSpan={10} className="px-3 pb-4 pt-0" onClick={(e) => e.stopPropagation()}>
                      <OrderExpandPanel
                        order={o}
                        status={ls}
                        onPreview={() => setPreviewTarget(o)}
                      />
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap pb-6">
        <p className="text-xs text-muted-foreground">
          納品日は請求書の取引日になり、支払い確定前の請求は帳票データに含まれません。
        </p>
        <Button
          className="bg-emerald-700 hover:bg-emerald-800"
          onClick={handleBulkInspect}
          disabled={counts.delivered === 0}
        >
          選択した旧データ（検収待ち）を一括で納品検収
        </Button>
      </div>

      <DeliveryDialog
        key={deliveryTarget?.id ?? "delivery-closed"}
        order={deliveryTarget}
        inspector={profile?.display_name ?? ""}
        onClose={() => setDeliveryTarget(null)}
        onSaved={(o) => { replace(o); setDeliveryTarget(null); }}
      />
      <AttachInvoiceDialog
        key={attachTarget?.id ?? "attach-closed"}
        order={attachTarget}
        onClose={() => setAttachTarget(null)}
        onSaved={(o) => { replace(o); setAttachTarget(null); }}
      />
      <ReturnInvoiceDialog
        key={returnTarget?.id ?? "return-closed"}
        order={returnTarget}
        onClose={() => setReturnTarget(null)}
        onSaved={(o) => { replace(o); setReturnTarget(null); }}
      />
      <VendorInvoicePreviewDialog
        order={previewTarget}
        onClose={() => setPreviewTarget(null)}
        showResend={previewTarget ? deriveLedgerStatus(previewTarget) === "inspected" : false}
      />
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <div className="space-y-1 min-w-0 flex-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function RowActions({
  order, status, canAccount, onDelivery, onAttach, onReturn, onPreview, onDetail, onReplace,
}: {
  order: ProcurementOrder;
  status: LedgerStatus;
  canAccount: boolean;
  onDelivery: () => void;
  onAttach: () => void;
  onReturn: () => void;
  onPreview: () => void;
  onDetail: () => void;
  onReplace: (o: ProcurementOrder) => void;
}) {
  if (status === "ordered") {
    if (!order.concluded_at) {
      return (
        <div className="inline-flex items-center gap-1">
          <Button size="sm" className="h-7 text-xs" variant="outline" disabled title="請書の受領後に納品できます">
            納品検収
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-sky-600 hover:bg-sky-700"
            onClick={async () => {
              try {
                const updated = await markContractorOrderAcknowledged(order.id);
                onReplace({ ...order, ...updated, craftsman: order.craftsman, construction: order.construction });
                toast.success("請書を受領済みにしました");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "請書の受領記録に失敗しました");
              }
            }}
          >
            請書受領
          </Button>
        </div>
      );
    }
    return <Button size="sm" className="h-7 text-xs bg-teal-600 hover:bg-teal-700" onClick={onDelivery}>納品検収</Button>;
  }
  if (status === "delivered") {
    return <Button size="sm" className="h-7 text-xs bg-teal-600 hover:bg-teal-700" onClick={onDelivery}>納品検収</Button>;
  }
  if (status === "inspected") {
    const paper = isPaperInvoice(order.craftsman);
    const returned = (order.vendor_invoice_remarks ?? "").startsWith("差し戻し:");
    if (paper) {
      return (
        <div className="inline-flex items-center gap-1">
          {returned && <Badge className="bg-red-100 text-red-800">差し戻し</Badge>}
          <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={onAttach}>
            PDF添付
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onDetail}>
            詳細
          </Button>
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-1">
        {returned && <Badge className="bg-red-100 text-red-800">差し戻し</Badge>}
        <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={onPreview}>
          プレビュー
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={async () => {
            const res = await resendInvoiceUrl(order.id);
            if (!res.ok) { toast.error(res.error); return; }
            toastInvoiceMail(res);
          }}
        >
          URLを再送
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onDetail}>
          詳細
        </Button>
      </div>
    );
  }
  if (status === "invoice_received") {
    return (
      <div className="inline-flex items-center gap-1">
        {order.vendor_invoice_pdf_path && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => void openProcurementFile(order.vendor_invoice_pdf_path!)}
          >
            業者PDF
          </Button>
        )}
        {order.vendor_invoice_amount != null && Number(order.vendor_invoice_amount) !== Number(order.amount) && (
          <Badge className="bg-amber-100 text-amber-900">金額差</Badge>
        )}
        {canAccount ? (
          <>
            <Button
              size="sm"
              className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800"
              onClick={async () => {
                try {
                  onReplace(await approveVendorInvoice(order.id));
                  toast.success("支払い確定しました。帳票データの対象になります");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "支払い確定に失敗しました");
                }
              }}
            >
              支払い確定
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onReturn}>
              差し戻し
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
            onClick={async () => {
              try {
                onReplace(await confirmVendorInvoice(order.id));
                toast.success("請求書を確認済みにしました");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "更新に失敗しました");
              }
            }}
          >
            請求書を確認
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onDetail}>
          内容を見る
        </Button>
      </div>
    );
  }
  if (status === "confirmed") {
    return (
      <div className="inline-flex items-center gap-1">
        {canAccount ? (
          <>
            <Button
              size="sm"
              className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800"
              onClick={async () => {
                try {
                  onReplace(await approveVendorInvoice(order.id));
                  toast.success("支払い確定しました。帳票データの対象になります");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "支払い確定に失敗しました");
                }
              }}
            >
              支払い確定
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onReturn}>
              差し戻し
            </Button>
          </>
        ) : (
          <span className="text-[11px] text-muted-foreground">総務の支払い確定待ち</span>
        )}
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onDetail}>
          内容を見る
        </Button>
      </div>
    );
  }
  if (status === "payment_approved") {
    return (
      <div className="inline-flex items-center gap-1">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onDetail}>
          内容を見る
        </Button>
        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
          <Link href="/ledger">帳票データへ ↗</Link>
        </Button>
      </div>
    );
  }
  return null;
}

function Th({ children, onClick, className }: { children: React.ReactNode; onClick: () => void; className?: string }) {
  return (
    <th className={`px-3 py-2.5 text-left font-semibold ${className ?? ""}`}>
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}<ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  );
}

function AttachmentList({ files }: { files: ProcurementAttachment[] }) {
  if (files.length === 0) return null;
  return (
    <ul className="space-y-1">
      {files.map((f) => (
        <li key={f.path}>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"
            onClick={() => void openProcurementFile(f.path)}
          >
            <Paperclip className="h-3 w-3" />
            {f.name}
          </button>
        </li>
      ))}
    </ul>
  );
}

function ExpandFact({
  label, value, emphasis,
}: {
  label: string;
  value: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 break-words leading-snug", emphasis ? "text-sm font-semibold tabular-nums" : "text-sm")}>
        {value || "—"}
      </p>
    </div>
  );
}

function ExpandSection({
  title, icon, children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="p-4 space-y-3 min-w-0">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        {icon}
        {title}
      </p>
      {children}
    </section>
  );
}

const EXPAND_ACCENT: Record<LedgerStatus, string> = {
  none: "border-l-slate-300",
  ordered: "border-l-slate-400",
  delivered: "border-l-orange-400",
  inspected: "border-l-emerald-500",
  invoice_received: "border-l-sky-500",
  confirmed: "border-l-violet-500",
  payment_approved: "border-l-green-600",
};

function OrderExpandPanel({
  order,
  status,
  onPreview,
}: {
  order: ProcurementOrder;
  status: LedgerStatus;
  onPreview: () => void;
}) {
  const paper = isPaperInvoice(order.craftsman);
  const excl = Number(order.amount ?? 0);
  const billed = billedExclOf(order);
  const schedule = order.payment_schedule?.length
    ? order.payment_schedule
    : buildPaymentSchedule(excl, order.payment_count ?? "1回", order.start_date, order.end_date);
  const showDelivery = status !== "ordered";
  const showInspection = status !== "ordered" && status !== "delivered";
  const showInvoice = status === "invoice_received" || status === "confirmed" || status === "payment_approved";
  const pdfName = order.vendor_invoice_pdf_path?.split("/").pop();
  const nextHint = LEDGER_STATUS_META[status].nextActor;
  const ack = order.concluded_at
    ? `受領済み（${formatDateSlash(order.concluded_at)}）`
    : "未受領";
  const inspectLabel =
    order.inspection_result === "pass" ? "合格"
      : order.inspection_result === "reject" ? "差し戻し"
        : "—";
  const returned = (order.vendor_invoice_remarks ?? "").startsWith("差し戻し:");
  const colCount = 1 + (showDelivery || showInspection ? 1 : 0) + (showInvoice ? 1 : 0);

  return (
    <div className={cn("rounded-xl border bg-white shadow-sm overflow-hidden border-l-4", EXPAND_ACCENT[status])}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50/90 border-b">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 min-w-0">
          <div>
            <p className="text-[11px] text-muted-foreground">発注先</p>
            <p className="text-sm font-semibold">{order.craftsman?.name ?? "指定なし"}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">合計（税込）</p>
            <p className="text-sm font-semibold tabular-nums">{yen(inclOf(excl))}</p>
          </div>
          {order.work_content && (
            <div className="min-w-0 max-w-md">
              <p className="text-[11px] text-muted-foreground">工事内容</p>
              <p className="text-sm leading-snug line-clamp-2">{order.work_content}</p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
            order.concluded_at ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900",
          )}>
            請書 {ack}
          </span>
          {nextHint && (
            <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-900">
              次：{nextHint}
            </span>
          )}
          {paper && <Badge className="bg-amber-100 text-amber-950 hover:bg-amber-100">紙発注</Badge>}
        </div>
      </div>

      <div className={cn(
        "grid divide-y md:divide-y-0 md:divide-x",
        colCount >= 3 ? "lg:grid-cols-3" : colCount === 2 ? "md:grid-cols-2" : "grid-cols-1",
      )}>
        <ExpandSection title="発注" icon={<ClipboardList className="h-3.5 w-3.5" />}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <ExpandFact label="発注日" value={formatDateSlash(order.order_date)} />
            <ExpandFact label="支払回数" value={order.payment_count ?? "1回"} />
            <ExpandFact label="工期" value={`${formatDateSlash(order.start_date)} 〜 ${formatDateSlash(order.end_date)}`} />
            <ExpandFact label="完了予定日" value={formatDateSlash(order.completion_date)} />
            <ExpandFact label="支払予定日" value={formatDateSlash(order.payment_date)} />
            <ExpandFact label="金額（税抜）" value={yen(excl)} emphasis />
          </div>
          {schedule.length > 0 && (
            <div className="rounded-lg border bg-slate-50/80 overflow-hidden">
              <p className="px-3 py-1.5 text-[11px] text-muted-foreground border-b bg-white">支払条件</p>
              <table className="w-full text-xs">
                <tbody>
                  {schedule.map((s, i) => (
                    <tr key={`${s.phase}-${i}`} className="border-t border-border/60 first:border-t-0">
                      <td className="px-3 py-1.5 w-8 text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="py-1.5 font-medium">{s.phase}</td>
                      <td className="py-1.5 text-right tabular-nums font-medium">{yen(s.amount)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                        {formatDateSlash(s.due_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {order.special_notes && (
            <div>
              <p className="text-[11px] text-muted-foreground mb-0.5">特記事項</p>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{order.special_notes}</p>
            </div>
          )}
        </ExpandSection>

        {(showDelivery || showInspection) && (
          <ExpandSection title="納品・検収" icon={<PackageCheck className="h-3.5 w-3.5" />}>
            {showInspection && (
              <div className={cn(
                "flex flex-wrap items-center gap-2 rounded-lg px-3 py-2",
                inspectLabel === "合格" ? "bg-emerald-50 text-emerald-900"
                  : inspectLabel === "差し戻し" ? "bg-red-50 text-red-800"
                    : "bg-muted text-muted-foreground",
              )}>
                {inspectLabel === "合格" && <CircleCheck className="h-4 w-4 shrink-0" />}
                <span className="text-sm font-semibold">検収 {inspectLabel}</span>
                <span className="text-xs tabular-nums opacity-80">{formatDateSlash(order.inspection_date)}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {showDelivery && (
                <>
                  <ExpandFact label="納品日（＝取引日）" value={formatDateSlash(order.delivery_date)} emphasis />
                  <ExpandFact label="納品内容" value={order.delivery_content || "—"} />
                </>
              )}
              {showInspection && (
                <>
                  <ExpandFact label="検収者" value={order.inspector_name || "—"} />
                  <ExpandFact label="コメント" value={order.inspection_comment || "—"} />
                </>
              )}
            </div>
            {showDelivery && <AttachmentList files={order.delivery_attachments ?? []} />}
          </ExpandSection>
        )}

        {showInvoice && (
          <ExpandSection title="請求・支払い" icon={<Receipt className="h-3.5 w-3.5" />}>
            {returned && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 leading-relaxed">
                {order.vendor_invoice_remarks}
              </p>
            )}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <ExpandFact label="取引日（納品日）" value={formatDateSlash(order.delivery_date || order.vendor_invoice_date)} />
              <ExpandFact label="請求番号" value={order.vendor_invoice_no || "—"} />
              <ExpandFact label="請求額（税抜）" value={yen(billed)} emphasis />
              <ExpandFact label="税込" value={yen(inclOf(billed))} emphasis />
              <ExpandFact label="受領日時" value={formatDateSlash(order.vendor_invoice_submitted_at)} />
              <ExpandFact label="ディレクター確認" value={formatDateSlash(order.director_confirmed_at)} />
              <ExpandFact
                label="支払い確定"
                value={
                  order.accounting_approved_at
                    ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CircleCheck className="h-3.5 w-3.5" />
                        {formatDateSlash(order.accounting_approved_at)}
                      </span>
                    )
                    : "—"
                }
              />
            </div>
            {!returned && order.vendor_invoice_remarks && (
              <ExpandFact label="備考" value={order.vendor_invoice_remarks} />
            )}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {order.vendor_invoice_pdf_path && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => void openProcurementFile(order.vendor_invoice_pdf_path!)}
                >
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  {pdfName ?? "請求書PDF"}
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onPreview}>
                当社フォーマット
              </Button>
              {status === "payment_approved" && (
                <Button asChild size="sm" className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800">
                  <Link href="/ledger">帳票データへ</Link>
                </Button>
              )}
            </div>
          </ExpandSection>
        )}
      </div>
    </div>
  );
}

function InvoiceFilePreview({ path, file }: { path?: string | null; file?: File | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileName = file?.name ?? path?.split("/").pop() ?? "請求書";
  const isPdf = file?.type === "application/pdf" || /\.pdf$/i.test(fileName);
  const isImage = file?.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(fileName);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setUrl(null);
    setError(null);
    if (file) {
      objectUrl = URL.createObjectURL(file);
      setUrl(objectUrl);
      return () => {
        cancelled = true;
        URL.revokeObjectURL(objectUrl!);
      };
    }
    if (!path) return;
    void getProcurementFileUrl(path).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setUrl(res.url);
    });
    return () => { cancelled = true; };
  }, [path, file]);

  if (!file && !path) {
    return <p className="text-xs text-muted-foreground">PDFを選ぶとここに表示されます</p>;
  }

  return (
    <div className="space-y-2 h-full">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground truncate">{fileName}</p>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={!url}
          onClick={() => { if (url) window.open(url, "_blank", "noopener,noreferrer"); }}
        >
          <FileText className="h-3.5 w-3.5 mr-1" />
          別タブで開く
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {!error && !url && <p className="text-xs text-muted-foreground">読み込み中…</p>}
      {url && isPdf && (
        <iframe title="請求書PDF" src={url} className="w-full h-[min(70vh,560px)] rounded-lg border bg-white" />
      )}
      {url && isImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="請求書" className="max-h-[min(70vh,560px)] w-full object-contain rounded-lg border bg-white" />
      )}
      {url && !isPdf && !isImage && (
        <p className="text-xs text-muted-foreground">プレビューできない形式です。「別タブで開く」から確認してください。</p>
      )}
    </div>
  );
}

function DeliveryDialog({
  order, inspector, onClose, onSaved,
}: {
  order: ProcurementOrder | null;
  inspector: string;
  onClose: () => void;
  onSaved: (o: ProcurementOrder) => void;
}) {
  const paper = isPaperInvoice(order?.craftsman);
  const [date, setDate] = useState(order?.delivery_date?.slice(0, 10) || todayIso());
  const [content, setContent] = useState(order?.delivery_content ?? "");
  const [comment, setComment] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sendEmail, setSendEmail] = useState(Boolean(order?.craftsman?.email));
  const [saving, setSaving] = useState(false);

  if (!order) return null;
  const email = order.craftsman?.email ?? "（業者マスタにメール未登録）";

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>納品検収 — {poLabel(order)} {order.title}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {order.construction ? `${order.construction.construction_no} ${order.construction.title}` : ""}
            {order.craftsman?.name ? ` ／ ${order.craftsman.name}` : ""}
            {` ／ ${yen(inclOf(Number(order.amount ?? 0)))}（税込）`}
          </p>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            業者から電話・メールで納品連絡を受けたら、ここで納品と検収を同時に確定します。納品日が請求書の取引日になります。
          </p>
          <div className="space-y-1">
            <Label>納品日（＝取引日・納品検収日）</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>納品内容</Label>
            <Textarea rows={3} value={content} onChange={(e) => setContent(e.target.value)} placeholder="納品物・数量など" />
          </div>
          <div className="space-y-1">
            <Label>添付（納品書・写真）</Label>
            <Input
              type="file"
              multiple
              accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {files.length > 0 && (
              <p className="text-[11px] text-muted-foreground">{files.map((f) => f.name).join("、")}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>コメント（社内メモ。業者には送らない）</Label>
            <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <p className="text-[11px] text-muted-foreground">検収者: {inspector || "（ログイン名）"}</p>
          {!paper ? (
            <div className="rounded-lg border p-3 space-y-2 text-sm">
              <p className="font-semibold text-xs">業者への連絡（請求書を送るURL）</p>
              <p className="text-xs text-muted-foreground">宛先: {email}</p>
              <label className="flex items-center gap-2 text-xs">
                <Checkbox checked={sendEmail} onCheckedChange={(c) => setSendEmail(c === true)} />
                納品検収と同時にメールを送る（未設定時はURLをコピー）
              </label>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2 text-sm">
              <p className="font-semibold text-xs">紙発注・自社書式</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                請求書（紙またはPDF）が届いたら、一覧の「PDF添付」で受領します。
              </p>
              <label className="flex items-center gap-2 text-xs">
                <Checkbox checked={sendEmail} onCheckedChange={(c) => setSendEmail(c === true)} />
                納品検収と同時に案内メールを送る
              </label>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button
            className="bg-emerald-700 hover:bg-emerald-800"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                let attachments: ProcurementAttachment[] = [];
                if (files.length > 0) {
                  const fd = new FormData();
                  for (const f of files) fd.append("files", f);
                  const up = await uploadDeliveryAttachments(order.id, fd);
                  if (!up.ok) {
                    toast.error(up.error);
                    return;
                  }
                  attachments = up.files;
                }
                const res = await registerDeliveryAndInspect({
                  orderId: order.id,
                  deliveryDate: date,
                  content,
                  attachments,
                  comment,
                  sendEmail,
                });
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                onSaved(res.order);
                if (paper) {
                  if (res.emailSent) {
                    toast.success("納品検収しました。紙／PDF送付の案内を送りました", { description: res.emailTo });
                  } else {
                    toast.success("納品検収しました。請求書が届いたらPDFを添付してください", {
                      description: res.emailError,
                    });
                  }
                } else {
                  toastInvoiceMail(res);
                }
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "登録に失敗しました");
              } finally {
                setSaving(false);
              }
            }}
          >
            納品検収
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AttachInvoiceDialog({
  order, onClose, onSaved,
}: {
  order: ProcurementOrder | null;
  onClose: () => void;
  onSaved: (o: ProcurementOrder) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState(Number(order?.amount ?? 0));
  const [confirmDiff, setConfirmDiff] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!order) return null;
  const orderExcl = Number(order.amount ?? 0);
  const amountDiff = invoiceAmount !== orderExcl;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>請求書を突合 — {poLabel(order)}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground leading-relaxed">
          右側のPDF金額を目視で照合し、一致を確認してから受領します。取引日は納品日（{formatDateSlash(order.delivery_date)}）です。
        </p>
        <div className="grid md:grid-cols-2 gap-4 min-h-0">
          <div className="space-y-3 text-sm">
            <p className="text-xs">
              {order.construction ? `${order.construction.construction_no} ${order.construction.title}` : ""}
              {order.craftsman?.name ? ` ／ ${order.craftsman.name}` : ""}
            </p>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
              <p className="text-[11px] text-muted-foreground">発注金額（税抜）</p>
              <p className="text-lg font-semibold tabular-nums">{yen(orderExcl)}</p>
              <p className="text-[11px] text-muted-foreground">税込 {yen(inclOf(orderExcl))}</p>
            </div>
            <div className="space-y-1">
              <Label>請求書（PDFまたは画像）</Label>
              <Input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && <p className="text-[11px] text-muted-foreground">{file.name}</p>}
            </div>
            <div className="space-y-1">
              <Label>請求書の金額（税抜）</Label>
              <IntegerInput value={invoiceAmount} onValueChange={setInvoiceAmount} />
              <p className="text-[11px] text-muted-foreground">
                入力 {yen(invoiceAmount)} / 税込 {yen(inclOf(invoiceAmount))}（税 {yen(taxOf(invoiceAmount))}）。この数字が帳票・全銀に載ります。
              </p>
            </div>
            <div className="space-y-1">
              <Label>請求番号（任意）</Label>
              <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="任意" />
            </div>
            {amountDiff && (
              <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                <Checkbox checked={confirmDiff} onCheckedChange={(c) => setConfirmDiff(c === true)} />
                <span>発注金額と違います。請求書の数字で進めることを確認しました。</span>
              </label>
            )}
          </div>
          <div className="rounded-lg border bg-muted/20 p-3 min-h-[360px]">
            <InvoiceFilePreview file={file} path={!file ? order.vendor_invoice_pdf_path : null} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button
            className="bg-emerald-700 hover:bg-emerald-800"
            disabled={saving}
            onClick={async () => {
              if (!file) {
                toast.error("PDFまたは画像を選んでください");
                return;
              }
              if (amountDiff && !confirmDiff) {
                toast.error("発注と金額が違う場合は、確認にチェックしてください");
                return;
              }
              setSaving(true);
              const fd = new FormData();
              fd.append("file", file);
              fd.append("invoiceNo", invoiceNo);
              fd.append("invoiceAmount", String(invoiceAmount));
              const res = await attachStaffInvoicePdf(order.id, fd);
              setSaving(false);
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              onSaved(res.order);
              toast.success("添付しました。請求書受領へ移動しました");
            }}
          >
            一致を確認して受領
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReturnInvoiceDialog({
  order, onClose, onSaved,
}: {
  order: ProcurementOrder | null;
  onClose: () => void;
  onSaved: (o: ProcurementOrder) => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  if (!order) return null;
  const assignee = orderAssignee(order);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>請求書を差し戻す — {poLabel(order)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground leading-relaxed">
            担当ディレクターへ通知し、対応するまで支払い確定に進めません。
            {assignee ? ` 通知先: ${assignee.name}` : " 工事に担当者が未設定のため、通知できない場合があります。"}
          </p>
          <div className="space-y-1">
            <Label>差し戻し理由</Label>
            <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="金額不一致の内容など" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button
            variant="outline"
            className="border-red-300 text-red-800"
            disabled={saving}
            onClick={async () => {
              if (!reason.trim()) {
                toast.error("差し戻し理由を入力してください");
                return;
              }
              setSaving(true);
              const res = await returnVendorInvoice({ orderId: order.id, reason });
              setSaving(false);
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              onSaved(res.order);
              toast.success(res.notified
                ? "差し戻しました。担当ディレクターへ通知しました"
                : "差し戻しました。担当者が未設定のため通知は送っていません");
            }}
          >
            差し戻す
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
