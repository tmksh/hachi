"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { getCostBudget, saveCostBudget } from "@/lib/actions/cost-budgets";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Trash2, Plus, MessageSquare, Send, X } from "lucide-react";

/* ─────────────────── types ─────────────────── */
type ContractorRow = {
  id: string;
  status: "発注済" | "未発注";
  name: string;
  work_type: string;
  budget: number;
  add_contract_1: number;
  add_contract_2: number;
  management_budget: number;
  order_amount: number;
  add_order_1: number;
  add_order_2: number;
  add_order_3: number;
  monthly: Partial<Record<string, number>>;
};

type Pattern = { contract_amount: number; rows: ContractorRow[] };

/* ─────────────────── mock data (3パターン) ─────────────────── */
const PATTERNS: Pattern[] = [
  // Pattern A: 外構・植栽工事
  {
    contract_amount: 397_900,
    rows: [
      { id: "a1", status: "発注済", name: "田中建設", work_type: "外構工事",
        budget: 68_500, add_contract_1: 0, add_contract_2: 0, management_budget: 80_000,
        order_amount: 10_000, add_order_1: 20_000, add_order_2: 0, add_order_3: 0,
        monthly: { "2026-04": 0, "2026-05": 0, "2026-06": 30_000, "2026-07": 0 } },
      { id: "a2", status: "発注済", name: "山田内装", work_type: "外構工事2",
        budget: 150_000, add_contract_1: 0, add_contract_2: 0, management_budget: 0,
        order_amount: 0, add_order_1: 0, add_order_2: 0, add_order_3: 0, monthly: {} },
      { id: "a3", status: "発注済", name: "伊藤造園", work_type: "植栽工事",
        budget: 122_500, add_contract_1: 0, add_contract_2: 0, management_budget: 0,
        order_amount: 0, add_order_1: 0, add_order_2: 0, add_order_3: 0, monthly: {} },
    ],
  },
  // Pattern B: 内装リフォーム
  {
    contract_amount: 620_000,
    rows: [
      { id: "b1", status: "発注済", name: "佐藤内装工業", work_type: "内装仕上工事",
        budget: 250_000, add_contract_1: 30_000, add_contract_2: 0, management_budget: 300_000,
        order_amount: 250_000, add_order_1: 25_000, add_order_2: 0, add_order_3: 0,
        monthly: { "2025-10": 120_000, "2025-11": 100_000, "2025-12": 55_000 } },
      { id: "b2", status: "発注済", name: "田辺電設", work_type: "電気工事",
        budget: 85_000, add_contract_1: 0, add_contract_2: 0, management_budget: 0,
        order_amount: 85_000, add_order_1: 0, add_order_2: 0, add_order_3: 0,
        monthly: { "2025-11": 85_000 } },
      { id: "b3", status: "未発注", name: "武田設備", work_type: "管工事（設備）",
        budget: 120_000, add_contract_1: 0, add_contract_2: 0, management_budget: 140_000,
        order_amount: 100_000, add_order_1: 0, add_order_2: 0, add_order_3: 0,
        monthly: { "2025-12": 50_000, "2026-01": 50_000 } },
    ],
  },
  // Pattern C: 新築住宅
  {
    contract_amount: 6_500_000,
    rows: [
      { id: "c1", status: "発注済", name: "基礎工業㈱", work_type: "基礎工事",
        budget: 1_200_000, add_contract_1: 0, add_contract_2: 0, management_budget: 1_300_000,
        order_amount: 1_200_000, add_order_1: 0, add_order_2: 0, add_order_3: 0,
        monthly: { "2025-08": 600_000, "2025-09": 600_000 } },
      { id: "c2", status: "発注済", name: "木造建設", work_type: "木工事",
        budget: 3_500_000, add_contract_1: 200_000, add_contract_2: 50_000, management_budget: 3_900_000,
        order_amount: 3_200_000, add_order_1: 150_000, add_order_2: 0, add_order_3: 0,
        monthly: { "2025-09": 1_000_000, "2025-10": 1_500_000, "2025-11": 850_000 } },
      { id: "c3", status: "発注済", name: "屋根専門工業", work_type: "屋根・板金工事",
        budget: 480_000, add_contract_1: 0, add_contract_2: 0, management_budget: 0,
        order_amount: 480_000, add_order_1: 0, add_order_2: 0, add_order_3: 0,
        monthly: { "2025-10": 480_000 } },
      { id: "c4", status: "未発注", name: "関東塗装", work_type: "塗装工事",
        budget: 320_000, add_contract_1: 0, add_contract_2: 0, management_budget: 350_000,
        order_amount: 280_000, add_order_1: 0, add_order_2: 0, add_order_3: 0,
        monthly: { "2025-12": 150_000, "2026-01": 130_000 } },
    ],
  },
];

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
  const budget_total = row.budget + row.add_contract_1 + row.add_contract_2;
  const confirmed    = row.order_amount + row.add_order_1 + row.add_order_2 + row.add_order_3;
  const budget_rem   = budget_total - confirmed;
  const total_billed = Object.values(row.monthly).reduce((s: number, v) => s + (v ?? 0), 0);
  const billing_rem  = confirmed - total_billed;
  return { budget_total, confirmed, budget_rem, total_billed, billing_rem };
}
function newEmptyRow(): ContractorRow {
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    status: "未発注", name: "", work_type: "",
    budget: 0, add_contract_1: 0, add_contract_2: 0, management_budget: 0,
    order_amount: 0, add_order_1: 0, add_order_2: 0, add_order_3: 0,
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
  initialEstimateItems?: Array<{
    id: string;
    name: string;
    cost_amount: number;
    selling_amount: number;
    category_id: string | null;
  }>;
  authorName?: string;
}

function mapEstimateItemsToRows(items: Props["initialEstimateItems"]): ContractorRow[] {
  if (!items?.length) return [];
  return items.map((item) => ({
    id: item.id,
    status: "未発注",
    name: "",
    work_type: item.name,
    budget: Number(item.selling_amount || item.cost_amount || 0),
    add_contract_1: 0,
    add_contract_2: 0,
    management_budget: Number(item.selling_amount || item.cost_amount || 0),
    order_amount: Number(item.cost_amount || 0),
    add_order_1: 0,
    add_order_2: 0,
    add_order_3: 0,
    monthly: {},
  }));
}

function mapOrdersToRows(orders: Props["initialOrders"]): ContractorRow[] {
  if (!orders?.length) return [];
  return orders.map((order) => ({
    id: order.id,
    status: order.status === "approved" || order.status === "submitted" ? "発注済" : "未発注",
    name: order.craftsman?.name ?? order.title,
    work_type: order.work_content ?? order.title,
    budget: Number(order.amount ?? 0),
    add_contract_1: 0,
    add_contract_2: 0,
    management_budget: Number(order.amount ?? 0),
    order_amount: Number(order.amount ?? 0),
    add_order_1: 0,
    add_order_2: 0,
    add_order_3: 0,
    monthly: {},
  }));
}

export function CostBudgetTab({ constructionId, contractAmount: propAmount, periodStart, initialOrders, initialEstimateItems, authorName = "ユーザー" }: Props) {
  const mappedRows = useMemo(() => mapOrdersToRows(initialOrders), [initialOrders]);
  const estimateRows = useMemo(() => mapEstimateItemsToRows(initialEstimateItems), [initialEstimateItems]);
  const fallbackPattern = PATTERNS[constructionId.split("").reduce((s, c) => s + c.charCodeAt(0), 0) % PATTERNS.length];
  const initialRows = mappedRows.length > 0
    ? mappedRows
    : estimateRows.length > 0
      ? estimateRows
      : fallbackPattern.rows.map(r => ({ ...r, monthly: { ...r.monthly } }));

  const [rows, setRows] = useState<ContractorRow[]>(() =>
    initialRows.map(r => ({ ...r, monthly: { ...r.monthly } }))
  );
  const [comments, setComments] = useState<CellComment[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const defaultPeriod = periodStart?.slice(0, 7) ?? "2025-01";
  const resolvedContractAmount =
    propAmount && propAmount > 0 ? propAmount : fallbackPattern.contract_amount;

  useEffect(() => {
    getCostBudget(constructionId).then((data) => {
      if (data?.rows?.length) {
        setRows(data.rows.map(r => ({ ...r, monthly: { ...r.monthly } })));
        setComments(data.comments ?? []);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [constructionId]);

  async function handleSave() {
    setSaving(true);
    try {
      await saveCostBudget({
        constructionId,
        contractAmount: resolvedContractAmount,
        periodStart: defaultPeriod,
        rows,
        comments,
      });
      setSaved(true);
      toast.success("工事台帳を保存しました");
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

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
  const updateMonthly = useCallback((id: string, month: string, value: number) => {
    setRows(prev => prev.map(r =>
      r.id === id ? { ...r, monthly: { ...r.monthly, [month]: value } } : r
    ));
    setSaved(false);
  }, []);
  const addRow    = () => { setRows(prev => [...prev, newEmptyRow()]); setSaved(false); };
  const deleteRow = (id: string) => { setRows(prev => prev.filter(r => r.id !== id)); setSaved(false); };
  const toggleStatus = (id: string) =>
    setRows(prev => prev.map(r =>
      r.id === id ? { ...r, status: r.status === "発注済" ? "未発注" : "発注済" } : r
    ));

  /* ── totals ── */
  const totals = useMemo(() => {
    const t = {
      budget: 0, add_contract_1: 0, add_contract_2: 0,
      budget_total: 0, management_budget: 0,
      order_amount: 0, add_order_1: 0, add_order_2: 0, add_order_3: 0,
      confirmed: 0, budget_rem: 0, billing_rem: 0,
      monthly: {} as Record<string, number>,
    };
    for (const row of rows) {
      const c = compute(row);
      t.budget            += row.budget;
      t.add_contract_1    += row.add_contract_1;
      t.add_contract_2    += row.add_contract_2;
      t.budget_total      += c.budget_total;
      t.management_budget += row.management_budget;
      t.order_amount      += row.order_amount;
      t.add_order_1       += row.add_order_1;
      t.add_order_2       += row.add_order_2;
      t.add_order_3       += row.add_order_3;
      t.confirmed         += c.confirmed;
      t.budget_rem        += c.budget_rem;
      t.billing_rem       += c.billing_rem;
      for (const [k, v] of Object.entries(row.monthly))
        t.monthly[k] = (t.monthly[k] ?? 0) + (v ?? 0);
    }
    return t;
  }, [rows]);

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
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "text-xs font-semibold px-3 py-1.5 rounded-md transition-all duration-150",
              saved
                ? "bg-green-100 text-green-700 cursor-default shadow-inner"
                : "bg-[#6BC9B3] text-white hover:bg-[#4aab96] shadow-[0_2px_6px_rgba(107,201,179,0.50),0_1px_2px_rgba(107,201,179,0.30),inset_0_1px_0_rgba(255,255,255,0.25)] hover:shadow-[0_4px_10px_rgba(107,201,179,0.55),0_2px_4px_rgba(107,201,179,0.35),inset_0_1px_0_rgba(255,255,255,0.28)] hover:-translate-y-px active:translate-y-0 active:shadow-inner"
            )}
          >
            {saved ? "保存済み" : saving ? "保存中..." : "保存する"}
          </button>
        </div>
      </div>

      {/* テーブル */}
      <div className={cn(
        "overflow-x-auto rounded-lg border border-gray-200 shadow-sm transition-all",
        commentMode && "ring-2 ring-blue-400 ring-offset-1"
      )}
        style={{ cursor: commentMode ? "crosshair" : undefined }}
      >
        <table className="border-collapse text-sm" style={{ minWidth: "1750px" }} onClick={handleTableClick}>
          <colgroup>
            <col style={{ width: 32 }} /><col style={{ width: 62 }} />
            <col style={{ width: 130 }} /><col style={{ width: 115 }} />
            <col style={{ width: 92 }} /><col style={{ width: 92 }} /><col style={{ width: 92 }} />
            <col style={{ width: 100 }} /><col style={{ width: 92 }} />
            <col style={{ width: 92 }} /><col style={{ width: 92 }} /><col style={{ width: 92 }} /><col style={{ width: 92 }} />
            <col style={{ width: 92 }} /><col style={{ width: 86 }} />
            {months.map(m => <col key={m} style={{ width: 78 }} />)}
            <col style={{ width: 86 }} />
            <col style={{ width: 48 }} />
          </colgroup>

          <thead>
            <tr>
              <th colSpan={4} className={cn(th, "bg-gray-100 text-left text-gray-600")}>基本情報</th>
              <th colSpan={3} className={cn(th, "bg-blue-100 text-blue-800")}>実行予算・追加契約</th>
              <th className={cn(th, "bg-green-100 text-green-800")}>合算</th>
              <th className={cn(th, "bg-violet-100 text-violet-800")}>管理</th>
              <th colSpan={4} className={cn(th, "bg-amber-100 text-amber-800")}>発注</th>
              <th className={cn(th, "bg-sky-100 text-sky-800")}>確定</th>
              <th className={cn(th, "bg-rose-100 text-rose-700")}>予算残</th>
              <th colSpan={months.length} className={cn(th, "bg-sky-50 text-sky-700")}>請求（月次入力）</th>
              <th className={cn(th, "bg-rose-100 text-rose-700")}>請求残</th>
              <th className={cn(th, "bg-gray-100")} />
            </tr>
            <tr className="bg-gray-50">
              <th className={cn(th, "bg-gray-100")}>#</th>
              <th className={cn(th, "bg-gray-100")}>発注</th>
              <th className={cn(th, "bg-gray-100 text-left")}>施工業者名</th>
              <th className={cn(th, "bg-gray-100 text-left")}>工種</th>
              <th className={cn(th, "bg-blue-50")}>実行予算</th>
              <th className={cn(th, "bg-blue-50")}>追加契約①</th>
              <th className={cn(th, "bg-blue-50")}>追加契約②</th>
              <th className={cn(th, "bg-green-50 text-[10px] leading-tight")}>追加含む<br/>実行予算</th>
              <th className={cn(th, "bg-violet-50")}>管理用予算</th>
              <th className={cn(th, "bg-amber-50")}>発注額</th>
              <th className={cn(th, "bg-amber-50")}>追加発注①</th>
              <th className={cn(th, "bg-amber-50")}>追加発注②</th>
              <th className={cn(th, "bg-amber-50")}>追加発注③</th>
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
            {rows.map((row, idx) => {
              const c = compute(row);
              return (
                <tr key={row.id} className={cn("hover:bg-gray-50/40 transition-colors group/row", commentMode && "hover:bg-blue-50/30")}
                  onClick={commentMode ? undefined : undefined}
                >
                  <td className={cn(tcc, "bg-gray-50 text-gray-400 text-[11px]")}>{idx + 1}</td>
                  {/* 発注ステータス (クリックで切替) */}
                  <td className={cn(tcc)}>
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
                  <td className={cn(tdc, "bg-blue-50/30")}>
                    <NumInput value={row.add_contract_1} onChange={v => updateField(row.id, "add_contract_1", v)} />
                  </td>
                  <td className={cn(tdc, "bg-blue-50/30")}>
                    <NumInput value={row.add_contract_2} onChange={v => updateField(row.id, "add_contract_2", v)} />
                  </td>
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
                  <CommentableCell cellKey={`${row.id}:add_order_1`} comments={cellComments(`${row.id}:add_order_1`)} onOpenPopover={handleOpenPopover} commentMode={commentMode} className={cn(tdc, "bg-amber-50/40")}>
                    <NumInput value={row.add_order_1} onChange={v => updateField(row.id, "add_order_1", v)} />
                  </CommentableCell>
                  <CommentableCell cellKey={`${row.id}:add_order_2`} comments={cellComments(`${row.id}:add_order_2`)} onOpenPopover={handleOpenPopover} commentMode={commentMode} className={cn(tdc, "bg-amber-50/40")}>
                    <NumInput value={row.add_order_2} onChange={v => updateField(row.id, "add_order_2", v)} />
                  </CommentableCell>
                  <CommentableCell cellKey={`${row.id}:add_order_3`} comments={cellComments(`${row.id}:add_order_3`)} onOpenPopover={handleOpenPopover} commentMode={commentMode} className={cn(tdc, "bg-amber-50/40")}>
                    <NumInput value={row.add_order_3} onChange={v => updateField(row.id, "add_order_3", v)} />
                  </CommentableCell>
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
              <td colSpan={16 + months.length + 1} className="py-1.5 px-3 bg-gray-50/60">
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
              <td colSpan={16 + months.length + 1} className="h-1.5" />
            </tr>

            {/* 合計行 */}
            <tr className="bg-blue-50/20 font-semibold border-b-2 border-gray-300">
              <td colSpan={2} className={cn(tcc, "bg-gray-100")} />
              <td colSpan={2} className={cn(tdl, "bg-gray-50 font-bold")}>合計</td>
              <td className={cn(tdc, "bg-blue-50 font-bold")}>{fmtAlways(totals.budget)}</td>
              <td className={cn(tdc, "bg-blue-50 font-bold")}>{fmtView(totals.add_contract_1)}</td>
              <td className={cn(tdc, "bg-blue-50 font-bold")}>{fmtView(totals.add_contract_2)}</td>
              <td className={cn(tdc, "bg-green-100 font-bold")}>{fmtAlways(totals.budget_total)}</td>
              <td className={cn(tdc, "bg-violet-50 font-bold")}>{fmtView(totals.management_budget)}</td>
              <td className={cn(tdc, "bg-amber-50 font-bold")}>{fmtView(totals.order_amount)}</td>
              <td className={cn(tdc, "bg-amber-50 font-bold")}>{fmtView(totals.add_order_1)}</td>
              <td className={cn(tdc, "bg-amber-50 font-bold")}>{fmtView(totals.add_order_2)}</td>
              <td className={cn(tdc, "bg-amber-50 font-bold")}>{fmtView(totals.add_order_3)}</td>
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
              <td colSpan={4} className={cn(tdl, "bg-gray-100")} />
              <td colSpan={4} className={cn(tdc, "text-center bg-blue-50/60 font-semibold text-blue-700")}>実行予算（暫定）</td>
              <td className={cn(tdc, "bg-violet-50")} />
              <td colSpan={4} className={cn(tdc, "text-center bg-amber-50 font-semibold text-amber-700")}>暫定合計</td>
              <td colSpan={2} className={cn(tdc, "text-center bg-sky-50 font-semibold text-sky-700")}>確定額</td>
              <td colSpan={months.length + 2} className={cn(tdc)} />
            </tr>
            {[
              { label: "契約金額",   vBudget: contractAmount, vConfirmed: contractAmount, isRate: false },
              { label: "工事粗利額", vBudget: gpBudget,       vConfirmed: gpConfirmed,   isRate: false },
              { label: "工事粗利率", vBudget: grBudget,       vConfirmed: grConfirmed,   isRate: true  },
            ].map(({ label, vBudget, vConfirmed, isRate }) => (
              <tr key={label} className="bg-white border-b border-gray-200">
                <td colSpan={4} className={cn(tdl, "bg-gray-100 font-semibold text-gray-700")}>{label}</td>
                <td colSpan={4} className={cn(tdc, "bg-blue-50 font-bold",
                  !isRate && vBudget < 0 ? "text-red-600" : !isRate ? "text-gray-800" : vBudget < 0 ? "text-red-600" : "text-emerald-700"
                )}>
                  {isRate ? `${vBudget.toFixed(1)}%` : fmtAlways(vBudget)}
                </td>
                <td className={cn(tdc, "bg-violet-50")} />
                <td colSpan={4} className={cn(tdc, "bg-amber-50 text-gray-400")}>—</td>
                <td colSpan={2} className={cn(tdc, "bg-sky-50 font-bold",
                  !isRate && vConfirmed < 0 ? "text-red-600" : !isRate ? "text-gray-800" : vConfirmed < 0 ? "text-red-600" : "text-emerald-700"
                )}>
                  {isRate ? `${vConfirmed.toFixed(1)}%` : fmtAlways(vConfirmed)}
                </td>
                <td colSpan={months.length + 2} className={cn(tdc)} />
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
    </div>
  );
}
