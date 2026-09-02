"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowUpDown, Paperclip } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { IntegerInput } from "@/components/ui/integer-input";
import { useAuth } from "@/hooks/use-auth";
import { useCompanyPermissions } from "@/hooks/use-company-permissions";
import { permissionRoleSlugs } from "@/lib/role-assignment";
import {
  attachStaffInvoicePdf,
  completeInspection,
  confirmVendorInvoice,
  approveVendorInvoice,
  registerDelivery,
  resendInvoiceUrl,
  uploadDeliveryAttachments,
  getProcurementFileUrl,
  type ProcurementAttachment,
  type ProcurementOrder,
} from "@/lib/actions/procurement";
import { markContractorOrderAcknowledged } from "@/lib/actions/contractor-orders";
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
  initialOrders: ProcurementOrder[];
  departments: string[];
};

const FLOW: LedgerStatus[] = [
  "ordered", "delivered", "inspected", "invoice_received", "confirmed", "payment_approved",
];

type SortKey = "po" | "project" | "vendor" | "amount" | "due" | "delivery" | "status" | "updated";

function poLabel(o: ProcurementOrder) {
  const base = o.po_no ?? o.id.slice(0, 8);
  return o.lot_no && o.lot_no > 1 ? `${base}-${o.lot_no}` : base;
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
  toast.success(res.emailError ? "検収完了。メールは送れなかったためURLをコピーしました" : "業者向けURLをコピーしました", {
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
  const [orders, setOrders] = useState(initialOrders);
  const [project, setProject] = useState("all");
  const [vendor, setVendor] = useState("all");
  const [status, setStatus] = useState<string>("active");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [deliveryTarget, setDeliveryTarget] = useState<ProcurementOrder | null>(null);
  const [inspectTarget, setInspectTarget] = useState<ProcurementOrder | null>(null);
  const [attachTarget, setAttachTarget] = useState<ProcurementOrder | null>(null);
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
  }, [orders, project, vendor, status, from, to, paperOnly, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "amount" || key === "updated" ? "desc" : "asc");
    }
  };

  const counts = useMemo(() => {
    const map = Object.fromEntries(FLOW.map((s) => [s, 0])) as Record<LedgerStatus, number>;
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
      toast.error("検収待ちの行を選択してください");
      return;
    }
    for (const t of targets) {
      const res = await completeInspection({
        orderId: t.id,
        result: "pass",
        inspectionDate: todayIso(),
        comment: "一括検収",
        sendEmail: true,
      });
      if (res.ok) replace(res.order);
    }
    toast.success(`${targets.length}件を検収完了にしました`);
    setSelected([]);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="text-xs text-muted-foreground">工事管理 &gt; 発注・納品・検収</div>
      <PageHeader
        title="納品・検収管理"
        description="検収完了後、メール業者は確認コード付きURLから請求。紙発注・自社書式はPDF添付で請求書受領へ進みます。分納は納品ごとに検収・請求します。"
      >
        <Button asChild variant="outline" size="sm">
          <Link href="/ledger">帳票データ作成 ↗</Link>
        </Button>
      </PageHeader>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border bg-amber-50/70 border-amber-200 p-3 space-y-2">
          <p className="text-xs font-semibold text-amber-950">紙発注・自社書式の流れ</p>
          <ol className="text-[11px] text-amber-950/90 space-y-1 leading-snug list-decimal pl-4">
            <li>業者マスタで「紙発注」にした行が色分けされます</li>
            <li>請書を受け取ったら「請書受領」を記録します</li>
            <li>納品 → 検収完了（案内メールは紙／PDF送付）</li>
            <li>届いた請求書を「PDF添付」すると請求書受領になります</li>
            <li>ディレクター確認 → 経理承認 → 帳票データ</li>
          </ol>
        </div>
        <div className="rounded-xl border bg-card p-3 space-y-2">
          <p className="text-xs font-semibold">分納の単位</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            分納は納品ごとに1行です。この納品分の金額を入れて登録すると、残額の行が新たにできます。残行も同じように検収・請求します。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
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

      <div className="rounded-xl border bg-card p-3">
        <div className="flex items-end gap-3">
          <FilterSelect label="案件" value={project} onChange={setProject} options={[["all", "すべて"], ...projects]} />
          <FilterSelect label="業者" value={vendor} onChange={setVendor} options={[["all", "すべて"], ...vendors.map((v) => [v, v] as [string, string])]} />
          <FilterSelect
            label="ステータス"
            value={status}
            onChange={setStatus}
            options={[["active", "承認済み以外"], ["all", "すべて"], ...FLOW.map((s) => [s, LEDGER_STATUS_META[s].label] as [string, string])]}
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
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-[11px] text-muted-foreground">
              <th className="px-3 py-2 w-8" />
              <Th onClick={() => toggleSort("po")}>発注番号</Th>
              <Th onClick={() => toggleSort("project")}>案件</Th>
              <Th onClick={() => toggleSort("vendor")}>業者名</Th>
              <Th onClick={() => toggleSort("amount")} className="text-right">発注金額（税込）</Th>
              <Th onClick={() => toggleSort("due")}>納品予定日</Th>
              <Th onClick={() => toggleSort("delivery")}>納品日（=取引日）</Th>
              <Th onClick={() => toggleSort("status")}>ステータス</Th>
              <Th onClick={() => toggleSort("updated")}>最終更新</Th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {listed.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">対象の発注がありません。承認・締結後の発注書がここに並びます。</td></tr>
            ) : listed.map((o) => {
              const ls = deriveLedgerStatus(o);
              const meta = LEDGER_STATUS_META[ls];
              const paper = isPaperInvoice(o.craftsman);
              return (
                <tr key={o.id} className={`border-t ${paper ? "bg-amber-50/80" : ""}`}>
                  <td className="px-3 py-2">
                    <Checkbox
                      checked={selected.includes(o.id)}
                      onCheckedChange={(c) => setSelected((p) => c === true ? [...p, o.id] : p.filter((id) => id !== o.id))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Link href={`/constructions/${o.construction_id}?tab=orders`} className="text-blue-700 hover:underline font-mono text-xs">
                        {poLabel(o)}
                      </Link>
                      {o.lot_no && o.lot_no > 1 && (
                        <Badge variant="outline" className="text-[10px]">分納{o.lot_no}</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">{o.construction ? `${o.construction.construction_no} ${o.construction.title}` : "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{o.craftsman?.name ?? "—"}</span>
                      {paper && <Badge className="bg-amber-200 text-amber-950 hover:bg-amber-200">紙発注</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{yen(inclOf(billedExclOf(o)))}</td>
                  <td className="px-3 py-2">{formatDateSlash(o.completion_date ?? o.end_date)}</td>
                  <td className="px-3 py-2 text-orange-700">{formatDateSlash(o.delivery_date)}</td>
                  <td className="px-3 py-2"><Badge className={meta.cls}>{meta.label}</Badge></td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{formatDateSlash(o.updated_at)}</td>
                  <td className="px-3 py-2 text-right">
                    <RowActions
                      order={o}
                      status={ls}
                      canAccount={canAccount}
                      onDelivery={() => setDeliveryTarget(o)}
                      onInspect={() => setInspectTarget(o)}
                      onAttach={() => setAttachTarget(o)}
                      onReplace={replace}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap pb-6">
        <p className="text-xs text-muted-foreground">
          納品日は請求書の取引日になり、承認前の請求は帳票データに含まれません。
        </p>
        <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={handleBulkInspect}>
          選択した行を一括で検収完了
        </Button>
      </div>

      <DeliveryDialog
        key={deliveryTarget?.id ?? "delivery-closed"}
        order={deliveryTarget}
        onClose={() => setDeliveryTarget(null)}
        onSaved={(o, remaining) => { replace(o, remaining); setDeliveryTarget(null); }}
      />
      <InspectionDialog
        key={inspectTarget?.id ?? "inspect-closed"}
        order={inspectTarget}
        inspector={profile?.display_name ?? ""}
        onClose={() => setInspectTarget(null)}
        onSaved={(o) => { replace(o); setInspectTarget(null); }}
      />
      <AttachInvoiceDialog
        key={attachTarget?.id ?? "attach-closed"}
        order={attachTarget}
        onClose={() => setAttachTarget(null)}
        onSaved={(o) => { replace(o); setAttachTarget(null); }}
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
  order, status, canAccount, onDelivery, onInspect, onAttach, onReplace,
}: {
  order: ProcurementOrder;
  status: LedgerStatus;
  canAccount: boolean;
  onDelivery: () => void;
  onInspect: () => void;
  onAttach: () => void;
  onReplace: (o: ProcurementOrder) => void;
}) {
  if (status === "ordered") {
    if (!order.concluded_at) {
      return (
        <div className="inline-flex items-center gap-1">
          <Button size="sm" className="h-7 text-xs" variant="outline" disabled title="請書の受領後に納品できます">
            納品を登録
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
    return <Button size="sm" className="h-7 text-xs bg-teal-600 hover:bg-teal-700" onClick={onDelivery}>納品を登録</Button>;
  }
  if (status === "delivered") {
    return <Button size="sm" className="h-7 text-xs bg-teal-600 hover:bg-teal-700" onClick={onInspect}>検収完了</Button>;
  }
  if (status === "inspected") {
    const paper = isPaperInvoice(order.craftsman);
    return (
      <div className="inline-flex items-center gap-1">
        <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={onAttach}>
          PDF添付
        </Button>
        {!paper && (
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
        )}
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
      </div>
    );
  }
  if (status === "confirmed") {
    if (!canAccount) return <span className="text-[11px] text-muted-foreground">経理承認待ち</span>;
    return (
      <Button
        size="sm"
        className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800"
        onClick={async () => {
          try {
            onReplace(await approveVendorInvoice(order.id));
            toast.success("経理承認しました。帳票データの対象になります");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "承認に失敗しました");
          }
        }}
      >
        承認する
      </Button>
    );
  }
  if (status === "payment_approved") {
    return (
      <Button asChild size="sm" variant="outline" className="h-7 text-xs">
        <Link href="/ledger">帳票データへ ↗</Link>
      </Button>
    );
  }
  return null;
}

function Th({ children, onClick, className }: { children: React.ReactNode; onClick: () => void; className?: string }) {
  return (
    <th className={`px-3 py-2 text-left font-semibold ${className ?? ""}`}>
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

function DeliveryDialog({
  order, onClose, onSaved,
}: {
  order: ProcurementOrder | null;
  onClose: () => void;
  onSaved: (o: ProcurementOrder, remaining?: ProcurementOrder) => void;
}) {
  const [date, setDate] = useState(todayIso());
  const [content, setContent] = useState("");
  const [partial, setPartial] = useState("none");
  const [lotAmount, setLotAmount] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  if (!order) return null;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>納品を登録 — {poLabel(order)} {order.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>納品日（請求書の取引日になります）</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>納品内容</Label>
            <Textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} placeholder="納品物・数量など" />
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
            <Label>分納</Label>
            <Select value={partial} onValueChange={setPartial}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">なし（一括納品）</SelectItem>
                <SelectItem value="partial">分納（この納品分。残は新しい行になる）</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {partial === "partial" && (
            <div className="space-y-1">
              <Label>この納品分の金額（税抜・必須）</Label>
              <Input
                type="number"
                min={1}
                max={Math.max(0, Number(order.amount ?? 0) - 1)}
                value={lotAmount}
                onChange={(e) => setLotAmount(e.target.value)}
                placeholder={`発注額未満（元の額 ${order.amount ?? 0}）`}
              />
              <p className="text-[11px] text-muted-foreground">残額は新しい行になります。0円の残行は作れません。</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button
            disabled={saving || (partial === "partial" && (lotAmount.trim() === "" || Number(lotAmount) <= 0 || Number(lotAmount) >= Number(order.amount ?? 0)))}
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
                const res = await registerDelivery({
                  orderId: order.id,
                  deliveryDate: date,
                  content,
                  partial,
                  attachments,
                  lotAmount: lotAmount.trim() === "" ? null : Number(lotAmount),
                });
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                onSaved(res.order, res.remainingOrder);
                toast.success(res.remainingOrder ? "納品を登録し、分納の残行を追加しました" : "納品を登録しました");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "登録に失敗しました");
              } finally {
                setSaving(false);
              }
            }}
          >
            納品を登録
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InspectionDialog({
  order, inspector, onClose, onSaved,
}: {
  order: ProcurementOrder | null;
  inspector: string;
  onClose: () => void;
  onSaved: (o: ProcurementOrder) => void;
}) {
  const paper = isPaperInvoice(order?.craftsman);
  const [result, setResult] = useState<"pass" | "reject">("pass");
  const [date, setDate] = useState(todayIso());
  const [comment, setComment] = useState("");
  const [sendEmail, setSendEmail] = useState(Boolean(order?.craftsman?.email));
  const [saving, setSaving] = useState(false);

  if (!order) return null;
  const email = order.craftsman?.email ?? "（業者マスタにメール未登録）";

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {order.po_no ?? order.craftsman?.name ?? "発注"}
            <Badge className="bg-orange-100 text-orange-800">納品済み（検収待ち）</Badge>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {order.construction ? `${order.construction.construction_no} ${order.construction.title}` : ""}
            {order.craftsman?.name ? ` ／ ${order.craftsman.name}` : ""}
            {` ／ ${yen(inclOf(Number(order.amount ?? 0)))}（税込）`}
          </p>
        </DialogHeader>

        <div className="grid grid-cols-5 gap-2 text-[11px]">
          {[
            ["発注", "送信・受け書"],
            ["納品", "納品日＝取引日"],
            ["検収", paper ? "いまここ。完了後に社内でPDF添付" : "いまここ。担当者が完了→業者へURL"],
            ["請求書", paper ? "届いたPDFを添付して受領" : "業者がURLから送る"],
            ["確認・承認", "Dir→経理"],
          ].map(([title, sub], i) => (
            <div
              key={title}
              className={`rounded-lg border px-3 py-2 ${i === 2 ? "border-[var(--brand-dark)] bg-[var(--brand-accent)]" : i < 2 ? "border-emerald-200 bg-emerald-50/70" : "bg-muted/30"}`}
            >
              <p className="font-semibold text-xs">{i + 1}. {title}</p>
              <p className="text-muted-foreground leading-snug">{sub}</p>
            </div>
          ))}
        </div>
        <div className="rounded-lg border p-4 text-sm space-y-3 bg-muted/20">
          <p className="font-semibold">納品情報</p>
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <p><span className="text-muted-foreground">納品日（＝取引日）</span><br />{formatDateSlash(order.delivery_date)}</p>
            <p><span className="text-muted-foreground">分納</span><br />{order.delivery_partial || "なし（一括納品）"}</p>
          </div>
          <div className="text-xs">
            <p className="text-muted-foreground">納品内容</p>
            <p>{order.delivery_content || "—"}</p>
          </div>
          <AttachmentList files={order.delivery_attachments ?? []} />
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4 space-y-3">
          <p className="text-sm font-semibold">検収　担当者（ディレクター／施工管理）が納品物を確認して入力する</p>
          <RadioGroup value={result} onValueChange={(v) => setResult(v as "pass" | "reject")} className="grid sm:grid-cols-2 gap-3">
            <label className={`rounded-lg border p-4 text-sm cursor-pointer ${result === "pass" ? "border-emerald-500 bg-white ring-1 ring-emerald-400" : "bg-white"}`}>
              <RadioGroupItem value="pass" className="mr-2" />
              <span className="font-medium">合格（検収完了）</span>
              <p className="text-[11px] text-muted-foreground mt-1 pl-6">
                {paper ? "請求待ちになり、届いた請求書PDFを一覧から添付します" : "請求待ちになり、業者へURLを送ります"}
              </p>
            </label>
            <label className={`rounded-lg border p-4 text-sm cursor-pointer ${result === "reject" ? "border-orange-500 bg-white ring-1 ring-orange-300" : "bg-white"}`}>
              <RadioGroupItem value="reject" className="mr-2" />
              <span className="font-medium">差し戻し（再納品を依頼）</span>
              <p className="text-[11px] text-muted-foreground mt-1 pl-6">発注済みに戻し、もう一度納品してもらいます</p>
            </label>
          </RadioGroup>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1"><Label>検収日</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-1"><Label>検収者</Label><Input value={inspector} readOnly /></div>
          </div>
          <div className="space-y-1">
            <Label>コメント（社内メモ。業者には送らない）</Label>
            <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        </div>

        {result === "pass" && !paper && (
          <div className="rounded-lg border p-4 space-y-3 text-sm">
            <p className="font-semibold">業者への連絡（検収完了 → 請求書を送るURL）</p>
            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <p><span className="text-muted-foreground">宛先</span><br />{email}</p>
              <p><span className="text-muted-foreground">件名</span><br />[BRIDGE Linq] 検収完了 — 請求書をご送付ください</p>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={sendEmail} onCheckedChange={(c) => setSendEmail(c === true)} />
              検収完了と同時にメールを送る（ログイン不要。未設定時はURLをコピー）
            </label>
            <p className="text-[11px] text-muted-foreground">URLの有効期限 30日（既定）</p>
          </div>
        )}
        {result === "pass" && paper && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-3 text-sm">
            <p className="font-semibold">紙発注・自社書式</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              業者へログイン用の画面は送りません。請求書（メールPDFまたは紙のスキャン）が届いたら、検収完了一覧の「PDF添付」で受領します。
            </p>
            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <p><span className="text-muted-foreground">宛先</span><br />{email}</p>
              <p><span className="text-muted-foreground">件名</span><br />[BRIDGE Linq] 検収完了 — 請求書（紙／PDF）をご送付ください</p>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={sendEmail} onCheckedChange={(c) => setSendEmail(c === true)} />
              検収完了と同時に案内メールを送る（紙／PDFを発注元へ送付）
            </label>
          </div>
        )}

        <DialogFooter className="sm:justify-between sm:items-center">
          <p className="text-[11px] text-muted-foreground mr-auto">
            {result === "pass" ? "完了すると「検収完了（請求待ち）」になります。" : "差し戻すと「発注済み」に戻り、再納品を待ちます。"}
          </p>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          {result === "reject" && (
            <Button
              variant="outline"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                const res = await completeInspection({ orderId: order.id, result: "reject", inspectionDate: date, comment, sendEmail: false });
                setSaving(false);
                if (!res.ok) { toast.error(res.error); return; }
                onSaved(res.order);
                toast.success("差し戻しました。ステータスは発注済み（再納品待ち）です");
              }}
            >
              差し戻し
            </Button>
          )}
          {result === "pass" && (
            <Button
              className="bg-emerald-700 hover:bg-emerald-800"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                const res = await completeInspection({
                  orderId: order.id,
                  result: "pass",
                  inspectionDate: date,
                  comment,
                  sendEmail,
                });
                setSaving(false);
                if (!res.ok) { toast.error(res.error); return; }
                onSaved(res.order);
                if (paper) {
                  if (res.emailSent) {
                    toast.success("検収完了。紙／PDF送付の案内を送りました", { description: res.emailTo });
                  } else {
                    toast.success("検収完了。請求書が届いたらPDFを添付してください", {
                      description: res.emailError,
                    });
                  }
                } else {
                  toastInvoiceMail(res);
                }
              }}
            >
              {paper ? "検収を完了する" : "検収を完了して業者に通知"}
            </Button>
          )}
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
  const [invoiceDate, setInvoiceDate] = useState(todayIso());
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState(Number(order?.amount ?? 0));
  const [confirmDiff, setConfirmDiff] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!order) return null;
  const orderExcl = Number(order.amount ?? 0);
  const amountDiff = invoiceAmount !== orderExcl;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>請求書PDFを添付 — {poLabel(order)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground leading-relaxed">
            受領したPDF（紙はスキャン）を添付すると、この行は「請求書受領」へ移動します。未添付の行が請求書未受領の一覧になります。
          </p>
          <p className="text-xs">
            {order.construction ? `${order.construction.construction_no} ${order.construction.title}` : ""}
            {order.craftsman?.name ? ` ／ ${order.craftsman.name}` : ""}
            {` ／ 発注 ${yen(inclOf(orderExcl))}（税込）`}
          </p>
          <div className="space-y-1">
            <Label>請求書（PDFまたは画像）</Label>
            <Input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && <p className="text-[11px] text-muted-foreground">{file.name}</p>}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>請求日</Label>
              <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>請求番号（任意）</Label>
              <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="任意" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>請求書の金額（税抜）</Label>
              <IntegerInput value={invoiceAmount} onValueChange={setInvoiceAmount} />
              <p className="text-[11px] text-muted-foreground">
                発注 {yen(orderExcl)} / 税込 {yen(inclOf(invoiceAmount))}（税 {yen(taxOf(invoiceAmount))}）。この数字が帳票・全銀に載ります。
              </p>
            </div>
          </div>
          {amountDiff && (
            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              <Checkbox checked={confirmDiff} onCheckedChange={(c) => setConfirmDiff(c === true)} />
              <span>発注金額と違います。紙の請求書の数字で進めることを確認しました。</span>
            </label>
          )}
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
              fd.append("invoiceDate", invoiceDate);
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
            添付して請求書受領へ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
