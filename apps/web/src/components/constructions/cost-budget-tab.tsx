"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { getCostBudget, saveCostBudget } from "@/lib/actions/cost-budgets";
import { getConstructionEstimate } from "@/lib/actions/constructions";
import { bulkCreateContractorOrders } from "@/lib/actions/contractor-orders";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, MessageSquare, Send, X, BookOpen, FileText, PencilLine, ChevronDown, PackageCheck, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BudgetApprovalActions } from "@/components/constructions/budget-approval-actions";

/* ─────────────────── types ─────────────────── */
type ContractorRow = {
  id: string;
  status: "発注済" | "未発注";
  name: string;
  work_type: string;
  budget: number;
  add_contracts: number[];
  management_budget: number;
  order_amount: number;
  add_orders: number[];
  monthly: Partial<Record<string, number>>;
};

const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
function colLabel(prefix: string, i: number) {
  return `${prefix}${CIRCLED[i] ?? String(i + 1)}`;
}

function normalizeRow(raw: Record<string, unknown>): ContractorRow {
  const add_contracts = Array.isArray(raw.add_contracts)
    ? (raw.add_contracts as number[]).map(Number)
    : [Number(raw.add_contract_1 ?? 0), Number(raw.add_contract_2 ?? 0)];
  const add_orders = Array.isArray(raw.add_orders)
    ? (raw.add_orders as number[]).map(Number)
    : [Number(raw.add_order_1 ?? 0), Number(raw.add_order_2 ?? 0), Number(raw.add_order_3 ?? 0)];
  return {
    id: String(raw.id),
    status: (raw.status as ContractorRow["status"]) ?? "未発注",
    name: String(raw.name ?? ""),
    work_type: String(raw.work_type ?? ""),
    budget: Number(raw.budget ?? 0),
    add_contracts,
    management_budget: Number(raw.management_budget ?? 0),
    order_amount: Number(raw.order_amount ?? 0),
    add_orders,
    monthly: (raw.monthly as ContractorRow["monthly"]) ?? {},
  };
}

function padRow(row: ContractorRow, contractCols: number, orderCols: number): ContractorRow {
  const add_contracts = [...row.add_contracts];
  while (add_contracts.length < contractCols) add_contracts.push(0);
  const add_orders = [...row.add_orders];
  while (add_orders.length < orderCols) add_orders.push(0);
  return { ...row, add_contracts, add_orders, monthly: { ...row.monthly } };
}


/* ─────────────────── helpers ─────────────────── */
function getMonths(startYYYYMM: string): string[] {
  const months: string[] = [];
  const [y, m] = startYYYYMM.split("-").map(Number);
  for (let i = 0; i < 12; i++) {
    const d = new Date(y, m - 1 + i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}
function monthLabel(yyyymm: string) {
  return `${Number(yyyymm.split("-")[1])}月`;
}
function fmtView(n: number): string {
  return n === 0 ? "" : n.toLocaleString();
}
function fmtAlways(n: number): string {
  return n.toLocaleString();
}
function compute(row: ContractorRow) {
  const budget_total = row.budget + row.add_contracts.reduce((s, v) => s + v, 0);
  const confirmed    = row.order_amount + row.add_orders.reduce((s, v) => s + v, 0);
  const budget_rem   = budget_total - confirmed;
  const total_billed = Object.values(row.monthly).reduce((s: number, v) => s + (v ?? 0), 0);
  const billing_rem  = confirmed - total_billed;
  return { budget_total, confirmed, budget_rem, total_billed, billing_rem };
}
function newEmptyRow(contractCols = 2, orderCols = 3): ContractorRow {
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    status: "未発注", name: "", work_type: "",
    budget: 0,
    add_contracts: Array(contractCols).fill(0),
    management_budget: 0,
    order_amount: 0,
    add_orders: Array(orderCols).fill(0),
    monthly: {},
  };
}

/* ─────────────────── small input components ─────────────────── */
function NumInput({
  value, onChange, bg = "", placeholder = "",
}: {
  value: number; onChange: (v: number) => void; bg?: string; placeholder?: string;
}) {
  return (
    <input
      type="number"
      min={0}
      value={value === 0 ? "" : value}
      onChange={e => onChange(Math.max(0, Number(e.target.value) || 0))}
      placeholder={placeholder}
      className={cn(
        "w-full text-right text-xs tabular-nums bg-transparent",
        "border-0 outline-none focus:ring-1 focus:ring-[#6BC9B3] focus:bg-white focus:rounded px-1 py-0.5",
        "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
        bg,
      )}
    />
  );
}
function TextInput({
  value, onChange, placeholder = "",
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full text-left text-xs bg-transparent",
        "border-0 outline-none focus:ring-1 focus:ring-[#6BC9B3] focus:bg-white focus:rounded px-1 py-0.5",
      )}
    />
  );
}

/* ─────────────────── comment types ─────────────────── */
type CellComment = {
  id: string;
  cellKey: string; // "{rowId}:{colName}"
  author: string;
  avatarInitial: string;
  avatarColor: string;
  text: string;
  createdAt: string;
};

const AVATAR_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-rose-500",
  "bg-amber-500", "bg-emerald-500", "bg-sky-500",
];

function getAvatarColor(author: string) {
  const idx = author.split("").reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

/* ── セルコメントポップオーバー ── */
function CommentPopover({
  cellKey, comments, onAdd, onClose, anchorRect,
}: {
  cellKey: string;
  comments: CellComment[];
  onAdd: (cellKey: string, text: string) => void;
  onClose: () => void;
  anchorRect: DOMRect | null;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const style: React.CSSProperties = anchorRect
    ? { position: "fixed", top: anchorRect.bottom + 6, left: anchorRect.left, zIndex: 9999 }
    : { position: "fixed", top: "40%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 9999 };

  return (
    <div
      ref={ref}
      style={style}
      className="w-72 bg-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.18),0_2px_8px_rgba(0,0,0,0.10)] border border-gray-100 overflow-hidden"
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
        <span className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />コメント
        </span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* コメント一覧 */}
      <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
        {comments.length === 0 ? (
          <p className="text-[11px] text-gray-400 text-center py-4">まだコメントはありません</p>
        ) : (
          comments.map(c => (
            <div key={c.id} className="px-3 py-2.5 flex gap-2">
              <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5", c.avatarColor)}>
                {c.avatarInitial}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-semibold text-gray-700">{c.author}</span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">{c.createdAt}</span>
                </div>
                <p className="text-xs text-gray-600 mt-0.5 leading-relaxed whitespace-pre-wrap">{c.text}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 入力欄 */}
      <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/50 flex gap-2 items-end">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (text.trim()) { onAdd(cellKey, text.trim()); setText(""); }
            }
          }}
          placeholder="コメントを入力… (Enter で送信)"
          rows={2}
          className="flex-1 text-xs resize-none rounded-lg border border-gray-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
        />
        <button
          onClick={() => { if (text.trim()) { onAdd(cellKey, text.trim()); setText(""); } }}
          disabled={!text.trim()}
          className="p-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ── コメントアイコン付きセルラッパー ── */
function CommentableCell({
  cellKey, comments, onOpenPopover, commentMode, children, className,
}: {
  cellKey: string;
  comments: CellComment[];
  onOpenPopover: (cellKey: string, rect: DOMRect) => void;
  commentMode?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const cellRef = useRef<HTMLTableCellElement>(null);
  const hasComments = comments.length > 0;

  function handleClick() {
    if (commentMode && cellRef.current) {
      onOpenPopover(cellKey, cellRef.current.getBoundingClientRect());
    }
  }

  return (
    <td
      ref={cellRef}
      onClick={handleClick}
      className={cn(
        "relative group/cell",
        commentMode && "hover:bg-blue-50/40",
        className
      )}
    >
      {children}
      {/* コメントバブル（コメントあり） */}
      {hasComments && (
        <button
          onClick={e => {
            e.stopPropagation();
            cellRef.current && onOpenPopover(cellKey, cellRef.current.getBoundingClientRect());
          }}
          className="absolute -top-2.5 -right-2 z-10 flex items-center"
          style={{ pointerEvents: "auto" }}
        >
          {comments.slice(0, 2).map((c, i) => (
            <div
              key={c.id}
              className={cn(
                "h-5 w-5 rounded-full border-2 border-white text-[9px] font-bold text-white flex items-center justify-center",
                c.avatarColor,
                i > 0 ? "-ml-1.5" : "",
              )}
              style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.25))" }}
            >
              {c.avatarInitial}
            </div>
          ))}
          {comments.length > 2 && (
            <div className="-ml-1.5 h-5 w-5 rounded-full border-2 border-white bg-gray-400 text-[8px] font-bold text-white flex items-center justify-center"
              style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.25))" }}>
              +{comments.length - 2}
            </div>
          )}
        </button>
      )}
      {/* コメントモード時のホバーアイコン */}
      {commentMode && !hasComments && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 pointer-events-none">
          <MessageSquare className="h-3 w-3 text-blue-400" />
        </div>
      )}
      {/* 通常モード：ホバー時の小アイコン */}
      {!commentMode && !hasComments && (
        <button
          onClick={e => {
            e.stopPropagation();
            cellRef.current && onOpenPopover(cellKey, cellRef.current.getBoundingClientRect());
          }}
          className="absolute top-0.5 right-0.5 z-10 opacity-0 group-hover/cell:opacity-100 transition-opacity p-0.5 rounded hover:bg-gray-200/60"
        >
          <MessageSquare className="h-3 w-3 text-gray-400" />
        </button>
      )}
    </td>
  );
}


interface Props {
  constructionId: string;
  contractAmount?: number;
  periodStart?: string | null;
  initialOrders?: Array<{
    id: string;
    title: string;
    amount: number;
    status: string;
    work_content?: string | null;
    craftsman?: { name: string } | null;
  }>;
  estimates?: Array<{
    id: string;
    estimate_no: string;
    title: string | null;
    total: number;
  }>;
  changeOrders?: Array<{
    id: string;
    title: string;
    diff_amount: number;
  }>;
  authorName?: string;
  onNavigateToOrders?: (row?: { name: string; work_type: string; budget: number }) => void;
  onOrdersCreated?: () => void;
}

function mapEstimateToBudgetRows(
  categories: { id: string; name: string }[],
  items: {
    category_id: string | null;
    name: string;
    notes: string | null;
    cost_amount: number;
    selling_amount: number;
    is_text_row?: boolean | null;
  }[],
  /** 実行予算移行後は予備費（現場対応分・旧予備予備費）のみ明細側へ戻す（議事録） */
  reserveFee2Amount = 0,
): ContractorRow[] {
  const calcItems = items.filter((item) => !item.is_text_row);
  if (!calcItems.length && reserveFee2Amount <= 0) return [];
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const groups = new Map<string, { name: string; workTypes: Set<string>; budget: number; order_amount: number }>();

  for (const item of calcItems) {
    const contractor = item.notes?.trim() ?? "";
    const catName = item.category_id ? (catMap.get(item.category_id) ?? "") : "";
    const key = contractor || `cat:${item.category_id ?? item.name}`;
    const g = groups.get(key) ?? {
      name: contractor,
      workTypes: new Set<string>(),
      budget: 0,
      order_amount: 0,
    };
    if (catName) g.workTypes.add(catName);
    else if (item.name?.trim()) g.workTypes.add(item.name.trim());
    g.budget += Number(item.selling_amount || 0);
    g.order_amount += Number(item.cost_amount || 0);
    groups.set(key, g);
  }

  const rows = Array.from(groups.values()).map((g, i) => ({
    id: `est-row-${i}-${Date.now()}`,
    status: "未発注" as const,
    name: g.name,
    work_type: [...g.workTypes].join(" / ") || "—",
    budget: g.budget,
    add_contracts: [0, 0],
    management_budget: g.budget,
    order_amount: g.order_amount,
    add_orders: [0, 0, 0],
    monthly: {},
  }));

  // 予備費（現場対応分）を明細行として戻す。担当者が金額ベースで付け替え可能
  if (reserveFee2Amount > 0) {
    rows.push({
      id: `est-reserve2-${Date.now()}`,
      status: "未発注" as const,
      name: "",
      work_type: "予備費（現場対応分）",
      budget: 0,
      add_contracts: [0, 0],
      management_budget: 0,
      order_amount: reserveFee2Amount,
      add_orders: [0, 0, 0],
      monthly: {},
    });
  }

  return rows;
}

function mapOrdersToRows(orders: Props["initialOrders"]): ContractorRow[] {
  if (!orders?.length) return [];
  return orders.map((order) => ({
    id: order.id,
    status: (order.status === "approved" || order.status === "submitted" ? "発注済" : "未発注") as ContractorRow["status"],
    name: order.craftsman?.name ?? order.title,
    work_type: order.work_content ?? order.title,
    budget: Number(order.amount ?? 0),
    add_contracts: [0, 0],
    management_budget: Number(order.amount ?? 0),
    order_amount: Number(order.amount ?? 0),
    add_orders: [0, 0, 0],
    monthly: {},
  }));
}

export function CostBudgetTab({ constructionId, contractAmount: propAmount, periodStart, initialOrders, estimates = [], changeOrders = [], authorName = "ユーザー", onNavigateToOrders, onOrdersCreated }: Props) {
  const mappedRows = useMemo(() => mapOrdersToRows(initialOrders), [initialOrders]);
  const initialRows = mappedRows.length > 0 ? mappedRows : [];

  const [rows, setRows] = useState<ContractorRow[]>(() =>
    initialRows.map(r => padRow(r, 2, 3))
  );
  const [contractColCount, setContractColCount] = useState(2);
  const [orderColCount, setOrderColCount] = useState(3);
  const [comments, setComments] = useState<CellComment[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const defaultPeriod = periodStart?.slice(0, 7) ?? "2025-01";
  // 台帳独自の契約金額（見積参照時に見積合計へ同期 / 保存済み値を復元）
  const [ledgerContractAmount, setLedgerContractAmount] = useState<number | null>(null);
  const resolvedContractAmount =
    ledgerContractAmount ?? (propAmount && propAmount > 0 ? propAmount : 0);

  useEffect(() => {
    getCostBudget(constructionId).then((data) => {
      if (data?.rows?.length) {
        const normalized = data.rows.map((r) => normalizeRow(r as unknown as Record<string, unknown>));
        const cc = Math.max(2, ...normalized.map((r) => r.add_contracts.length));
        const oc = Math.max(3, ...normalized.map((r) => r.add_orders.length));
        setContractColCount(cc);
        setOrderColCount(oc);
        setRows(normalized.map((r) => padRow(r, cc, oc)));
        setComments(data.comments ?? []);
      }
      if (data && Number(data.contract_amount) > 0) {
        setLedgerContractAmount(Number(data.contract_amount));
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [constructionId]);

  const persist = useCallback(async (
    nextRows: ContractorRow[],
    nextComments: CellComment[],
    opts?: { silent?: boolean },
  ) => {
    setSaving(true);
    try {
      await saveCostBudget({
        constructionId,
        contractAmount: resolvedContractAmount,
        periodStart: defaultPeriod,
        rows: nextRows,
        comments: nextComments,
      });
      setSaved(true);
      if (!opts?.silent) toast.success("工事台帳を保存しました");
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }, [constructionId, resolvedContractAmount, defaultPeriod]);

  // 変更を検知して自動保存（デバウンス）
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!loaded) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void persist(rows, comments, { silent: true });
    }, 1200);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [rows, comments, loaded, persist]);

  /* ── 参照（見積もり / 追加変更から転記） ── */
  const [confirmReplaceRows, setConfirmReplaceRows] = useState<ContractorRow[] | null>(null);

  const applyEstimateRows = useCallback((newRows: ContractorRow[]) => {
    setRows(newRows.map((r) => padRow(r, contractColCount, orderColCount)));
    // 契約金額が未設定・見積合計と乖離している場合は見積合計（売値）に同期（No.16: 粗利異常値の防止）
    const estimateTotal = newRows.reduce((s, r) => s + Number(r.budget || 0), 0);
    if (estimateTotal > 0) {
      setLedgerContractAmount((prev) => {
        const current = prev ?? (propAmount && propAmount > 0 ? propAmount : 0);
        return current < estimateTotal ? estimateTotal : current;
      });
    }
    setSaved(false);
    toast.success("見積もりから工事台帳を作成しました");
  }, [contractColCount, orderColCount, propAmount]);

  const applyFromEstimate = useCallback(async (estimateId: string) => {
    const loadingId = toast.loading("見積もりを読み込み中...");
    try {
      const est = await getConstructionEstimate(estimateId);
      const newRows = mapEstimateToBudgetRows(
        (est.categories ?? []) as { id: string; name: string }[],
        (est.items ?? []) as {
          category_id: string | null;
          name: string;
          notes: string | null;
          cost_amount: number;
          selling_amount: number;
          is_text_row?: boolean | null;
        }[],
        Number((est as { reserve_fee_2_amount?: number | null }).reserve_fee_2_amount ?? 0),
      );
      toast.dismiss(loadingId);
      if (newRows.length === 0) {
        toast.error("見積もりに明細がありません");
        return;
      }
      if (rows.length > 0) {
        setConfirmReplaceRows(newRows);
      } else {
        applyEstimateRows(newRows);
      }
    } catch {
      toast.dismiss(loadingId);
      toast.error("見積もりの取得に失敗しました");
    }
  }, [rows.length, applyEstimateRows]);

  const handleReferenceChangeOrder = useCallback((co: { id: string; title: string; diff_amount: number }) => {
    setRows((prev) => [
      ...prev,
      padRow({
        ...newEmptyRow(contractColCount, orderColCount),
        work_type: co.title,
        add_contracts: [co.diff_amount, ...Array(Math.max(0, contractColCount - 1)).fill(0)],
        management_budget: co.diff_amount,
      }, contractColCount, orderColCount),
    ]);
    setSaved(false);
    toast.success(`追加変更「${co.title}」の差分（¥${co.diff_amount.toLocaleString()}）を追加しました`);
  }, [contractColCount, orderColCount]);

  /* ── 複数業者の一括発注 ── */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOrdering, setBulkOrdering] = useState(false);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectableRows = useMemo(
    () => rows.filter(r => r.status === "未発注" && r.name.trim() !== ""),
    [rows],
  );
  const allSelected = selectableRows.length > 0 && selectableRows.every(r => selectedIds.has(r.id));
  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      if (selectableRows.every(r => prev.has(r.id)) && selectableRows.length > 0) return new Set();
      return new Set(selectableRows.map(r => r.id));
    });
  }, [selectableRows]);

  const handleBulkOrder = useCallback(async () => {
    const targets = rows.filter(r => selectedIds.has(r.id));
    if (targets.length === 0) return;
    const unnamed = targets.filter(r => !r.name.trim());
    if (unnamed.length > 0) {
      toast.error("業者名が未入力の行が選択されています");
      return;
    }
    setBulkOrdering(true);
    try {
      const created = await bulkCreateContractorOrders(
        constructionId,
        targets.map(r => ({
          name: r.name,
          workType: r.work_type,
          amount: compute(r).budget_total,
        })),
      );
      const targetIds = new Set(targets.map(r => r.id));
      setRows(prev => prev.map(r => targetIds.has(r.id) ? { ...r, status: "発注済" as const } : r));
      setSelectedIds(new Set());
      setSaved(false);
      onOrdersCreated?.();
      toast.success(`${created.length}件の発注書ドラフトを作成しました`, {
        description: "発注書・請書タブから「申請する」で承認申請できます",
        action: onNavigateToOrders
          ? { label: "発注書タブへ", onClick: () => onNavigateToOrders() }
          : undefined,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "一括発注に失敗しました");
    } finally {
      setBulkOrdering(false);
    }
  }, [rows, selectedIds, constructionId, onNavigateToOrders, onOrdersCreated]);

  const [openPopover, setOpenPopover] = useState<{ cellKey: string; rect: DOMRect } | null>(null);
  const [commentMode, setCommentMode] = useState(false);

  const cellComments = useCallback(
    (cellKey: string) => comments.filter(c => c.cellKey === cellKey),
    [comments]
  );
  const handleAddComment = useCallback((cellKey: string, text: string) => {
    const author = authorName;
    setComments(prev => [...prev, {
      id: `c-${Date.now()}`,
      cellKey,
      author,
      avatarInitial: author.charAt(0),
      avatarColor: getAvatarColor(author),
      text,
      createdAt: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
    }]);
  }, [authorName]);
  const handleOpenPopover = useCallback((cellKey: string, rect: DOMRect) => {
    setOpenPopover(prev => prev?.cellKey === cellKey ? null : { cellKey, rect });
  }, []);

  // コメントモード時：テーブル全体のクリックをキャッチ
  const handleTableClick = useCallback((e: React.MouseEvent<HTMLTableElement>) => {
    if (!commentMode) return;
    // 最も近い td または th を探す
    const cell = (e.target as HTMLElement).closest("td, th") as HTMLTableCellElement | null;
    if (!cell) return;
    const row = cell.closest("tr") as HTMLTableRowElement | null;
    if (!row) return;
    const tbody = cell.closest("tbody");
    const thead = cell.closest("thead");
    const section = tbody ? "body" : thead ? "head" : "foot";
    const rowIdx = row.rowIndex;
    const cellIdx = cell.cellIndex;
    const cellKey = `${section}:r${rowIdx}:c${cellIdx}`;
    const rect = cell.getBoundingClientRect();
    setOpenPopover(prev => prev?.cellKey === cellKey ? null : { cellKey, rect });
  }, [commentMode]);

  const contractAmount = resolvedContractAmount;

  const months = getMonths(defaultPeriod);

  /* ── row update helpers ── */
  const updateField = useCallback(
    <K extends keyof ContractorRow>(id: string, field: K, value: ContractorRow[K]) => {
      setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
      setSaved(false);
    }, []
  );
  const updateContractCol = useCallback((id: string, colIdx: number, value: number) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const add_contracts = [...r.add_contracts];
      add_contracts[colIdx] = value;
      return { ...r, add_contracts };
    }));
    setSaved(false);
  }, []);
  const updateOrderCol = useCallback((id: string, colIdx: number, value: number) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const add_orders = [...r.add_orders];
      add_orders[colIdx] = value;
      return { ...r, add_orders };
    }));
    setSaved(false);
  }, []);
  const updateMonthly = useCallback((id: string, month: string, value: number) => {
    setRows(prev => prev.map(r =>
      r.id === id ? { ...r, monthly: { ...r.monthly, [month]: value } } : r
    ));
    setSaved(false);
  }, []);
  const addRow = () => {
    setRows(prev => [...prev, newEmptyRow(contractColCount, orderColCount)]);
    setSaved(false);
  };
  const addContractCol = () => {
    setContractColCount(c => c + 1);
    setRows(prev => prev.map(r => ({ ...r, add_contracts: [...r.add_contracts, 0] })));
    setSaved(false);
  };
  const addOrderCol = () => {
    setOrderColCount(c => c + 1);
    setRows(prev => prev.map(r => ({ ...r, add_orders: [...r.add_orders, 0] })));
    setSaved(false);
  };
  const deleteRow = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
    setSelectedIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setSaved(false);
  };
  const toggleStatus = (id: string) =>
    setRows(prev => prev.map(r =>
      r.id === id ? { ...r, status: r.status === "発注済" ? "未発注" : "発注済" } : r
    ));

  /* ── totals ── */
  const totalColSpan = 12 + contractColCount + orderColCount + months.length;

  const totals = useMemo(() => {
    const t = {
      budget: 0,
      add_contracts: Array(contractColCount).fill(0) as number[],
      budget_total: 0, management_budget: 0,
      order_amount: 0,
      add_orders: Array(orderColCount).fill(0) as number[],
      confirmed: 0, budget_rem: 0, billing_rem: 0,
      monthly: {} as Record<string, number>,
    };
    for (const row of rows) {
      const c = compute(row);
      t.budget += row.budget;
      row.add_contracts.forEach((v, i) => { t.add_contracts[i] = (t.add_contracts[i] ?? 0) + v; });
      t.budget_total += c.budget_total;
      t.management_budget += row.management_budget;
      t.order_amount += row.order_amount;
      row.add_orders.forEach((v, i) => { t.add_orders[i] = (t.add_orders[i] ?? 0) + v; });
      t.confirmed += c.confirmed;
      t.budget_rem += c.budget_rem;
      t.billing_rem += c.billing_rem;
      for (const [k, v] of Object.entries(row.monthly))
        t.monthly[k] = (t.monthly[k] ?? 0) + (v ?? 0);
    }
    return t;
  }, [rows, contractColCount, orderColCount]);

  const gpBudget    = contractAmount - totals.budget_total;
  const gpConfirmed = contractAmount - totals.confirmed;
  const grBudget    = contractAmount > 0 ? gpBudget    / contractAmount * 100 : 0;
  const grConfirmed = contractAmount > 0 ? gpConfirmed / contractAmount * 100 : 0;

  /* ── style helpers ── */
  const th  = "px-2 py-1.5 text-center text-[11px] font-semibold whitespace-nowrap border-r border-b border-gray-200";
  const tdc = "px-1 py-1 text-right text-xs tabular-nums whitespace-nowrap border-r border-b border-gray-200";
  const tdl = "px-1 py-1 text-left  text-xs whitespace-nowrap border-r border-b border-gray-200";
  const tcc = "px-1 py-1 text-center text-xs whitespace-nowrap border-r border-b border-gray-200";

  return (
    <div className="space-y-3">
      {/* コメントポップオーバー */}
      {openPopover && (
        <CommentPopover
          cellKey={openPopover.cellKey}
          comments={cellComments(openPopover.cellKey)}
          onAdd={handleAddComment}
          onClose={() => setOpenPopover(null)}
          anchorRect={openPopover.rect}
        />
      )}
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">工事原価管理表</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            緑色のセルは自動計算 — 白いセルをクリックして入力できます
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 選択業者に一括発注 */}
          {selectedIds.size > 0 && (
            <Button
              size="sm"
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => void handleBulkOrder()}
              disabled={bulkOrdering}
            >
              {bulkOrdering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PackageCheck className="h-3.5 w-3.5" />}
              選択業者に一括発注（{selectedIds.size}件）
            </Button>
          )}
          {/* コメントモードトグル */}
          <button
            onClick={() => { setCommentMode(v => !v); setOpenPopover(null); }}
            className={cn(
              "flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-all duration-150",
              commentMode
                ? "bg-blue-500 text-white shadow-[0_2px_6px_rgba(59,130,246,0.45),inset_0_1px_0_rgba(255,255,255,0.20)]"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {commentMode ? "コメント中..." : "コメント"}
            {comments.length > 0 && (
              <span className={cn(
                "ml-0.5 h-4 w-4 rounded-full text-[10px] font-bold flex items-center justify-center",
                commentMode ? "bg-white text-blue-600" : "bg-blue-500 text-white"
              )}>
                {comments.length}
              </span>
            )}
          </button>
          {/* 参照（見積もり / 追加変更から工事台帳を作成・反映） */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <BookOpen className="h-3.5 w-3.5" />
                参照
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 max-h-80 overflow-y-auto">
              <DropdownMenuLabel>参照元を選択</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal py-1">見積もり</DropdownMenuLabel>
              {estimates.length === 0 ? (
                <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                  見積もりがありません
                </DropdownMenuItem>
              ) : (
                estimates.map((est) => (
                  <DropdownMenuItem
                    key={est.id}
                    onSelect={() => void applyFromEstimate(est.id)}
                    className="gap-2 py-2"
                  >
                    <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    <span className="flex-1 truncate text-sm">
                      {est.estimate_no}
                      {est.title ? `（${est.title}）` : ""}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                      ¥{(est.total ?? 0).toLocaleString()}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal py-1">追加変更</DropdownMenuLabel>
              {changeOrders.length === 0 ? (
                <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                  追加変更がありません
                </DropdownMenuItem>
              ) : (
                changeOrders.map((co) => (
                  <DropdownMenuItem
                    key={co.id}
                    onSelect={() => handleReferenceChangeOrder(co)}
                    className="gap-2 py-2"
                  >
                    <PencilLine className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                    <span className="flex-1 truncate text-sm">{co.title}</span>
                    <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                      {co.diff_amount >= 0 ? "+" : ""}¥{co.diff_amount.toLocaleString()}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="text-xs text-muted-foreground min-w-[64px] text-right">
            {saving ? "保存中..." : saved ? "自動保存済み" : ""}
          </span>
        </div>
      </div>

      {/* 粗利承認: 会社指定粗利＋予備費に未達なら上長承認 */}
      {contractAmount > 0 && (
        <div className="flex items-center justify-end rounded-md border border-amber-100 bg-amber-50/40 px-3 py-2">
          <BudgetApprovalActions constructionId={constructionId} grossProfitRate={grBudget} />
        </div>
      )}

      {/* 見積もり再参照時の確認（既存データ削除） */}
      <AlertDialog open={!!confirmReplaceRows} onOpenChange={(o) => { if (!o) setConfirmReplaceRows(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>既存の工事台帳を置き換えますか？</AlertDialogTitle>
            <AlertDialogDescription>
              すでに入力済みの行があります。見積もりから再作成すると現在の行は削除され、見積もりの内容に置き換わります。この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmReplaceRows) applyEstimateRows(confirmReplaceRows);
                setConfirmReplaceRows(null);
              }}
            >
              置き換える
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* テーブル */}
      <div className={cn(
        "overflow-x-auto rounded-lg border border-gray-200 shadow-sm transition-all",
        commentMode && "ring-2 ring-blue-400 ring-offset-1"
      )}
        style={{ cursor: commentMode ? "crosshair" : undefined }}
      >
        <table className="border-collapse text-sm" style={{ minWidth: `${1230 + contractColCount * 92 + orderColCount * 92 + months.length * 78}px` }} onClick={handleTableClick}>
          <colgroup>
            <col style={{ width: 30 }} />
            <col style={{ width: 32 }} /><col style={{ width: 62 }} />
            <col style={{ width: 130 }} /><col style={{ width: 115 }} />
            <col style={{ width: 92 }} />
            {Array.from({ length: contractColCount }).map((_, i) => <col key={`cc-${i}`} style={{ width: 92 }} />)}
            <col style={{ width: 100 }} /><col style={{ width: 92 }} />
            <col style={{ width: 92 }} />
            {Array.from({ length: orderColCount }).map((_, i) => <col key={`oc-${i}`} style={{ width: 92 }} />)}
            <col style={{ width: 92 }} /><col style={{ width: 86 }} />
            {months.map(m => <col key={m} style={{ width: 78 }} />)}
            <col style={{ width: 86 }} />
            <col style={{ width: 48 }} />
          </colgroup>

          <thead>
            <tr>
              <th colSpan={5} className={cn(th, "bg-gray-100 text-left text-gray-600")}>基本情報</th>
              <th colSpan={1 + contractColCount} className={cn(th, "bg-blue-100 text-blue-800 relative group/add-budget")}>
                <span>実行予算・追加契約</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); addContractCol(); }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center h-5 w-5 rounded bg-blue-600 text-white opacity-0 group-hover/add-budget:opacity-100 transition-opacity hover:bg-blue-700 shadow-sm"
                  title="追加契約列を追加"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </th>
              <th className={cn(th, "bg-green-100 text-green-800")}>合算</th>
              <th className={cn(th, "bg-violet-100 text-violet-800")}>管理</th>
              <th colSpan={1 + orderColCount} className={cn(th, "bg-amber-100 text-amber-800 relative group/add-order")}>
                <span>発注</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); addOrderCol(); }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center h-5 w-5 rounded bg-amber-600 text-white opacity-0 group-hover/add-order:opacity-100 transition-opacity hover:bg-amber-700 shadow-sm"
                  title="追加発注列を追加"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </th>
              <th className={cn(th, "bg-sky-100 text-sky-800")}>確定</th>
              <th className={cn(th, "bg-rose-100 text-rose-700")}>予算残</th>
              <th colSpan={months.length} className={cn(th, "bg-sky-50 text-sky-700")}>請求（月次入力）</th>
              <th className={cn(th, "bg-rose-100 text-rose-700")}>請求残</th>
              <th className={cn(th, "bg-gray-100")} />
            </tr>
            <tr className="bg-gray-50">
              <th className={cn(th, "bg-gray-100")} title="一括発注する業者を選択">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  disabled={selectableRows.length === 0}
                  className="accent-blue-600 cursor-pointer"
                />
              </th>
              <th className={cn(th, "bg-gray-100")}>#</th>
              <th className={cn(th, "bg-gray-100")}>発注</th>
              <th className={cn(th, "bg-gray-100 text-left")}>業者名</th>
              <th className={cn(th, "bg-gray-100 text-left")}>工種</th>
              <th className={cn(th, "bg-blue-50")}>実行予算</th>
              {Array.from({ length: contractColCount }).map((_, i) => (
                <th key={`ch-${i}`} className={cn(th, "bg-blue-50")}>{colLabel("追加契約", i)}</th>
              ))}
              <th className={cn(th, "bg-green-50 text-[10px] leading-tight")}>追加含む<br/>実行予算</th>
              <th className={cn(th, "bg-violet-50")}>管理用予算</th>
              <th className={cn(th, "bg-amber-50")}>発注額</th>
              {Array.from({ length: orderColCount }).map((_, i) => (
                <th key={`oh-${i}`} className={cn(th, "bg-amber-50")}>{colLabel("追加発注", i)}</th>
              ))}
              <th className={cn(th, "bg-sky-100")}>確定額</th>
              <th className={cn(th, "bg-rose-50")}>予算残</th>
              {months.map(m => (
                <th key={m} className={cn(th, "bg-sky-50")}>{monthLabel(m)}</th>
              ))}
              <th className={cn(th, "bg-rose-100")}>請求残</th>
              <th className={cn(th, "bg-gray-100")} />
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={totalColSpan} className="py-12 text-center text-sm text-muted-foreground">
                  データがありません。<br />
                  <span className="text-xs">右上の「参照」から見積もりを選択して工事台帳を作成できます。</span>
                </td>
              </tr>
            )}
            {rows.map((row, idx) => {
              const c = compute(row);
              return (
                <tr key={row.id} className={cn("hover:bg-gray-50/40 transition-colors group/row", commentMode && "hover:bg-blue-50/30", selectedIds.has(row.id) && "bg-blue-50/50")}
                  onClick={commentMode ? undefined : undefined}
                >
                  {/* 一括発注の選択チェックボックス */}
                  <td className={cn(tcc, "bg-gray-50")}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => toggleSelected(row.id)}
                      disabled={!row.name.trim()}
                      title={row.name.trim() ? "一括発注の対象に選択" : "業者名を入力すると選択できます"}
                      className="accent-blue-600 cursor-pointer disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className={cn(tcc, "bg-gray-50 text-gray-400 text-[11px]")}>{idx + 1}</td>
                  {/* 発注ステータス / 発注アクション */}
                  <td className={cn(tcc)}>
                    {row.status === "未発注" && onNavigateToOrders ? (
                      <button
                        onClick={() => onNavigateToOrders({ name: row.name, work_type: row.work_type, budget: row.budget })}
                        className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold leading-tight cursor-pointer transition-colors bg-blue-500 text-white hover:bg-blue-600"
                        title="発注書・請書タブへ移動"
                      >
                        発注
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleStatus(row.id)}
                        className={cn(
                          "inline-block px-1.5 py-0.5 rounded text-[10px] font-bold leading-tight cursor-pointer transition-colors",
                          row.status === "発注済"
                            ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        )}
                      >
                        {row.status}
                      </button>
                    )}
                  </td>
                  {/* 施工業者名 */}
                  <td className={cn(tdl, "font-medium")}>
                    <TextInput
                      value={row.name}
                      onChange={v => updateField(row.id, "name", v)}
                      placeholder="業者名"
                    />
                  </td>
                  {/* 工種 */}
                  <td className={cn(tdl)}>
                    <TextInput
                      value={row.work_type}
                      onChange={v => updateField(row.id, "work_type", v)}
                      placeholder="工種"
                    />
                  </td>
                  {/* 実行予算 */}
                  <td className={cn(tdc, "bg-blue-50/30")}>
                    <NumInput value={row.budget} onChange={v => updateField(row.id, "budget", v)} />
                  </td>
                  {Array.from({ length: contractColCount }).map((_, i) => (
                    <td key={`rc-${i}`} className={cn(tdc, "bg-blue-50/30")}>
                      <NumInput value={row.add_contracts[i] ?? 0} onChange={v => updateContractCol(row.id, i, v)} />
                    </td>
                  ))}
                  {/* 追加含む実行予算（自動計算） */}
                  <td className={cn(tdc, "bg-green-50 font-semibold text-gray-800")}>
                    {fmtAlways(c.budget_total)}
                  </td>
                  {/* 管理用予算 */}
                  <td className={cn(tdc, "bg-violet-50/40")}>
                    <NumInput value={row.management_budget} onChange={v => updateField(row.id, "management_budget", v)} />
                  </td>
                  {/* 発注 */}
                  <CommentableCell cellKey={`${row.id}:order_amount`} comments={cellComments(`${row.id}:order_amount`)} onOpenPopover={handleOpenPopover} commentMode={commentMode} className={cn(tdc, "bg-amber-50/40")}>
                    <NumInput value={row.order_amount} onChange={v => updateField(row.id, "order_amount", v)} />
                  </CommentableCell>
                  {Array.from({ length: orderColCount }).map((_, i) => (
                    <CommentableCell key={`ro-${i}`} cellKey={`${row.id}:add_order_${i}`} comments={cellComments(`${row.id}:add_order_${i}`)} onOpenPopover={handleOpenPopover} commentMode={commentMode} className={cn(tdc, "bg-amber-50/40")}>
                      <NumInput value={row.add_orders[i] ?? 0} onChange={v => updateOrderCol(row.id, i, v)} />
                    </CommentableCell>
                  ))}
                  {/* 確定額（自動計算） */}
                  <td className={cn(tdc, "bg-sky-100/50 font-semibold")}>{fmtView(c.confirmed)}</td>
                  {/* 予算残（自動計算） */}
                  <td className={cn(tdc,
                    c.budget_rem < 0  ? "bg-rose-50 text-red-600 font-semibold" :
                    c.budget_rem > 0  ? "bg-green-50 text-emerald-700" : ""
                  )}>
                    {c.budget_total > 0 ? fmtAlways(c.budget_rem) : ""}
                  </td>
                  {/* 月次請求 */}
                  {months.map(m => (
                    <CommentableCell key={m} cellKey={`${row.id}:${m}`} comments={cellComments(`${row.id}:${m}`)} onOpenPopover={handleOpenPopover} commentMode={commentMode} className={cn(tdc, "bg-sky-50/20")}>
                      <NumInput
                        value={row.monthly[m] ?? 0}
                        onChange={v => updateMonthly(row.id, m, v)}
                      />
                    </CommentableCell>
                  ))}
                  {/* 請求残（自動計算） */}
                  <td className={cn(tdc,
                    c.billing_rem > 0 ? "bg-rose-50 text-red-600 font-semibold" :
                    c.billing_rem < 0 ? "bg-green-50 text-emerald-700 font-semibold" : ""
                  )}>
                    {c.confirmed > 0 ? fmtAlways(c.billing_rem) : ""}
                  </td>
                  {/* 削除 */}
                  <td className={cn(tcc, "bg-gray-50/60")}>
                    <button
                      onClick={() => deleteRow(row.id)}
                      className="opacity-0 group-hover/row:opacity-100 transition-opacity text-gray-300 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {/* 行を追加 */}
            <tr className="border-b border-gray-200">
              <td colSpan={totalColSpan} className="py-1.5 px-3 bg-gray-50/60">
                <button
                  onClick={addRow}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#4aab96] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  行を追加
                </button>
              </td>
            </tr>

            {/* スペーサー */}
            <tr className="bg-gray-100 border-b border-gray-300">
              <td colSpan={totalColSpan} className="h-1.5" />
            </tr>

            {/* 合計行 */}
            <tr className="bg-blue-50/20 font-semibold border-b-2 border-gray-300">
              <td colSpan={3} className={cn(tcc, "bg-gray-100")} />
              <td colSpan={2} className={cn(tdl, "bg-gray-50 font-bold")}>合計</td>
              <td className={cn(tdc, "bg-blue-50 font-bold")}>{fmtAlways(totals.budget)}</td>
              {totals.add_contracts.map((v, i) => (
                <td key={`tc-${i}`} className={cn(tdc, "bg-blue-50 font-bold")}>{fmtView(v)}</td>
              ))}
              <td className={cn(tdc, "bg-green-100 font-bold")}>{fmtAlways(totals.budget_total)}</td>
              <td className={cn(tdc, "bg-violet-50 font-bold")}>{fmtView(totals.management_budget)}</td>
              <td className={cn(tdc, "bg-amber-50 font-bold")}>{fmtView(totals.order_amount)}</td>
              {totals.add_orders.map((v, i) => (
                <td key={`to-${i}`} className={cn(tdc, "bg-amber-50 font-bold")}>{fmtView(v)}</td>
              ))}
              <td className={cn(tdc, "bg-sky-100 font-bold")}>{fmtView(totals.confirmed)}</td>
              <td className={cn(tdc, totals.budget_rem < 0 ? "bg-rose-100 text-red-600 font-bold" : "bg-green-100 text-emerald-700 font-bold")}>
                {fmtAlways(totals.budget_rem)}
              </td>
              {months.map(m => (
                <td key={m} className={cn(tdc, "bg-sky-50 font-bold")}>{fmtView(totals.monthly[m] ?? 0)}</td>
              ))}
              <td className={cn(tdc, totals.billing_rem > 0 ? "bg-rose-100 text-red-600 font-bold" : "bg-green-100 text-emerald-700 font-bold")}>
                {totals.billing_rem !== 0 ? fmtAlways(totals.billing_rem) : ""}
              </td>
              <td className={cn(tcc, "bg-gray-100")} />
            </tr>
          </tbody>

          {/* ── サマリーフッター ── */}
          <tfoot className="border-t-2 border-gray-400">
            <tr className="bg-gray-50 text-[11px] text-gray-500">
              <td colSpan={5} className={cn(tdl, "bg-gray-100")} />
              <td colSpan={1 + contractColCount + 1} className={cn(tdc, "text-center bg-blue-50/60 font-semibold text-blue-700")}>実行予算（暫定）</td>
              <td className={cn(tdc, "bg-violet-50")} />
              <td colSpan={1 + orderColCount} className={cn(tdc, "text-center bg-amber-50 font-semibold text-amber-700")}>暫定合計</td>
              <td colSpan={2} className={cn(tdc, "text-center bg-sky-50 font-semibold text-sky-700")}>確定額</td>
              <td colSpan={months.length + 1} className={cn(tdc)} />
            </tr>
            {[
              { label: "契約金額",   vBudget: contractAmount, vConfirmed: contractAmount, isRate: false },
              { label: "工事粗利額", vBudget: gpBudget,       vConfirmed: gpConfirmed,   isRate: false },
              { label: "工事粗利率", vBudget: grBudget,       vConfirmed: grConfirmed,   isRate: true  },
            ].map(({ label, vBudget, vConfirmed, isRate }) => (
              <tr key={label} className="bg-white border-b border-gray-200">
                <td colSpan={5} className={cn(tdl, "bg-gray-100 font-semibold text-gray-700")}>{label}</td>
                <td colSpan={1 + contractColCount + 1} className={cn(tdc, "bg-blue-50 font-bold",
                  !isRate && vBudget < 0 ? "text-red-600" : !isRate ? "text-gray-800" : vBudget < 0 ? "text-red-600" : "text-emerald-700"
                )}>
                  {isRate ? `${vBudget.toFixed(1)}%` : fmtAlways(vBudget)}
                </td>
                <td className={cn(tdc, "bg-violet-50")} />
                <td colSpan={1 + orderColCount} className={cn(tdc, "bg-amber-50 text-gray-400")}>—</td>
                <td colSpan={2} className={cn(tdc, "bg-sky-50 font-bold",
                  !isRate && vConfirmed < 0 ? "text-red-600" : !isRate ? "text-gray-800" : vConfirmed < 0 ? "text-red-600" : "text-emerald-700"
                )}>
                  {isRate ? `${vConfirmed.toFixed(1)}%` : fmtAlways(vConfirmed)}
                </td>
                <td colSpan={months.length + 1} className={cn(tdc)} />
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
    </div>
  );
}
