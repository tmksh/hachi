"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";
import { fetchProcurementMasters, fetchProcurementOrders, LIST_STALE_MS, MASTER_STALE_MS, QK, type ProcurementMasters } from "@/lib/queries/portal";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, ArrowUpDown, Printer, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ProcurementOrder } from "@/lib/actions/procurement";
import {
  CSV_OUTPUT_COLUMNS,
  bankLabel,
  buildZenginText,
  defaultTransferFee,
  downloadTextFile,
  downloadZenginFile,
  formatDateSlash,
  billedExclOf,
  inclOf,
  isZenginAccountReady,
  isZenginSenderReady,
  ledgerMonthOf,
  printHtml,
  resolveZenginAccount,
  taxOf,
  toCsv,
  yen,
  type CsvOutputColumnKey,
  type InvoiceClosingDay,
  type TransferSender,
  EMPTY_TRANSFER_SENDER,
} from "@/lib/procurement";

type Format = "zengin" | "csv";
type SortKey =
  | "vendor"
  | "department"
  | "project"
  | "projectNo"
  | "delivery"
  | "amount"
  | "amountExcl"
  | "tax"
  | "bank"
  | "kana"
  | "billed"
  | "fee";

type Props = {
  initialOrders?: ProcurementOrder[];
  masters?: ProcurementMasters;
};

function approvedOnly(orders: ProcurementOrder[]) {
  return orders.filter((o) => o.ledger_status === "payment_approved");
}

export function LedgerClient({ initialOrders, masters: initialMasters }: Props) {
  const router = useRouter();
  const { data: orders = [], isPending: ordersPending } = useQuery({
    queryKey: QK.procurementOrders,
    queryFn: fetchProcurementOrders,
    staleTime: LIST_STALE_MS,
    initialData: initialOrders,
    initialDataUpdatedAt: initialOrders ? Date.now() : undefined,
  });
  const { data: masters, isPending: mastersPending } = useQuery({
    queryKey: QK.procurementMasters,
    queryFn: fetchProcurementMasters,
    staleTime: MASTER_STALE_MS,
    initialData: initialMasters,
    initialDataUpdatedAt: initialMasters ? Date.now() : undefined,
  });
  const loadedMasters = masters ?? {
    departments: [] as string[],
    accountItems: [] as string[],
    sender: EMPTY_TRANSFER_SENDER,
    closingDay: "20" as const,
  };
  const [format, setFormat] = useState<Format>("zengin");
  const [month, setMonth] = useState("all");
  const [transferDate, setTransferDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return d.toISOString().slice(0, 10);
  });
  const [department, setDepartment] = useState("all");
  const [accountItem, setAccountItem] = useState("all");
  const [project, setProject] = useState("all");
  const [feeBurden, setFeeBurden] = useState<"sender" | "recipient">("sender");
  const [selectedCols, setSelectedCols] = useState<CsvOutputColumnKey[]>(
    CSV_OUTPUT_COLUMNS.filter((c) => c.defaultOn).map((c) => c.key),
  );
  const [sortKey, setSortKey] = useState<SortKey>("department");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<string[]>([]);
  const [showUnexportable, setShowUnexportable] = useState(false);
  const [sender, setSender] = useState(EMPTY_TRANSFER_SENDER);
  const closingDay: InvoiceClosingDay = "20";

  useEffect(() => {
    if (masters?.sender) setSender(masters.sender);
  }, [masters]);

  const approved = useMemo(() => approvedOnly(orders), [orders]);

  const filtered = useMemo(() => {
    return approved.filter((o) => {
      const payMonth = ledgerMonthOf(o, closingDay);
      if (month !== "all" && payMonth && payMonth !== month) return false;
      if (department !== "all" && (o.department ?? "") !== department) return false;
      if (accountItem !== "all" && (o.account_item ?? "") !== accountItem) return false;
      if (project !== "all" && o.construction_id !== project) return false;
      return true;
    });
  }, [approved, month, department, accountItem, project, closingDay]);

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of approved) {
      if (o.construction) map.set(o.construction.id, `${o.construction.construction_no} ${o.construction.title}`);
    }
    return [...map.entries()];
  }, [approved]);

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    for (const o of approved) {
      const ym = ledgerMonthOf(o, closingDay);
      if (/^\d{4}-\d{2}$/.test(ym)) set.add(ym);
    }
    return [...set].sort().reverse();
  }, [approved, closingDay]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(
        key === "amount" || key === "amountExcl" || key === "tax" || key === "billed" || key === "fee"
          ? "desc"
          : "asc",
      );
    }
  };

  const csvRows = useMemo(() => {
    const rows = filtered.map((o) => {
      const excl = billedExclOf(o);
      return {
        id: o.id,
        projectNo: o.construction?.construction_no ?? "",
        projectName: o.construction?.title ?? "",
        vendorName: o.craftsman?.name ?? "（未設定）",
        department: o.department ?? "",
        deliveryDate: o.delivery_date ?? "",
        amountExcl: excl,
        tax: taxOf(excl),
        amountIncl: inclOf(excl),
        accountItem: o.account_item ?? "",
        invoiceNo: o.vendor_invoice_no ?? "",
        orderTitle: o.title,
      };
    });
    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const val = (r: typeof a) => {
        if (sortKey === "amount") return r.amountIncl;
        if (sortKey === "amountExcl") return r.amountExcl;
        if (sortKey === "tax") return r.tax;
        if (sortKey === "delivery") return r.deliveryDate;
        if (sortKey === "vendor") return r.vendorName;
        if (sortKey === "projectNo") return r.projectNo;
        if (sortKey === "project") return r.projectName;
        return r.department;
      };
      const av = val(a);
      const bv = val(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "ja") * dir;
    });
    return rows;
  }, [filtered, sortKey, sortDir]);

  const zenginGroups = useMemo(() => {
    const map = new Map<string, {
      id: string;
      vendorName: string;
      bank: string | null;
      kana: string;
      billed: number;
      count: number;
      department: string;
      accountItem: string;
      exportable: boolean;
      bankCode: string;
      bankNameKana: string;
      branchCode: string;
      branchNameKana: string;
      accountType: string;
      accountNumber: string;
    }>();
    for (const o of filtered) {
      const account = resolveZenginAccount(o.craftsman ?? {});
      const bank = bankLabel(o.craftsman ?? {});
      const key = `${o.craftsman?.id ?? o.craftsman?.name ?? "未登録"}|${account.bankCode}|${account.accountNumber}`;
      const billed = inclOf(billedExclOf(o));
      const cur = map.get(key);
      if (cur) {
        cur.billed += billed;
        cur.count += 1;
      } else {
        map.set(key, {
          id: key,
          vendorName: o.craftsman?.name ?? "未登録業者",
          bank,
          kana: account.accountKana,
          billed,
          count: 1,
          department: o.department ?? "",
          accountItem: o.account_item ?? "",
          exportable: isZenginAccountReady(account),
          bankCode: account.bankCode,
          bankNameKana: account.bankNameKana,
          branchCode: account.branchCode,
          branchNameKana: account.branchNameKana,
          accountType: account.accountType,
          accountNumber: account.accountNumber,
        });
      }
    }
    const rows = [...map.values()];
    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const feeOf = (r: typeof a) => defaultTransferFee(r.billed);
      const val = (r: typeof a) => {
        if (sortKey === "billed") return r.billed;
        if (sortKey === "fee") return feeOf(r);
        if (sortKey === "amount") return feeBurden === "recipient" ? r.billed - feeOf(r) : r.billed;
        if (sortKey === "vendor") return r.vendorName;
        if (sortKey === "bank") return r.bank ?? "";
        if (sortKey === "kana") return r.kana;
        return r.department;
      };
      const av = val(a);
      const bv = val(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "ja") * dir;
    });
    return rows;
  }, [filtered, sortKey, sortDir, feeBurden]);

  const unexportable = zenginGroups.filter((g) => !g.exportable);
  const visibleZengin = showUnexportable ? unexportable : zenginGroups.filter((g) => g.exportable);
  const visibleIds = format === "csv" ? csvRows.map((r) => r.id) : visibleZengin.map((g) => g.id);
  const selectedSet = selected.length === 0 ? new Set(visibleIds) : new Set(selected);
  const toggleRow = (id: string, on: boolean) => {
    const base = selected.length === 0 ? visibleIds : selected;
    setSelected(on ? [...new Set([...base, id])] : base.filter((x) => x !== id));
  };
  const checkedZengin = visibleZengin.filter((g) => selectedSet.has(g.id));
  const checkedCsv = csvRows.filter((r) => selectedSet.has(r.id));

  const unsetAccounts = filtered.filter((o) => !o.account_item).length;

  const exportCsv = () => {
    const cols = CSV_OUTPUT_COLUMNS.filter((c) => selectedCols.includes(c.key));
    const headers = cols.map((c) => c.label);
    const rows = checkedCsv.map((r) =>
      cols.map((c) => {
        const v = r[c.key];
        return typeof v === "number" ? String(v) : String(v ?? "");
      }),
    );
    downloadTextFile(`帳票_${month}.csv`, toCsv(headers, rows), "text/csv;charset=utf-8");
    toast.success("CSVを書き出しました");
  };

  const exportZengin = () => {
    if (!isZenginSenderReady(sender)) {
      toast.error("依頼人情報が不足しています。会社設定の全銀・振込元を入力してください");
      return;
    }
    const rows = checkedZengin.filter((g) => g.exportable).map((g) => {
      const fee = defaultTransferFee(g.billed);
      const amount = feeBurden === "recipient" ? Math.max(0, g.billed - fee) : g.billed;
      return {
        vendorName: g.vendorName,
        accountKana: g.kana,
        amount,
        bankCode: g.bankCode,
        bankName: g.bankNameKana,
        branchCode: g.branchCode,
        branchName: g.branchNameKana,
        accountType: g.accountType,
        accountNumber: g.accountNumber,
      };
    });
    if (rows.length === 0) {
      toast.error("出力できる行がありません。業者マスタに銀行コード・支店コード・口座を登録してください");
      return;
    }
    const text = buildZenginText({ ...sender, transferDate }, rows);
    downloadZenginFile(`zengin_${transferDate.replaceAll("-", "")}.txt`, text);
    toast.success("全銀フォーマットを書き出しました");
  };

  const printList = () => {
    const rows = format === "csv"
      ? checkedCsv.map((r) => `<tr><td>${r.projectNo}</td><td>${r.projectName}</td><td>${r.vendorName}</td><td>${r.department}</td><td class="right">${yen(r.amountIncl)}</td></tr>`).join("")
      : checkedZengin.map((g) => `<tr><td>${g.vendorName}</td><td>${g.bank ?? "未登録"}</td><td class="right">${yen(g.billed)}</td></tr>`).join("");
    printHtml("帳票データ", `<h2>帳票データ作成</h2><table><tbody>${rows}</tbody></table>`);
  };

  const toggleCol = (key: CsvOutputColumnKey) => {
    setSelectedCols((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };

  if ((ordersPending && orders.length === 0) || (mastersPending && !masters)) {
    return <PageLoadingFallback />;
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="帳票データ作成"
        description="ネットバンキング用の全銀データと、案件別確認用CSVを請求データから作成します。支払い確定した請求だけが対象です。"
      >
        <div className="flex items-center gap-2">
          <Badge className="bg-amber-100 text-amber-800 border-amber-200">経理・営業事務・ディレクター</Badge>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.refresh()}>
            <RefreshCw className="h-3.5 w-3.5" />請求データを再取得
          </Button>
        </div>
      </PageHeader>
      <p className="text-xs text-muted-foreground -mt-2">経理 &gt; 帳票データ</p>

      <section className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold">出力形式</p>
            <p className="text-xs text-muted-foreground">全銀は業者・口座で合算、CSVは請求ごとに1行です。</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => { setFormat("zengin"); setSelected([]); }}
            className={`rounded-xl border p-3 text-left ${format === "zengin" ? "border-[var(--brand-dark)] bg-[var(--brand-accent)]" : "hover:bg-muted/40"}`}
          >
            <p className="font-medium text-sm">全銀フォーマット</p>
            <p className="text-xs text-muted-foreground mt-0.5">全銀協 AP-I-12 総合振込。ネットバンキング取込用。同一業者の複数請求を1行に合算します。</p>
          </button>
          <button
            type="button"
            onClick={() => { setFormat("csv"); setSelected([]); }}
            className={`rounded-xl border p-3 text-left ${format === "csv" ? "border-[var(--brand-dark)] bg-[var(--brand-accent)]" : "hover:bg-muted/40"}`}
          >
            <p className="font-medium text-sm">CSV（案件別一覧）</p>
            <p className="text-xs text-muted-foreground mt-0.5">営業事務・ディレクター向け。請求1件につき1行です。</p>
          </button>
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-4 items-stretch">
      {format === "csv" && (
        <section className="rounded-xl border bg-card p-4 h-full flex flex-col gap-3">
          <p className="text-sm font-semibold">出力項目</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 flex-1 min-h-0 auto-rows-fr">
            {CSV_OUTPUT_COLUMNS.map((col) => {
              const on = selectedCols.includes(col.key);
              return (
                <label
                  key={col.key}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 text-xs cursor-pointer ${
                    on
                      ? "text-white border-[var(--brand-dark)] bg-[var(--brand-dark)] shadow-sm"
                      : "bg-white"
                  }`}
                >
                  <Checkbox
                    checked={on}
                    onCheckedChange={() => toggleCol(col.key)}
                    className={on ? "border-white data-[state=checked]:bg-white data-[state=checked]:text-[var(--brand-dark)] data-[state=checked]:border-white" : undefined}
                  />
                  <span className="leading-tight">{col.label}</span>
                </label>
              );
            })}
          </div>
        </section>
      )}

      {format === "zengin" && (
        <section className="rounded-xl border bg-card p-4 space-y-3 h-full">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">依頼人情報（自社の振込元）</p>
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm" className="text-xs">
                <Link href="/settings">会社設定で編集</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setSender(loadedMasters.sender)}
              >
                会社設定から取得
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">
            ここは今回の書き出し用です。普段使う値は設定 → 会社情報の「全銀・振込元」に保存します。
          </p>
          {!isZenginSenderReady(sender) && (
            <p className="text-xs text-red-700">
              依頼人コード・カナ名・銀行コード・支店コード・口座が揃うと、全銀協規定の総合振込形式で出せます。
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="依頼人コード（10桁）" value={sender.senderCode} onChange={(v) => setSender((s) => ({ ...s, senderCode: v }))} />
            <Field label="依頼人名（半角カナ）" value={sender.senderName} onChange={(v) => setSender((s) => ({ ...s, senderName: v }))} />
            <Field label="仕向銀行コード（4桁）" value={sender.bankCode} onChange={(v) => setSender((s) => ({ ...s, bankCode: v }))} />
            <Field label="仕向銀行名（半角カナ）" value={sender.bankName} onChange={(v) => setSender((s) => ({ ...s, bankName: v }))} />
            <Field label="仕向支店コード（3桁）" value={sender.branchCode} onChange={(v) => setSender((s) => ({ ...s, branchCode: v }))} />
            <Field label="仕向支店名（半角カナ）" value={sender.branchName} onChange={(v) => setSender((s) => ({ ...s, branchName: v }))} />
            <Field label="預金種目" value={sender.accountType} onChange={(v) => setSender((s) => ({ ...s, accountType: v }))} />
            <Field label="口座番号（7桁）" value={sender.accountNumber} onChange={(v) => setSender((s) => ({ ...s, accountNumber: v }))} />
          </div>
        </section>
      )}

      <section className="rounded-xl border bg-card p-4 space-y-3 h-full">
        <p className="text-sm font-semibold">絞り込み</p>
        <p className="text-xs text-muted-foreground -mt-2">下の表に出す請求を選びます。初期は全部です。</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">対象月（納品日）</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                {monthOptions.map((ym) => {
                  const [y, m] = ym.split("-");
                  return <SelectItem key={ym} value={ym}>{`${y}年${Number(m)}月`}</SelectItem>;
                })}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              請求日ではなく納品日で判定。21日以降は翌月度（例: 9/21納品→10月度）
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">振込指定日</Label>
            <Input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">部門</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                {loadedMasters.departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">勘定科目</Label>
            <Select value={accountItem} onValueChange={setAccountItem}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                {loadedMasters.accountItems.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {format === "csv" ? (
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">案件</Label>
              <Select value={project} onValueChange={setProject}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  {projects.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">手数料の負担</Label>
              <Select value={feeBurden} onValueChange={(v) => setFeeBurden(v as "sender" | "recipient")}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sender">当方負担</SelectItem>
                  <SelectItem value="recipient">先方負担</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </section>
      </div>

      {format === "csv" && unsetAccounts > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-red-800">
            勘定科目が未確定の請求が {unsetAccounts} 件あります。このまま出すと科目別集計が合いません。全銀フォーマットには科目は不要です。
          </p>
          <Button asChild size="sm" className="bg-red-600 hover:bg-red-700">
            <Link href="/account-items">勘定科目の確定へ</Link>
          </Button>
        </div>
      )}

      {format === "zengin" && unexportable.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-red-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {unexportable.length}件が出力できません。業者マスタに銀行コード・支店コード・口座番号を登録してください。
          </p>
          <Button variant="outline" size="sm" onClick={() => setShowUnexportable((v) => !v)}>
            {showUnexportable ? "出力可能な行を表示" : `該当${unexportable.length}件を表示`}
          </Button>
        </div>
      )}

      <section className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b text-sm font-semibold">
          {format === "zengin" ? "振込明細" : "請求一覧"}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            支払い確定 {approved.length} 件 / 表示 {format === "csv" ? csvRows.length : visibleZengin.length} 件
          </span>
        </div>
        <div className="overflow-x-auto">
          {format === "csv" ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-[11px] text-muted-foreground">
                  <th className="px-3 py-2 w-8" />
                  <Th onClick={() => toggleSort("projectNo")}>案件番号</Th>
                  <Th onClick={() => toggleSort("project")}>案件名</Th>
                  <Th onClick={() => toggleSort("vendor")}>業者名</Th>
                  <Th onClick={() => toggleSort("department")}>部門</Th>
                  <Th onClick={() => toggleSort("delivery")} className="bg-amber-50">納品日（取引日）</Th>
                  <Th onClick={() => toggleSort("amountExcl")} className="text-right">税抜</Th>
                  <Th onClick={() => toggleSort("tax")} className="text-right">消費税</Th>
                  <Th onClick={() => toggleSort("amount")} className="text-right">税込</Th>
                </tr>
              </thead>
              <tbody>
                {csvRows.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    {approved.length === 0
                      ? "支払い確定の請求がありません。納品・検収管理で総務が支払い確定するとここに表示されます。"
                      : `支払い確定は ${approved.length} 件ありますが、選んだ対象月にはありません。対象月を「すべて」にしてください。`}
                  </td></tr>
                ) : csvRows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">
                      <Checkbox checked={selectedSet.has(r.id)} onCheckedChange={(c) => toggleRow(r.id, c === true)} />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.projectNo}</td>
                    <td className="px-3 py-2">{r.projectName}</td>
                    <td className="px-3 py-2">{r.vendorName}</td>
                    <td className="px-3 py-2">{r.department || "—"}</td>
                    <td className="px-3 py-2 bg-amber-50/60">{formatDateSlash(r.deliveryDate)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{yen(r.amountExcl)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{yen(r.tax)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-blue-700">{yen(r.amountIncl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-[11px] text-muted-foreground">
                  <th className="px-3 py-2 w-8" />
                  <Th onClick={() => toggleSort("vendor")}>業者名</Th>
                  <Th onClick={() => toggleSort("bank")}>振込先口座</Th>
                  <Th onClick={() => toggleSort("kana")}>受取人名（カナ）</Th>
                  <Th onClick={() => toggleSort("billed")} className="text-right">請求額</Th>
                  <Th onClick={() => toggleSort("fee")} className="text-right">手数料</Th>
                  <Th onClick={() => toggleSort("amount")} className="text-right">振込額</Th>
                </tr>
              </thead>
              <tbody>
                {visibleZengin.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    {approved.length === 0
                      ? "出力対象がありません。"
                      : filtered.length === 0
                        ? `支払い確定は ${approved.length} 件ありますが、選んだ対象月にはありません。対象月を「すべて」にしてください。`
                        : "口座未登録のため表に出していません。上の警告から「該当件を表示」を押すと確認できます。"}
                  </td></tr>
                ) : visibleZengin.map((g) => {
                  const fee = defaultTransferFee(g.billed);
                  const transfer = feeBurden === "recipient" ? Math.max(0, g.billed - fee) : g.billed;
                  return (
                    <tr key={g.id} className={`border-t ${g.exportable ? "" : "bg-rose-50"}`}>
                      <td className="px-3 py-2">
                        <Checkbox
                          disabled={!g.exportable}
                          checked={g.exportable && selectedSet.has(g.id)}
                          onCheckedChange={(c) => toggleRow(g.id, c === true)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        {g.vendorName}
                        {g.count > 1 && <span className="ml-1 text-[11px] text-muted-foreground">（{g.count}件合算）</span>}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {g.bank ?? <span className="text-red-600">口座が未登録</span>}
                      </td>
                      <td className="px-3 py-2 text-xs">{g.kana || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{yen(g.billed)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{g.exportable ? yen(fee) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-blue-700">{g.exportable ? yen(transfer) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <SummaryCards
        format={format}
        csvRows={checkedCsv}
        zenginRows={checkedZengin.filter((g) => g.exportable)}
        feeBurden={feeBurden}
      />

      <div className="flex items-center justify-between gap-3 flex-wrap pb-6">
        <p className="text-xs text-muted-foreground">
          {format === "zengin"
            ? "書き出すと実際の振込データになります。先にプレビュー（印刷）で内容を確認してください。"
            : "チェックした列だけをCSVに書き出します。"}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-1.5" onClick={printList}>
            <Printer className="h-4 w-4" />{format === "zengin" ? "内容をプレビュー" : "画面の一覧を印刷"}
          </Button>
          <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={format === "zengin" ? exportZengin : exportCsv}>
            {format === "zengin" ? "全銀フォーマットで書き出す" : "CSVで書き出す"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
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

function SummaryCards({
  format,
  csvRows,
  zenginRows,
  feeBurden,
}: {
  format: Format;
  csvRows: Array<{ department: string; vendorName: string; amountIncl: number; amountExcl: number; tax: number }>;
  zenginRows: Array<{ vendorName: string; billed: number; department: string; accountItem: string }>;
  feeBurden: "sender" | "recipient";
}) {
  if (format === "csv") {
    const totalIncl = csvRows.reduce((s, r) => s + r.amountIncl, 0);
    const totalExcl = csvRows.reduce((s, r) => s + r.amountExcl, 0);
    const totalTax = csvRows.reduce((s, r) => s + r.tax, 0);
    const byDept = groupSum(csvRows, (r) => r.department || "未設定", (r) => r.amountIncl);
    const byVendor = groupSum(csvRows, (r) => r.vendorName, (r) => r.amountIncl);
    return (
      <div className="grid md:grid-cols-3 gap-3">
        <Card title="出力対象の合計" lines={[`${csvRows.length}件`, `税込 ${yen(totalIncl)}`, `税抜 ${yen(totalExcl)} / 税 ${yen(totalTax)}`]} />
        <Card title="部門別（税込）" lines={byDept} />
        <Card title="業者別（税込）" lines={byVendor} />
      </div>
    );
  }
  const fees = zenginRows.reduce((s, r) => s + defaultTransferFee(r.billed), 0);
  const transfer = zenginRows.reduce((s, r) => {
    const fee = defaultTransferFee(r.billed);
    return s + (feeBurden === "recipient" ? Math.max(0, r.billed - fee) : r.billed);
  }, 0);
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <Card title="出力対象の合計" lines={[`${zenginRows.length}件`, `振込額 ${yen(transfer)}`, `手数料 ${yen(fees)}`]} />
      <Card title="部門別" lines={groupSum(zenginRows, (r) => r.department || "未設定", (r) => r.billed)} />
      <Card title="勘定科目別" lines={groupSum(zenginRows, (r) => r.accountItem || "未設定", (r) => r.billed)} />
    </div>
  );
}

function groupSum<T>(rows: T[], key: (r: T) => string, amount: (r: T) => number): string[] {
  const map = new Map<string, number>();
  for (const r of rows) map.set(key(r), (map.get(key(r)) ?? 0) + amount(r));
  return [...map.entries()].map(([k, v]) => `${k} ${yen(v)}`);
}

function Card({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="text-xs font-semibold text-muted-foreground mb-2">{title}</p>
      <div className="space-y-1 text-sm">
        {lines.length === 0 ? <p className="text-muted-foreground">—</p> : lines.map((l) => <p key={l}>{l}</p>)}
      </div>
    </div>
  );
}
