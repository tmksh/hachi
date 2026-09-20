"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IntegerInput } from "@/components/ui/integer-input";
import { ArrowLeft, Plus, Loader2, FileDown, BookOpen, X, GripVertical, ChevronRight, ChevronDown, AlertTriangle, Sparkles, Trash2 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/** 行ドラッグ用: ハンドル以外では DnD を開始しない（No.59） */
class RowPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent: event }: React.PointerEvent) => {
        if (!event.isPrimary || event.button !== 0) return false;
        if (!(event.target instanceof Element)) return false;
        return Boolean(event.target.closest("[data-drag-handle]"));
      },
    },
  ];
}
import type { EstimateCategory, EstimateItem } from "@/lib/database.types";
import {
  addEstimateCategory,
  addEstimateItem,
  updateEstimateItem,
  deleteEstimateItem,
  deleteEstimateCategory,
  updateEstimateCategoryName,
  updateEstimateCategoryDetails,
  reorderEstimateCategories,
  reorderEstimateItems,
  importCategoryFromReference,
  type EstimateItemUpdatePatch,
  type EstimateCategoryDetailPatch,
} from "@/lib/actions/constructions";
import { getVendorCandidates, type VendorCandidate } from "@/lib/actions/craftsmen";
import { vendorNameMatches } from "@/lib/vendor-normalize";
import { effectiveCategoryAmounts } from "@/lib/estimate-category-totals";
import {
  EstimatePdfPreviewDialog,
  toEstimatePdfPreviewData,
  toCostBreakdownPdfPreviewData,
  type EstimatePdfPreviewData,
} from "@/components/estimate/estimate-pdf-preview-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateEstimate } from "@/lib/actions/estimates";
import { ESTIMATE_QK, ESTIMATE_STALE_MS, ESTIMATE_DETAIL_STALE_MS, fetchEstimates, fetchEstimate } from "@/lib/queries/estimates";
import { getDepartmentMarginRates, type DepartmentMarginRate } from "@/lib/actions/deals";
import { EstimateApprovalActions } from "@/components/estimate/estimate-approval-actions";
import { getEstimateMarginThreshold } from "@/lib/actions/sales-flow";
import { toMarginThresholdPercent } from "@/lib/estimate-margin";
import { calcManagementFeeAmount } from "@/lib/estimate-management-fee";
import { humanizeClientError } from "@/lib/humanize-error";
import { useBridgeChat } from "@/contexts/chat-panel-context";
const ESTIMATE_STATUS_MAP: Record<string, string> = {
  draft: "下書き", issued: "発行済", sent: "送付済", accepted: "受注", rejected: "失注",
};

// ---- 見積参照パネル -------------------------------------------------------

type RefEstimate = {
  id: string;
  estimate_no: string | null;
  title: string | null;
  status: string | null;
  total: number | null;
  gross_profit_rate: number | null;
  categories: EstimateCategory[];
  items: EstimateItem[];
};

type EstimateListItem = {
  id: string;
  estimate_no: string | null;
  title: string | null;
  status: string | null;
  total: number | null;
  customer?: { name?: string | null; company_name?: string | null } | null;
};

function RefPanel({
  refEstimate,
  onClose,
  onDragStart,
}: {
  refEstimate: RefEstimate;
  onClose: () => void;
  onDragStart: (e: React.DragEvent, categoryId: string) => void;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const categoriesWithItems = refEstimate.categories.map((cat) => ({
    category: cat,
    items: refEstimate.items.filter((i) => i.category_id === cat.id),
  }));

  return (
    <div className="w-[260px] shrink-0 rounded-xl border border-border bg-card flex flex-col overflow-hidden">
      {/* ヘッダー */}
      <div className="px-3 py-2 border-b border-border/60 flex items-start gap-1.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">{refEstimate.estimate_no}</span>
            <span className="text-xs font-semibold truncate">{refEstimate.title ?? "—"}</span>
            <Badge variant="outline" className="text-[10px] py-0">参照元</Badge>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            合計 ¥{(refEstimate.total ?? 0).toLocaleString()} ・ 粗利率 {(refEstimate.gross_profit_rate ?? 0).toFixed(1)}%
            &nbsp;・ {refEstimate.categories.length}大項目
          </p>
        </div>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
          onClick={onClose}
          aria-label="参照パネルを閉じる"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="px-3 py-1.5 text-[10px] text-muted-foreground border-b border-dashed border-border/40">
        大項目をドラッグして右側の見積に追加できます
      </p>

      {/* カテゴリ一覧 */}
      <div className="flex-1 overflow-y-auto py-1">
        {categoriesWithItems.length === 0 && (
          <p className="px-3 py-4 text-xs text-muted-foreground text-center">大項目がありません</p>
        )}
        {categoriesWithItems.map(({ category, items: catItems }) => {
          const expanded = expandedIds.has(category.id);
          const catSell = catItems.reduce((s, i) => s + (i.selling_amount ?? 0), 0);
          return (
            <div key={category.id}>
              <div
                draggable
                onDragStart={(e) => onDragStart(e, category.id)}
                className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-muted/30 cursor-grab active:cursor-grabbing rounded-sm mx-1 group"
              >
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                <button
                  type="button"
                  className="text-muted-foreground/70 hover:text-foreground shrink-0"
                  onClick={() => toggle(category.id)}
                >
                  {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </button>
                <span className="flex-1 text-xs font-medium truncate">
                  {category.name.trim() || <span className="text-muted-foreground font-normal">大項目名</span>}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">{catItems.length}項目</span>
                <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">¥{catSell.toLocaleString()}</span>
              </div>
              {expanded && catItems.map((item) => (
                <div key={item.id} className="pl-9 pr-3 py-0.5 flex justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground truncate">{item.name}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">¥{(item.selling_amount ?? 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type EstimateTotalsPatch = {
  subtotal: number;
  tax: number;
  total: number;
  cost_total: number;
  gross_profit: number;
  gross_profit_rate: number;
};

export type EstimateForView = {
  id: string;
  estimate_no?: string;
  title?: string | null;
  status?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  gross_profit?: number;
  gross_profit_rate?: number;
  notes?: string | null;
  customer?: { name?: string | null; company_name?: string | null; customer_type?: string | null; notes?: string | null } | null;
  company_id?: string;
  cost_total?: number;
  reserve_fee_1_rate?: number;
  reserve_fee_2_rate?: number;
  reserve_fee_1_amount?: number;
  reserve_fee_2_amount?: number;
  default_gross_profit_rate?: number;
  /** 事業部門（No.72）。部門別規定粗利の判定に使用 */
  department_name?: string | null;
  categories?: EstimateCategory[];
  items?: EstimateItem[];
};

function recalcItemAmounts(item: EstimateItem): EstimateItem {
  const qty = Number(item.quantity) || 0;
  const costPrice = Number(item.cost_price) || 0;
  // 予備費行は売価0固定（No.61/65）
  const sellingPrice = item.is_reserve_row ? 0 : Number(item.selling_price) || 0;
  const costAmount = Math.round(qty * costPrice);
  const sellingAmount = Math.round(qty * sellingPrice);
  const grossProfit = sellingAmount - costAmount;
  const grossProfitRate = sellingAmount > 0 ? (grossProfit / sellingAmount) * 100 : 0;
  return {
    ...item,
    selling_price: sellingPrice,
    cost_amount: costAmount,
    selling_amount: sellingAmount,
    gross_profit: grossProfit,
    gross_profit_rate: grossProfitRate,
  };
}

const ITEM_CELL =
  "w-full bg-transparent border-0 outline-none text-xs leading-tight py-1 px-1 whitespace-nowrap";

const ITEM_CELL_NUM =
  "w-full min-w-[5rem] bg-transparent border-0 outline-none text-xs leading-tight py-1 px-1 whitespace-nowrap text-right tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

const ITEM_CELL_UNIT =
  "w-full min-w-[2rem] bg-transparent border-0 outline-none text-xs leading-tight py-1 px-1 whitespace-nowrap text-center text-muted-foreground";

// ---- 発注業者入力（ポップアップ検索・No.58/71） -----------------------------
// セルは表示のみ。クリックでポップアップを開き、そこで検索・選択する。

type VendorValue = { craftsmanId: string | null; name: string };

function VendorInput({
  craftsmanId,
  vendorName,
  candidates,
  disabled,
  isReserve,
  onCommit,
}: {
  craftsmanId?: string | null;
  vendorName: string;
  candidates: VendorCandidate[];
  disabled?: boolean;
  isReserve?: boolean;
  onCommit: (value: VendorValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const q = query.trim();
  const filtered = (q
    ? candidates.filter(
        (c) =>
          vendorNameMatches(c.name, q, c.bank_account_kana) ||
          (c.company_name ? vendorNameMatches(c.company_name, q, c.bank_account_kana) : false),
      )
    : candidates
  ).slice().sort((a, b) => {
    const rank = (c: VendorCandidate) => {
      if (c.kind !== "system") return 3;
      if (c.system_key === "reserve") return 0;
      return 2;
    };
    const d = rank(a) - rank(b);
    if (d !== 0) return d;
    return a.name.localeCompare(b.name, "ja");
  });
  const shown = filtered.slice(0, 20);

  const vendorPrimaryName = (c: VendorCandidate) => c.company_name?.trim() || c.name;
  const vendorSecondaryName = (c: VendorCandidate) => {
    const company = c.company_name?.trim();
    if (company && c.name.trim() && c.name.trim() !== company) return c.name;
    return null;
  };

  const select = (c: VendorCandidate) => {
    setOpen(false);
    onCommit({ craftsmanId: c.id, name: vendorPrimaryName(c) });
  };

  const clear = () => {
    setOpen(false);
    onCommit({ craftsmanId: null, name: "" });
  };

  const label = vendorName.trim() || "業者を検索";

  return (
    <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-no-dnd
          disabled={disabled}
          className={cn(
            "w-full h-7 px-1 text-left text-xs truncate rounded-sm",
            "hover:bg-muted/40 disabled:opacity-50 flex items-center gap-0.5",
            vendorName.trim()
              ? isReserve
                ? "text-amber-700 font-medium"
                : "text-muted-foreground"
              : "text-slate-400",
          )}
          title={vendorName.trim() || undefined}
        >
          <span className="truncate flex-1">{label}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 p-2"
        data-no-dnd
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="業者名で検索（㈱・カタカナ可）"
          className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing && shown[0]) {
              e.preventDefault();
              select(shown[0]);
            }
          }}
        />
        <div className="mt-1.5 max-h-56 overflow-y-auto rounded-md border border-border/60">
          <button
            type="button"
            className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/60"
            onClick={clear}
          >
            （未選択）
          </button>
          {shown.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-muted-foreground">候補がありません</p>
          ) : (
            shown.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => select(c)}
                className={cn(
                  "w-full text-left px-2 py-1.5 text-xs hover:bg-muted/60 flex items-center gap-1.5",
                  c.id === craftsmanId && "bg-muted/40",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{vendorPrimaryName(c)}</span>
                  {vendorSecondaryName(c) && (
                    <span className="block truncate text-[10px] text-muted-foreground">{vendorSecondaryName(c)}</span>
                  )}
                </span>
                {c.kind === "system" && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px] py-0 shrink-0",
                      c.system_key === "reserve"
                        ? "border-amber-300 text-amber-700 bg-amber-50"
                        : "border-slate-300 text-slate-500",
                    )}
                  >
                    {c.system_key === "reserve"
                      ? "予備費"
                      : "システム予約"}
                  </Badge>
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** システム原価行（予備費）かどうか。経営調整費は明細行にしない */
function isSystemCostCandidate(candidates: VendorCandidate[], craftsmanId: string | null): boolean {
  if (!craftsmanId) return false;
  const c = candidates.find((x) => x.id === craftsmanId);
  return c?.kind === "system" && c?.system_key === "reserve";
}

function isManagementVendor(candidates: VendorCandidate[], craftsmanId: string | null | undefined): boolean {
  if (!craftsmanId) return false;
  return candidates.find((x) => x.id === craftsmanId)?.system_key === "management";
}

function systemCostLabel(candidates: VendorCandidate[], craftsmanId: string | null | undefined): string {
  const c = craftsmanId ? candidates.find((x) => x.id === craftsmanId) : undefined;
  if (c?.system_key === "reserve") return "予備費";
  return "予備費";
}

// ---- 並べ替え（DnD・No.59） -------------------------------------------------

/**
 * 大項目ドラッグ中は明細行を衝突対象から除外する。
 * tbody 全体をドロップ領域にすると、詳細が複数行ある大項目の中心が
 * 配下明細に重なり、並べ替えが発火しなくなる。
 */
const estimateDndCollision: CollisionDetection = (args) => {
  const activeType = args.active.data.current?.type;
  const activeCategoryId = args.active.data.current?.categoryId;
  const droppableContainers = args.droppableContainers.filter((container) => {
    const t = container.data.current?.type;
    if (activeType === "category") return t === "category";
    if (activeType === "item") {
      return t === "item" && container.data.current?.categoryId === activeCategoryId;
    }
    return true;
  });
  return closestCenter({ ...args, droppableContainers });
};

function SortableCategoryGroup({
  id,
  children,
}: {
  id: string;
  children: (api: {
    handleProps: Record<string, unknown>;
    setHeaderRef: (node: HTMLElement | null) => void;
    headerStyle: React.CSSProperties;
    isDragging: boolean;
    followStyle: React.CSSProperties | undefined;
  }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: "category" },
  });
  const headerStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <>
      {children({
        handleProps: { ...attributes, ...(listeners ?? {}) },
        setHeaderRef: setNodeRef,
        headerStyle,
        isDragging,
        followStyle: isDragging ? headerStyle : undefined,
      })}
    </>
  );
}

function CategoryNameInput({
  category,
  onRenamed,
}: {
  category: EstimateCategory;
  onRenamed: (next: EstimateCategory) => void;
}) {
  const [name, setName] = useState(category.name);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(category.name);
  }, [category.id, category.name]);

  const commit = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === category.name || saving) {
      if (!trimmed) setName(category.name);
      return;
    }
    setSaving(true);
    onRenamed({ ...category, name: trimmed });
    try {
      const saved = await updateEstimateCategoryName(category.id, trimmed);
      onRenamed(saved as EstimateCategory);
    } catch (e) {
      setName(category.name);
      onRenamed(category);
      toast.error(e instanceof Error ? e.message : "大項目名の更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <input
      className={cn(
        "min-w-0 flex-1 bg-transparent border-0 outline-none text-xs font-semibold text-slate-700 leading-tight py-0.5 px-1 rounded",
        "focus:bg-white/80 focus:ring-1 focus:ring-slate-300",
        saving && "opacity-70",
      )}
      value={name}
      placeholder="大項目名"
      disabled={saving}
      onChange={(e) => setName(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === "Escape") {
          setName(category.name);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

function EstimateItemRow({
  item,
  candidates,
  onUpdate,
  onDelete,
  followStyle,
}: {
  item: EstimateItem;
  candidates: VendorCandidate[];
  onUpdate: (item: EstimateItem, totals?: EstimateTotalsPatch) => void;
  onDelete?: (item: EstimateItem) => void;
  /** 親大項目のドラッグ中は同じ変位を追従し、自身の DnD は無効化する */
  followStyle?: React.CSSProperties;
}) {
  const [draft, setDraft] = useState(item);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(item);
  }, [item]);

  const isTemp = item.id.startsWith("temp-");

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: { type: "item", categoryId: item.category_id ?? "none" },
    disabled: isTemp || Boolean(followStyle),
  });
  const sortableStyle = followStyle ?? { transform: CSS.Transform.toString(transform), transition };
  const rowDragging = isDragging || Boolean(followStyle);

  const commit = async (field: keyof EstimateItemUpdatePatch, rawValue: string | number | null) => {
    if (isTemp || saving) return;

    let value: string | number | null = rawValue;
    if (field === "quantity" || field === "cost_price" || field === "selling_price") {
      value = Number(rawValue) || 0;
    }
    if (field === "specification" || field === "notes" || field === "unit") {
      value = typeof rawValue === "string" ? (rawValue.trim() || null) : null;
    }
    if (field === "name" && typeof rawValue === "string" && !rawValue.trim()) return;

    const prev = item[field as keyof EstimateItem];
    if (prev === value || (prev == null && (value === "" || value === null))) return;

    const patch = { [field]: value } as EstimateItemUpdatePatch;
    const optimistic = recalcItemAmounts({ ...item, ...patch } as EstimateItem);
    onUpdate(optimistic);
    setSaving(true);
    try {
      const { item: saved, totals } = await updateEstimateItem(item.id, patch);
      onUpdate(saved as EstimateItem, totals);
    } catch (e) {
      onUpdate(item);
      setDraft(item);
      toast.error(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // 発注業者の確定（No.58/61: 予備費は craftsman 種別フラグで判定）
  const commitVendor = async (vendor: VendorValue) => {
    if (isTemp || saving) return;
    if (
      vendor.craftsmanId === (item.vendor_craftsman_id ?? null) &&
      vendor.name === (item.vendor_name ?? "")
    ) return;

    const reserve = isSystemCostCandidate(candidates, vendor.craftsmanId);
    const optimistic = recalcItemAmounts({
      ...item,
      vendor_craftsman_id: vendor.craftsmanId,
      vendor_name: vendor.name || null,
      is_reserve_row: reserve,
    } as EstimateItem);
    onUpdate(optimistic);
    setSaving(true);
    try {
      const { item: saved, totals } = await updateEstimateItem(item.id, {
        vendor_craftsman_id: vendor.craftsmanId,
        vendor_name: vendor.name || null,
      });
      onUpdate(saved as EstimateItem, totals);
    } catch (e) {
      onUpdate(item);
      setDraft(item);
      toast.error(e instanceof Error ? e.message : "発注業者の更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const isTextRow = Boolean(draft.is_text_row);
  const isReserveRow = Boolean(draft.is_reserve_row);
  const isStandaloneText = isTextRow && !item.category_id;

  if (isTextRow) {
    return (
      <tr
        ref={setNodeRef}
        style={sortableStyle}
        className={cn(
          "border-t border-border/40 bg-slate-50/60 hover:bg-muted/10",
          saving && "opacity-70",
          rowDragging && "opacity-60 relative z-10",
        )}
      >
        <td className="px-2 py-1.5" colSpan={10}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-drag-handle
              className="shrink-0 p-0.5 text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing"
              aria-label="並べ替え"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
            <Badge variant="outline" className="text-[10px] shrink-0 border-slate-300 text-slate-600">
              {isStandaloneText ? "独立テキスト行" : "テキスト行"}
            </Badge>
            <input
              className={cn(ITEM_CELL, "italic text-muted-foreground")}
              value={draft.name}
              disabled={isTemp}
              placeholder="注釈を入力（例: 洗面器材はお客様支給のため保証致しかねます）"
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              onBlur={() => void commit("name", draft.name)}
            />
          </div>
        </td>
        <td className="px-1 py-1.5 text-right whitespace-nowrap">
          <button
            type="button"
            data-no-dnd
            disabled={isTemp || saving}
            className="p-0.5 text-slate-400 hover:text-rose-600 disabled:opacity-40"
            aria-label="テキスト行を削除"
            onClick={() => onDelete?.(item)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr
      ref={setNodeRef}
      style={sortableStyle}
      className={cn(
        "border-t border-border/40 hover:bg-muted/10",
        isReserveRow && "bg-amber-50/40",
        saving && "opacity-70",
        rowDragging && "opacity-60 relative z-10",
      )}
    >
      <td className="px-2 py-1.5 whitespace-nowrap">
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-drag-handle
            className="shrink-0 p-0.5 text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing"
            aria-label="並べ替え"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          {isReserveRow && (
            <Badge variant="outline" className="text-[9px] py-0 shrink-0 border-amber-300 text-amber-700 bg-amber-50">
              {systemCostLabel(candidates, draft.vendor_craftsman_id)}
            </Badge>
          )}
          <input
            className={ITEM_CELL}
            value={draft.name}
            disabled={isTemp}
            placeholder="詳細項目名"
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            onBlur={() => void commit("name", draft.name)}
          />
        </div>
      </td>
      <td className="px-2 py-1.5 whitespace-nowrap">
        <input
          className={cn(ITEM_CELL, "text-muted-foreground")}
          value={draft.specification ?? ""}
          placeholder="—"
          disabled={isTemp}
          onChange={(e) => setDraft((d) => ({ ...d, specification: e.target.value }))}
          onBlur={() => void commit("specification", draft.specification ?? "")}
        />
      </td>
      <td className="px-2 py-1.5 whitespace-nowrap">
        <VendorInput
          craftsmanId={draft.vendor_craftsman_id}
          vendorName={draft.vendor_name ?? ""}
          candidates={candidates}
          disabled={isTemp}
          isReserve={isReserveRow}
          onCommit={(v) => void commitVendor(v)}
        />
      </td>
      <td className="px-1.5 py-1.5 whitespace-nowrap w-14">
        <IntegerInput
          className={ITEM_CELL_NUM}
          value={Number(draft.quantity) || 0}
          placeholder="0"
          disabled={isTemp}
          onValueChange={(qty) => {
            setDraft((d) => recalcItemAmounts({ ...d, quantity: qty }));
          }}
          onBlur={(qty) => void commit("quantity", qty)}
        />
      </td>
      <td className="px-1 py-1.5 whitespace-nowrap w-12">
        <input
          className={ITEM_CELL_UNIT}
          value={draft.unit ?? ""}
          placeholder="—"
          disabled={isTemp}
          onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
          onBlur={() => void commit("unit", draft.unit ?? "")}
        />
      </td>
      <td className="px-1.5 py-1.5 bg-amber-50/30 whitespace-nowrap min-w-[6rem]">
        <IntegerInput
          className={cn(ITEM_CELL_NUM, "text-amber-700")}
          value={Number(draft.cost_price) || 0}
          placeholder="0"
          disabled={isTemp}
          onValueChange={(costPrice) => {
            setDraft((d) => recalcItemAmounts({ ...d, cost_price: costPrice }));
          }}
          onBlur={(costPrice) => void commit("cost_price", costPrice)}
        />
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums text-xs text-amber-700 bg-amber-50/30 whitespace-nowrap min-w-[6.5rem]">
        ¥{(draft.cost_amount ?? 0).toLocaleString()}
      </td>
      <td className="px-1.5 py-1.5 bg-blue-50/30 whitespace-nowrap min-w-[6rem]">
        {isReserveRow ? (
          <span className="block text-right text-[10px] text-amber-700 px-1" title="予備費行は売価入力不可（売価0固定）">
            売価0固定
          </span>
        ) : (
          <IntegerInput
            className={cn(ITEM_CELL_NUM, "text-blue-700")}
            value={Number(draft.selling_price) || 0}
            placeholder="0"
            disabled={isTemp}
            onValueChange={(sellingPrice) => {
              setDraft((d) => recalcItemAmounts({ ...d, selling_price: sellingPrice }));
            }}
            onBlur={(sellingPrice) => void commit("selling_price", sellingPrice)}
          />
        )}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums text-xs text-blue-700 bg-blue-50/30 font-medium whitespace-nowrap min-w-[6.5rem]">
        ¥{(draft.selling_amount ?? 0).toLocaleString()}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums text-xs whitespace-nowrap w-14">
        {isReserveRow ? "—" : `${(draft.gross_profit_rate ?? 0).toFixed(1)}%`}
      </td>
      <td className="px-2 py-1.5 whitespace-nowrap">
        <div className="flex items-center gap-1">
          {isReserveRow ? (
            <span className="text-[10px] text-amber-700 whitespace-nowrap">顧客PDF非表示</span>
          ) : (
            <input
              className={cn(ITEM_CELL, "text-muted-foreground")}
              value={draft.notes ?? ""}
              placeholder="—"
              disabled={isTemp}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              onBlur={() => void commit("notes", draft.notes ?? "")}
            />
          )}
          <button
            type="button"
            data-no-dnd
            disabled={isTemp || saving}
            className="shrink-0 p-0.5 text-slate-400 hover:text-rose-600 disabled:opacity-40"
            aria-label="明細を削除"
            onClick={() => onDelete?.(item)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---- 大項目行（明細行と同等の直接入力・No.70/68） ---------------------------

function CategoryHeaderRow({
  category,
  catItems,
  collapsed,
  candidates,
  onToggle,
  onRenamed,
  onCategoryPatched,
  onDelete,
  handleProps,
  setNodeRef,
  style,
  isDragging,
}: {
  category: EstimateCategory;
  catItems: EstimateItem[];
  collapsed: boolean;
  candidates: VendorCandidate[];
  onToggle: () => void;
  onRenamed: (next: EstimateCategory) => void;
  onCategoryPatched: (next: EstimateCategory, totals?: EstimateTotalsPatch) => void;
  onDelete?: (category: EstimateCategory) => void;
  handleProps: Record<string, unknown>;
  setNodeRef: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  isDragging?: boolean;
}) {
  const [draft, setDraft] = useState(category);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(category);
  }, [category]);

  const isTemp = category.id.startsWith("temp-");
  const eff = effectiveCategoryAmounts(draft, catItems);
  const effRate = eff.selling_amount > 0
    ? ((eff.selling_amount - eff.cost_amount) / eff.selling_amount) * 100
    : 0;

  const commit = async (patch: EstimateCategoryDetailPatch) => {
    if (isTemp || saving) return;
    const optimistic = { ...category, ...patch } as EstimateCategory;
    onCategoryPatched(optimistic);
    setSaving(true);
    try {
      const { category: saved, totals } = await updateEstimateCategoryDetails(category.id, patch);
      onCategoryPatched(saved as EstimateCategory, totals);
    } catch (e) {
      onCategoryPatched(category);
      setDraft(category);
      toast.error(e instanceof Error ? e.message : "大項目の更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const commitField = <K extends keyof EstimateCategoryDetailPatch>(
    field: K,
    value: EstimateCategoryDetailPatch[K],
  ) => {
    const prev = category[field as keyof EstimateCategory];
    if (prev === value || (prev == null && (value === "" || value === null))) return;
    void commit({ [field]: value } as EstimateCategoryDetailPatch);
  };

  const isReserveCategory = isSystemCostCandidate(candidates, draft.vendor_craftsman_id ?? null);

  const commitVendor = (vendor: VendorValue) => {
    if (
      vendor.craftsmanId === (category.vendor_craftsman_id ?? null) &&
      vendor.name === (category.vendor_name ?? "")
    ) return;
    const reserve = isSystemCostCandidate(candidates, vendor.craftsmanId);
    void commit({
      vendor_craftsman_id: vendor.craftsmanId,
      vendor_name: vendor.name || null,
      ...(reserve ? { selling_price: 0 } : {}),
    });
  };

  const CAT_CELL =
    "w-full bg-transparent border-0 outline-none text-xs leading-tight py-1 px-1 whitespace-nowrap placeholder:text-slate-400/70";

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-slate-200/80 border-t border-border/40 hover:bg-slate-300/70",
        isReserveCategory && "bg-amber-100/70",
        saving && "opacity-70",
        isDragging && "opacity-60 relative z-10",
      )}
    >
      <td className="px-2 py-2 font-semibold text-slate-700">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            data-drag-handle
            className="shrink-0 p-0.5 text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing"
            aria-label="大項目を並べ替え"
            {...handleProps}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="text-slate-400 w-4 shrink-0 text-center hover:text-slate-700"
            aria-expanded={!collapsed}
            aria-label={collapsed ? "展開" : "折りたたむ"}
            onClick={onToggle}
          >
            {collapsed ? "▸" : "▾"}
          </button>
          <CategoryNameInput category={category} onRenamed={onRenamed} />
          <span className="text-[10px] text-muted-foreground font-normal shrink-0">{catItems.length}項目</span>
          {eff.overridden && (
            <Badge
              variant="outline"
              className="text-[9px] py-0 shrink-0 border-amber-400 text-amber-800 bg-amber-50"
              title="大項目の直接入力より配下の詳細行が優先されています"
            >
              詳細項目により上書き
            </Badge>
          )}
        </div>
      </td>
      <td className="px-2 py-2 whitespace-nowrap">
        <input
          className={cn(CAT_CELL, "text-slate-600")}
          value={draft.specification ?? ""}
          placeholder="形状・摘要"
          disabled={isTemp}
          onChange={(e) => setDraft((d) => ({ ...d, specification: e.target.value }))}
          onBlur={() => commitField("specification", (draft.specification ?? "").trim() || null)}
        />
      </td>
      <td className="px-2 py-2 whitespace-nowrap">
        <VendorInput
          craftsmanId={draft.vendor_craftsman_id}
          vendorName={draft.vendor_name ?? ""}
          candidates={candidates}
          disabled={isTemp}
          onCommit={commitVendor}
        />
      </td>
      <td className="px-1.5 py-2 whitespace-nowrap w-14">
        <IntegerInput
          className={ITEM_CELL_NUM}
          value={Number(draft.quantity) || 0}
          placeholder="0"
          disabled={isTemp || eff.overridden}
          onValueChange={(qty) => setDraft((d) => ({ ...d, quantity: qty }))}
          onBlur={(qty) => commitField("quantity", Number(qty) || 0)}
        />
      </td>
      <td className="px-1 py-2 whitespace-nowrap w-12">
        <input
          className={ITEM_CELL_UNIT}
          value={draft.unit ?? ""}
          placeholder="—"
          disabled={isTemp || eff.overridden}
          onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
          onBlur={() => commitField("unit", (draft.unit ?? "").trim() || null)}
        />
      </td>
      <td className="px-1.5 py-2 bg-amber-50/40 whitespace-nowrap min-w-[6rem]">
        <IntegerInput
          className={cn(ITEM_CELL_NUM, "text-amber-700")}
          value={Number(draft.cost_price) || 0}
          placeholder="0"
          disabled={isTemp || eff.overridden}
          onValueChange={(v) => setDraft((d) => ({ ...d, cost_price: v }))}
          onBlur={(v) => commitField("cost_price", Number(v) || 0)}
        />
      </td>
      <td className="px-2 py-2 text-right tabular-nums font-semibold bg-amber-50/40 whitespace-nowrap text-xs">
        ¥{eff.cost_amount.toLocaleString()}
      </td>
      <td className="px-1.5 py-2 bg-blue-50/40 whitespace-nowrap min-w-[6rem]">
        {isReserveCategory ? (
          <span className="block text-right text-[10px] text-amber-700 px-1" title="システム原価行は売価入力不可">
            売価0固定
          </span>
        ) : (
          <IntegerInput
            className={cn(ITEM_CELL_NUM, "text-blue-700")}
            value={Number(draft.selling_price) || 0}
            placeholder="0"
            disabled={isTemp || eff.overridden}
            onValueChange={(v) => setDraft((d) => ({ ...d, selling_price: v }))}
            onBlur={(v) => commitField("selling_price", Number(v) || 0)}
          />
        )}
      </td>
      <td className="px-2 py-2 text-right tabular-nums font-semibold bg-blue-50/40 whitespace-nowrap text-xs">
        ¥{isReserveCategory ? 0 : eff.selling_amount.toLocaleString()}
      </td>
      <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap text-xs">{effRate.toFixed(1)}%</td>
      <td className="px-1 py-2 text-right whitespace-nowrap">
        <button
          type="button"
          data-no-dnd
          disabled={isTemp || saving}
          className="p-0.5 text-slate-400 hover:text-rose-600 disabled:opacity-40"
          aria-label="大項目を削除"
          onClick={() => onDelete?.(category)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

export function EstimateDetailView({
  estimate,
  onBack,
  loading,
  onEstimateChange,
  headerExtra,
  pdfCustomer,
}: {
  estimate: EstimateForView;
  onBack?: () => void;
  loading?: boolean;
  onEstimateChange: (est: EstimateForView) => void;
  headerExtra?: React.ReactNode;
  pdfCustomer?: { name?: string | null; company_name?: string | null; customer_type?: string | null; notes?: string | null } | null;
}) {
  const queryClient = useQueryClient();
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfData, setPdfData] = useState<EstimatePdfPreviewData | null>(null);
  const [refSelectOpen, setRefSelectOpen] = useState(false);
  const [refEstimateList, setRefEstimateList] = useState<EstimateListItem[]>([]);
  const [refListLoading, setRefListLoading] = useState(false);
  const [refEstimate, setRefEstimate] = useState<RefEstimate | null>(null);
  const [refLoading, setRefLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [refSearch, setRefSearch] = useState("");
  const [bulkCostOpen, setBulkCostOpen] = useState(false);
  const [bulkSellOpen, setBulkSellOpen] = useState(false);
  const [bulkRateCost, setBulkRateCost] = useState(String(Math.round(toMarginThresholdPercent(estimate.default_gross_profit_rate))));
  const [bulkRateSell, setBulkRateSell] = useState(String(Math.round(toMarginThresholdPercent(estimate.default_gross_profit_rate))));
  const [bulkApplying, setBulkApplying] = useState(false);
  const [marginInfo, setMarginInfo] = useState<{
    threshold: number;
    baseThreshold: number;
    reservePercent: number;
    baseSource?: "department" | "company" | "estimate_default";
    approvalStatus: string;
    remandComment: string | null;
    workflowRequestId: string | null;
  } | null>(null);
  // 経営調整費は社員にも表示（非表示による不信感を防止）
  const canSeeReserve = true;
  // 発注業者のインクリメンタルサーチ候補（業者マスタ・システム予約含む）
  const [vendorCandidates, setVendorCandidates] = useState<VendorCandidate[]>([]);
  const [departments, setDepartments] = useState<DepartmentMarginRate[]>([]);
  const [savingDepartment, setSavingDepartment] = useState(false);

  useEffect(() => {
    getVendorCandidates()
      .then(setVendorCandidates)
      .catch(() => {});
    getDepartmentMarginRates()
      .then(setDepartments)
      .catch(() => {});
  }, []);

  const refreshMarginInfo = useCallback(() => {
    getEstimateMarginThreshold(estimate.id)
      .then((r) => {
        if (!r) return;
        setMarginInfo({
          threshold: r.threshold,
          baseThreshold: r.baseThreshold,
          reservePercent: r.reservePercent,
          baseSource: r.baseSource,
          approvalStatus: r.approvalStatus ?? "none",
          remandComment: r.remandComment ?? null,
          workflowRequestId: r.workflowRequestId ?? null,
        });
      })
      .catch(() => {});
  }, [estimate.id]);
  const categories: EstimateCategory[] = estimate.categories ?? [];
  const items: EstimateItem[] = (estimate.items ?? []).filter(
    (item) => !isManagementVendor(vendorCandidates, item.vendor_craftsman_id) && item.vendor_name !== "経営調整費",
  );

  const itemsByCategory = categories.map((cat) => ({
    category: cat,
    items: items.filter((item) => item.category_id === cat.id),
  }));
  const uncategorized = items.filter((item) => !item.category_id);

  // ── 並べ替え（DnD・No.59）────────────────────────────────────────────
  const dndSensors = useSensors(
    useSensor(RowPointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const aData = active.data.current as { type?: string; categoryId?: string } | undefined;
    const oData = over.data.current as { type?: string; categoryId?: string } | undefined;

    if (aData?.type === "category") {
      const overCategoryId =
        oData?.type === "category"
          ? String(over.id)
          : oData?.type === "item" && oData.categoryId && oData.categoryId !== "none"
            ? oData.categoryId
            : null;
      if (!overCategoryId || overCategoryId === String(active.id)) return;
      const oldIndex = categories.findIndex((c) => c.id === active.id);
      const newIndex = categories.findIndex((c) => c.id === overCategoryId);
      if (oldIndex < 0 || newIndex < 0) return;
      const next = arrayMove(categories, oldIndex, newIndex);
      onEstimateChange({ ...estimate, categories: next });
      try {
        await reorderEstimateCategories(estimate.id, next.map((c) => c.id));
      } catch (e) {
        onEstimateChange({ ...estimate, categories });
        toast.error(e instanceof Error ? e.message : "並べ替えの保存に失敗しました");
      }
      return;
    }

    // 明細行は同一大項目（または未分類）内のみ並べ替え可能
    if (aData?.type === "item" && oData?.type === "item" && aData.categoryId === oData.categoryId) {
      const catKey = aData.categoryId;
      const group = items.filter((i) => (i.category_id ?? "none") === catKey);
      const oldIndex = group.findIndex((i) => i.id === active.id);
      const newIndex = group.findIndex((i) => i.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const newGroup = arrayMove(group, oldIndex, newIndex);
      let cursor = 0;
      const nextItems = items.map((i) =>
        (i.category_id ?? "none") === catKey ? newGroup[cursor++] : i,
      );
      onEstimateChange({ ...estimate, items: nextItems });
      try {
        await reorderEstimateItems(estimate.id, newGroup.map((i) => i.id));
      } catch (e) {
        onEstimateChange({ ...estimate, items });
        toast.error(e instanceof Error ? e.message : "並べ替えの保存に失敗しました");
      }
    }
  };

  // 大項目直接入力を含む有効合計（No.68: 詳細行があれば詳細優先）
  const effectiveLineTotals = (() => {
    let sell = 0;
    let cost = 0;
    for (const { category, items: catItems } of itemsByCategory) {
      const eff = effectiveCategoryAmounts(category, catItems);
      sell += eff.selling_amount;
      cost += eff.cost_amount;
    }
    for (const i of uncategorized) {
      if (i.is_text_row) continue;
      sell += Number(i.selling_amount ?? 0);
      cost += Number(i.cost_amount ?? 0);
    }
    return { sell, cost };
  })();

  const reserveVendorId = vendorCandidates.find((c) => c.system_key === "reserve")?.id;
  const reserveCost = items
    .filter((i) => i.vendor_craftsman_id === reserveVendorId || i.vendor_name === "予備費")
    .reduce((s, i) => s + Number(i.cost_amount ?? 0), 0);

  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [inlineAdd, setInlineAdd] = useState<"category" | string | null>(null);
  const [inlineAddKind, setInlineAddKind] = useState<"calc" | "text">("calc");
  const [inlineName, setInlineName] = useState("");
  const [savingLine, setSavingLine] = useState(false);
  const [seedingEmpty, setSeedingEmpty] = useState(false);
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const seededEstimateIdRef = useRef<string | null>(null);
  const { openBridgeChat } = useBridgeChat();

  useEffect(() => {
    setCollapsedIds(new Set());
    setInlineAdd(null);
    seededEstimateIdRef.current = null;
  }, [estimate.id]);

  useEffect(() => {
    refreshMarginInfo();
  }, [refreshMarginInfo]);

  useEffect(() => {
    if (loading || !estimate.id) return;
    if (categories.length > 0 || items.length > 0) return;
    if (seededEstimateIdRef.current === estimate.id) return;

    seededEstimateIdRef.current = estimate.id;
    let cancelled = false;
    setSeedingEmpty(true);

    void (async () => {
      try {
        const cat = await addEstimateCategory(estimate.id, "");
        const item = await addEstimateItem(estimate.id, cat.id, "");
        if (cancelled) return;
        onEstimateChange({
          ...estimate,
          categories: [cat],
          items: [item],
        });
      } catch (e) {
        if (!cancelled) {
          seededEstimateIdRef.current = null;
          toast.error(e instanceof Error ? e.message : "初期行の作成に失敗しました");
        }
      } finally {
        if (!cancelled) setSeedingEmpty(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, estimate, categories.length, items.length, onEstimateChange]);

  useEffect(() => {
    if (inlineAdd) inlineInputRef.current?.focus();
  }, [inlineAdd]);

  const companyId = estimate.company_id ?? "";

  const openRefSelect = async () => {
    setRefSelectOpen(true);
    if (refEstimateList.length > 0) return;
    setRefListLoading(true);
    try {
      const list = await queryClient.fetchQuery({
        queryKey: ESTIMATE_QK.all,
        queryFn: fetchEstimates,
        staleTime: ESTIMATE_STALE_MS,
      });
      setRefEstimateList(
        list
          .filter((e) => e.id !== estimate.id)
          .map((e) => ({
            id: e.id,
            estimate_no: e.estimate_no ?? null,
            title: (e as { title?: string | null }).title ?? null,
            status: (e as { status?: string | null }).status ?? null,
            total: (e as { total?: number | null }).total ?? null,
            customer: (e as { customer?: { name?: string | null; company_name?: string | null } | null }).customer ?? null,
          })),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "見積一覧の取得に失敗しました");
    } finally {
      setRefListLoading(false);
    }
  };

  const handleRefSelect = async (id: string) => {
    setRefSelectOpen(false);
    setRefLoading(true);
    try {
      const data = await queryClient.fetchQuery({
        queryKey: ESTIMATE_QK.detail(id),
        queryFn: () => fetchEstimate(id),
        staleTime: ESTIMATE_DETAIL_STALE_MS,
      });
      setRefEstimate({
        id: data.id,
        estimate_no: data.estimate_no ?? null,
        title: (data as { title?: string | null }).title ?? null,
        status: (data as { status?: string | null }).status ?? null,
        total: (data as { total?: number | null }).total ?? null,
        gross_profit_rate: (data as { gross_profit_rate?: number | null }).gross_profit_rate ?? null,
        categories: data.categories ?? [],
        items: data.items ?? [],
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "見積の読み込みに失敗しました");
    } finally {
      setRefLoading(false);
    }
  };

  const handleRefCatDragStart = (e: React.DragEvent, categoryId: string) => {
    if (!refEstimate) return;
    const cat = refEstimate.categories.find((c) => c.id === categoryId);
    if (!cat) return;
    const catItems = refEstimate.items.filter((i) => i.category_id === categoryId);
    e.dataTransfer.setData("application/x-estimate-cat", JSON.stringify({ cat, items: catItems }));
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleTableDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/x-estimate-cat")) {
      e.preventDefault();
      setIsDragOver(true);
    }
  };

  const handleTableDragLeave = () => setIsDragOver(false);

  const handleTableDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const raw = e.dataTransfer.getData("application/x-estimate-cat");
    if (!raw) return;
    let payload: { cat: EstimateCategory; items: EstimateItem[] };
    try { payload = JSON.parse(raw) as { cat: EstimateCategory; items: EstimateItem[] }; }
    catch { return; }

    try {
      const { category: newCat, items: newItems, totals } = await importCategoryFromReference(
        estimate.id,
        payload.cat.name,
        payload.items.map((item) => ({
          name: item.name,
          specification: item.specification ?? null,
          notes: item.notes ?? null,
          quantity: Number(item.quantity) || 1,
          unit: item.unit ?? null,
          cost_price: Number(item.cost_price) || 0,
          cost_amount: Number(item.cost_amount) || 0,
          selling_price: Number(item.selling_price) || 0,
          selling_amount: Number(item.selling_amount) || 0,
          gross_profit: Number(item.gross_profit) || 0,
          gross_profit_rate: Number(item.gross_profit_rate) || 0,
        })),
      );
      onEstimateChange({
        ...estimate,
        ...totals,
        categories: [...categories, newCat],
        items: [...items, ...newItems],
      });
      toast.success(`「${payload.cat.name || "大項目"}」を追加しました`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "大項目の追加に失敗しました");
    }
  };

  const startAddCategory = () => {
    setInlineName("");
    setInlineAdd("category");
  };

  const startAddItem = (categoryId: string, kind: "calc" | "text" = "calc") => {
    setCollapsedIds((prev) => { const next = new Set(prev); next.delete(categoryId); return next; });
    setInlineName("");
    setInlineAddKind(kind);
    setInlineAdd(categoryId);
  };

  // 独立テキスト行（大項目に紐づかない・No.69②）
  const startAddStandaloneText = () => {
    setInlineName("");
    setInlineAddKind("text");
    setInlineAdd("standalone-text");
  };

  const cancelInline = () => { setInlineAdd(null); setInlineName(""); setInlineAddKind("calc"); };

  const commitInline = async () => {
    if (!estimate.id || !inlineName.trim() || savingLine || !inlineAdd) return;
    const name = inlineName.trim();
    const mode = inlineAdd;
    const prevCategories = categories;
    const prevItems = items;

    if (mode === "category") {
      const tempId = `temp-cat-${Date.now()}`;
      const optimistic: EstimateCategory = {
        id: tempId,
        company_id: companyId,
        estimate_id: estimate.id,
        name,
        sort_order: prevCategories.length,
        created_at: new Date().toISOString(),
      };
      onEstimateChange({ ...estimate, categories: [...prevCategories, optimistic] });
      setInlineName("");
      setInlineAdd(null);
      setSavingLine(true);
      try {
        const cat = await addEstimateCategory(estimate.id, name);
        onEstimateChange({
          ...estimate,
          categories: [...prevCategories, cat],
        });
      } catch (e) {
        onEstimateChange({ ...estimate, categories: prevCategories });
        toast.error(e instanceof Error ? e.message : "追加に失敗しました");
      } finally {
        setSavingLine(false);
      }
      return;
    }

    const isStandalone = mode === "standalone-text";
    const categoryId = isStandalone ? null : mode;
    const isTextRow = isStandalone || inlineAddKind === "text";
    const tempId = `temp-item-${Date.now()}`;
    const optimistic: EstimateItem = {
      id: tempId,
      company_id: companyId,
      estimate_id: estimate.id,
      category_id: categoryId,
      name,
      description: null,
      specification: null,
      quantity: isTextRow ? 0 : 1,
      unit: isTextRow ? null : "式",
      cost_price: 0,
      cost_amount: 0,
      selling_price: 0,
      selling_amount: 0,
      gross_profit: 0,
      gross_profit_rate: 0,
      sort_order: prevItems.filter((i) => (i.category_id ?? null) === categoryId).length,
      notes: null,
      is_text_row: isTextRow,
      text_row_scope: isTextRow ? (categoryId ? "category" : "standalone") : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    onEstimateChange({ ...estimate, items: [...prevItems, optimistic] });
    setInlineName("");
    setInlineAdd(null);
    setSavingLine(true);
    try {
      const item = await addEstimateItem(estimate.id, categoryId, name, { isTextRow });
      onEstimateChange({
        ...estimate,
        items: [...prevItems, item],
      });
    } catch (e) {
      onEstimateChange({ ...estimate, items: prevItems });
      toast.error(e instanceof Error ? e.message : "追加に失敗しました");
    } finally {
      setSavingLine(false);
      setInlineAddKind("calc");
    }
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void commitInline();
    }
    if (e.key === "Escape") cancelInline();
  };

  const handleItemUpdate = (updatedItem: EstimateItem, totals?: EstimateTotalsPatch) => {
    onEstimateChange({
      ...estimate,
      items: items.map((i) => (i.id === updatedItem.id ? updatedItem : i)),
      ...(totals ?? {}),
    });
  };

  const handleItemDelete = async (item: EstimateItem) => {
    if (item.id.startsWith("temp-")) return;
    if (!window.confirm("この行を削除しますか？")) return;
    const prevItems = items;
    onEstimateChange({ ...estimate, items: items.filter((i) => i.id !== item.id) });
    try {
      const { totals } = await deleteEstimateItem(item.id);
      onEstimateChange({
        ...estimate,
        items: items.filter((i) => i.id !== item.id),
        ...(totals ?? {}),
      });
    } catch (e) {
      onEstimateChange({ ...estimate, items: prevItems });
      toast.error(e instanceof Error ? e.message : "削除に失敗しました");
    }
  };

  const handleCategoryDelete = async (category: EstimateCategory) => {
    if (category.id.startsWith("temp-")) return;
    if (!window.confirm("この大項目と配下の明細を削除しますか？")) return;
    const prevCategories = categories;
    const prevItems = items;
    onEstimateChange({
      ...estimate,
      categories: categories.filter((c) => c.id !== category.id),
      items: items.filter((i) => i.category_id !== category.id),
    });
    try {
      const { totals } = await deleteEstimateCategory(category.id);
      onEstimateChange({
        ...estimate,
        categories: categories.filter((c) => c.id !== category.id),
        items: items.filter((i) => i.category_id !== category.id),
        ...(totals ?? {}),
      });
    } catch (e) {
      onEstimateChange({ ...estimate, categories: prevCategories, items: prevItems });
      toast.error(e instanceof Error ? e.message : "削除に失敗しました");
    }
  };

  const applyBulkMargin = async (mode: "cost" | "sell", rateStr: string) => {
    const rate = parseFloat(rateStr);
    if (Number.isNaN(rate) || rate < 0 || rate >= 100) {
      toast.error("粗利率は 0〜99.9% の範囲で入力してください");
      return;
    }
    setBulkApplying(true);
    try {
      const res = await fetch(`/api/estimates/${estimate.id}/bulk-margin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, ratePercent: rate }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        items?: EstimateItem[];
        totals?: EstimateTotalsPatch;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "一括設定に失敗しました");
      }
      onEstimateChange({
        ...estimate,
        items: (data.items ?? []) as EstimateItem[],
        ...(data.totals ?? {}),
      });
      toast.success(mode === "cost" ? "原価を一括設定しました" : "見積金額を一括設定しました");
      if (mode === "cost") setBulkCostOpen(false);
      else setBulkSellOpen(false);
    } catch (e) {
      toast.error(humanizeClientError(e, "一括設定に失敗しました。ページを再読み込みして再度お試しください"));
    } finally {
      setBulkApplying(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  // 明細からライブ算出（estimate.cost_total が古いと¥0表示になるため画面上はこちらを正とする）
  const liveSell = effectiveLineTotals.sell;
  const reservePercentPreview = marginInfo?.reservePercent ?? 0;
  const managementCost = marginInfo
    ? calcManagementFeeAmount({
        sellingTotal: liveSell,
        reserveCost,
        rate: reservePercentPreview / 100,
      })
    : Number(estimate.reserve_fee_1_amount ?? 0);
  const liveDetailCost = effectiveLineTotals.cost;
  const liveCost = liveDetailCost + managementCost;
  const liveTax = Math.floor(liveSell * 0.1);
  const liveTotal = liveSell + liveTax;
  const liveGross = liveSell - liveCost;
  const liveGrossRate = liveSell > 0 ? (liveGross / liveSell) * 100 : 0;
  const grossRate = liveGrossRate || (estimate.gross_profit_rate ?? 0);
  // 承認の基準は部門/会社設定（指定粗利率＋経営調整費率）をサーバーから取得
  const marginThreshold = marginInfo?.threshold ?? toMarginThresholdPercent(estimate.default_gross_profit_rate);
  const reservePercent = marginInfo?.reservePercent ?? 0;
  const baseThreshold = marginInfo?.baseThreshold ?? marginThreshold;
  const baseLabel = marginInfo?.baseSource === "department" ? "部門指定" : "指定";
  const isLowMargin = grossRate < marginThreshold;

  const handleDepartmentChange = async (value: string) => {
    const next = value === "__none__" ? null : value;
    const prev = estimate.department_name ?? null;
    if (next === prev) return;
    setSavingDepartment(true);
    onEstimateChange({ ...estimate, department_name: next });
    try {
      await updateEstimate(estimate.id, { department_name: next });
      refreshMarginInfo();
    } catch (e) {
      onEstimateChange({ ...estimate, department_name: prev });
      toast.error(humanizeClientError(e, "部門の更新に失敗しました"));
    } finally {
      setSavingDepartment(false);
    }
  };
  const approvalStatus = marginInfo?.approvalStatus ?? "none";
  const isReturned = approvalStatus === "returned";
  const isRejected = approvalStatus === "rejected";
  const showApprovalNotice = isReturned || isRejected;

  return (
    <div className={cn("space-y-3", loading && "opacity-60")}>
      {/* ヘッダー: 左=メタ / 右=ボタン群のみ */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {onBack && (
            <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground shrink-0">
              <ArrowLeft className="h-3.5 w-3.5" />見積一覧
            </button>
          )}
          {estimate.title && (
            <span className="text-base font-semibold truncate">{estimate.title}</span>
          )}
          {estimate.estimate_no && (
            <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">
              {estimate.estimate_no}
            </span>
          )}
          {estimate.status && (
            <Badge variant="outline" className="text-xs shrink-0">{ESTIMATE_STATUS_MAP[estimate.status] ?? estimate.status}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-[var(--brand-dark)] border-[var(--brand-dark)]/25 bg-[var(--brand-dark)]/5 hover:bg-[var(--brand-dark)]/10"
            onClick={() => {
              openBridgeChat({
                estimateDraft: {
                  estimateId: estimate.id,
                  onApplied: (updated) => {
                    onEstimateChange(updated as EstimateForView);
                    toast.success("Linq ドラフトを見積に反映しました（要確認・調整）");
                  },
                },
              });
            }}
          >
            <Sparkles className="h-4 w-4" />
            Linqと共に作成
          </Button>
          <Popover open={refSelectOpen} onOpenChange={(o) => { setRefSelectOpen(o); if (!o) setRefSearch(""); }}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={openRefSelect}
                disabled={refLoading}
              >
                {refLoading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <BookOpen className="h-4 w-4 mr-1" />
                }
                見積参照
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[380px] p-3" align="end">
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-semibold">どの見積もりを参照しますか？</p>
                  <p className="text-xs text-muted-foreground mt-0.5">大項目をドラッグ&amp;ドロップで追加できます</p>
                </div>
                {refListLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />読み込み中…
                  </div>
                ) : (
                  <>
                    <Input
                      placeholder="見積番号・件名・顧客名で検索..."
                      value={refSearch}
                      onChange={(e) => setRefSearch(e.target.value)}
                      className="h-8 text-xs"
                      autoFocus
                    />
                    <div className="max-h-[280px] overflow-y-auto -mx-1">
                      {(() => {
                        const q = refSearch.trim().toLowerCase();
                        const filtered = q
                          ? refEstimateList.filter((e) =>
                              (e.estimate_no ?? "").toLowerCase().includes(q) ||
                              (e.title ?? "").toLowerCase().includes(q) ||
                              (e.customer?.name ?? "").toLowerCase().includes(q) ||
                              (e.customer?.company_name ?? "").toLowerCase().includes(q)
                            )
                          : refEstimateList;
                        if (filtered.length === 0) {
                          return (
                            <p className="py-4 text-center text-xs text-muted-foreground">
                              {refEstimateList.length === 0 ? "見積がありません" : "検索結果がありません"}
                            </p>
                          );
                        }
                        return filtered.map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => handleRefSelect(e.id)}
                            className="w-full text-left px-2 py-2 rounded-md hover:bg-muted/60 transition-colors"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-mono text-muted-foreground shrink-0">{e.estimate_no ?? "—"}</span>
                              <span className="text-xs font-medium truncate flex-1">{e.title ?? <span className="text-muted-foreground">無題</span>}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">¥{(e.total ?? 0).toLocaleString()}</span>
                            </div>
                            {(e.customer?.name || e.customer?.company_name) && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 ml-0.5">
                                {e.customer.company_name ?? e.customer.name}
                              </p>
                            )}
                          </button>
                        ));
                      })()}
                    </div>
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FileDown className="h-4 w-4 mr-1" />PDFプレビュー
                <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setPdfData(toEstimatePdfPreviewData({
                    ...estimate,
                    items,
                    subtotal: liveSell,
                    tax: liveTax,
                    total: liveTotal,
                    cost_total: liveCost,
                    reserve_fee_1_amount: managementCost,
                  }, pdfCustomer));
                  setPdfOpen(true);
                }}
              >
                見積書（顧客向け）
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setPdfData(toCostBreakdownPdfPreviewData({
                    ...estimate,
                    items,
                    subtotal: liveSell,
                    tax: liveTax,
                    total: liveTotal,
                    cost_total: liveCost,
                    reserve_fee_1_amount: managementCost,
                  }, pdfCustomer));
                  setPdfOpen(true);
                }}
              >
                原価内訳書（社内・経営調整費・予備費含む）
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <EstimateApprovalActions
            estimateId={estimate.id}
            departmentName={estimate.department_name}
            grossProfitRate={grossRate}
            defaultGrossProfitRate={estimate.default_gross_profit_rate}
            estimateStatus={estimate.status}
            systemFeesOk
            onConfirmed={() => {
              onEstimateChange({
                ...estimate,
                status: "issued",
                gross_profit_rate: grossRate,
              });
            }}
            onStatusChange={refreshMarginInfo}
          />
          {headerExtra}
        </div>
      </div>

      {/* サマリー（KPI + 警告を1カードに統合） */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border/60">
          <div className="px-3 py-2">
            <p className="text-[10px] leading-tight text-muted-foreground">売上(税込)</p>
            <p className="text-base font-bold tabular-nums leading-tight mt-px">¥{liveTotal.toLocaleString()}</p>
          </div>
          <div className="px-3 py-2">
            <p className="text-[10px] leading-tight text-muted-foreground">原価</p>
            <p className="text-base font-bold tabular-nums leading-tight mt-px">¥{liveCost.toLocaleString()}</p>
            {/* No.107: 原価内訳は常時表示（ポップアップだと overflow で見切れるため） */}
            <div className="mt-1.5 space-y-0.5 text-[10px] leading-tight">
              <div className="flex justify-between gap-2 text-muted-foreground">
                <span>明細原価{reserveCost > 0 ? "（予備費含む）" : ""}</span>
                <span className="tabular-nums">¥{liveDetailCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-2 text-muted-foreground">
                <span>
                  経営調整費
                  {reservePercent > 0 ? `（見積全体の${reservePercent.toFixed(0)}%・会社規定）` : ""}
                </span>
                <span className="tabular-nums">¥{managementCost.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="px-3 py-2">
            <p className="text-[10px] leading-tight text-muted-foreground">粗利</p>
            <p className="text-base font-bold tabular-nums leading-tight mt-px">
              ¥{liveGross.toLocaleString()}
            </p>
          </div>
          <div className={cn("px-3 py-2", isLowMargin && "bg-amber-50/60")}>
            <div className="flex items-center justify-between gap-2">
              <p className={cn("text-[10px] leading-tight", isLowMargin ? "text-amber-700" : "text-muted-foreground")}>
                粗利率
              </p>
              <Select
                value={estimate.department_name || "__none__"}
                onValueChange={(v) => void handleDepartmentChange(v)}
                disabled={savingDepartment || departments.length === 0}
              >
                <SelectTrigger
                  size="sm"
                  className={cn(
                    "h-6 w-auto min-w-[96px] max-w-[140px] px-1.5 text-[10px] shadow-none",
                    isLowMargin && "border-amber-200 bg-white/80",
                  )}
                >
                  <SelectValue placeholder="部門" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="__none__">部門未選択</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.department_name}>
                      {d.department_name}
                      <span className="ml-1.5 text-muted-foreground tabular-nums">({d.margin_rate_percent}%)</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className={cn("text-base font-bold tabular-nums leading-tight mt-px", isLowMargin ? "text-amber-600" : "text-emerald-700")}>
              {grossRate.toFixed(1)}%
            </p>
            <p className={cn("text-[10px] leading-tight mt-0.5", isLowMargin ? "text-amber-700/80" : "text-muted-foreground")}>
              基準 {marginThreshold.toFixed(0)}%
              {canSeeReserve && reservePercent > 0
                ? `＝${baseLabel}${baseThreshold.toFixed(0)}%+経営調整費${reservePercent.toFixed(0)}%`
                : ""}
            </p>
          </div>
        </div>
        {showApprovalNotice ? (
          <div className={cn(
            "border-t px-3 py-2.5 text-[11px] leading-relaxed",
            isReturned
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-rose-200 bg-rose-50 text-rose-800",
          )}>
            <p className="font-medium flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                {isReturned
                  ? "差戻しされています。修正のうえ再申請してください。"
                  : "却下されています。内容を見直して再申請できます。"}
              </span>
            </p>
            {marginInfo?.remandComment && (
              <p className="mt-1 pl-5 text-muted-foreground break-words">指摘: {marginInfo.remandComment}</p>
            )}
            {marginInfo?.workflowRequestId && (
              <Link
                href={`/workflow/${marginInfo.workflowRequestId}`}
                className="mt-1.5 ml-5 inline-block font-medium underline underline-offset-2"
              >
                申請詳細を確認
              </Link>
            )}
          </div>
        ) : isLowMargin ? (
          <div className="flex items-center gap-1.5 border-t border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium leading-tight text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            粗利率が基準({marginThreshold.toFixed(0)}%)を下回っています。上司への承認申請が必要です。
          </div>
        ) : null}
      </div>

      {/* 明細テーブル */}
      <div className={cn("flex gap-3 items-start", !refEstimate && "block")}>
        {refEstimate && (
          <RefPanel
            refEstimate={refEstimate}
            onClose={() => setRefEstimate(null)}
            onDragStart={handleRefCatDragStart}
          />
        )}
        <div
          className={cn(
            "rounded-xl border border-border overflow-x-auto transition-colors",
            refEstimate && "flex-1 min-w-0",
            isDragOver && "ring-2 ring-primary/40 border-primary/40 bg-primary/5",
          )}
          onDragOver={handleTableDragOver}
          onDragLeave={handleTableDragLeave}
          onDrop={handleTableDrop}
        >
          {isDragOver && (
            <div className="px-4 py-2 text-xs text-primary font-medium text-center border-b border-dashed border-primary/30">
              ここにドロップして大項目を追加
            </div>
          )}
        <DndContext sensors={dndSensors} collisionDetection={estimateDndCollision} onDragEnd={(e) => void handleDragEnd(e)}>
        <table className="w-full text-xs border-collapse min-w-[1100px] table-fixed">
          <colgroup>
            <col className="w-[9%]" />
            <col className="w-[11%]" />
            <col className="w-[10%]" />
            <col className="w-14" />
            <col className="w-12" />
            <col className="w-[6rem]" />
            <col className="w-[6.5rem]" />
            <col className="w-[6rem]" />
            <col className="w-[6.5rem]" />
            <col className="w-14" />
            <col className="w-[5rem]" />
          </colgroup>
          <thead className="bg-muted/40">
            <tr>
              <th colSpan={5} className="bg-muted/40" />
              <th colSpan={2} className="px-2 py-1.5 bg-amber-50/50 border-b border-border/40">
                <Popover open={bulkCostOpen} onOpenChange={setBulkCostOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-full text-[11px] gap-1 text-amber-800 border-amber-200/80 bg-amber-50/60 hover:bg-amber-100"
                      disabled={bulkApplying}
                    >
                      {bulkApplying && bulkCostOpen
                        ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                        : <ArrowLeft className="h-3 w-3 shrink-0" />
                      }
                      原価を一覧作成
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3" align="center">
                    <p className="text-xs font-semibold mb-1">目標粗利率を設定</p>
                    <p className="text-[10px] text-muted-foreground mb-2">
                      全明細の「原価」を<br />
                      <code className="bg-muted px-1 rounded text-[10px]">原価 = 見積単価 × (1 − 粗利率)</code><br />
                      で一括計算します。
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={0}
                        max={99}
                        step={0.5}
                        className="h-8 text-xs text-right"
                        value={bulkRateCost}
                        onChange={(e) => setBulkRateCost(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") void applyBulkMargin("cost", bulkRateCost); }}
                        autoFocus
                      />
                      <span className="text-xs text-muted-foreground shrink-0">%</span>
                      <Button
                        size="sm"
                        className="h-8 text-xs shrink-0"
                        disabled={bulkApplying}
                        onClick={() => void applyBulkMargin("cost", bulkRateCost)}
                      >
                        {bulkApplying ? <Loader2 className="h-3 w-3 animate-spin" /> : "適用"}
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </th>
              <th colSpan={2} className="px-2 py-1.5 bg-blue-50/50 border-b border-border/40">
                <Popover open={bulkSellOpen} onOpenChange={setBulkSellOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-full text-[11px] gap-1 text-blue-800 border-blue-200/80 bg-blue-50/60 hover:bg-blue-100"
                      disabled={bulkApplying}
                    >
                      見積金額を一覧作成
                      {bulkApplying && bulkSellOpen
                        ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                        : <Plus className="h-3 w-3 shrink-0" />
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3" align="center">
                    <p className="text-xs font-semibold mb-1">目標粗利率を設定</p>
                    <p className="text-[10px] text-muted-foreground mb-2">
                      全明細の「見積金額」を<br />
                      <code className="bg-muted px-1 rounded text-[10px]">見積単価 = 原価 ÷ (1 − 粗利率)</code><br />
                      で一括計算します。
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={0}
                        max={99}
                        step={0.5}
                        className="h-8 text-xs text-right"
                        value={bulkRateSell}
                        onChange={(e) => setBulkRateSell(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") void applyBulkMargin("sell", bulkRateSell); }}
                        autoFocus
                      />
                      <span className="text-xs text-muted-foreground shrink-0">%</span>
                      <Button
                        size="sm"
                        className="h-8 text-xs shrink-0"
                        disabled={bulkApplying}
                        onClick={() => void applyBulkMargin("sell", bulkRateSell)}
                      >
                        {bulkApplying ? <Loader2 className="h-3 w-3 animate-spin" /> : "適用"}
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </th>
              <th colSpan={2} className="bg-muted/40 border-b border-border/40" />
            </tr>
            <tr className="text-muted-foreground text-xs whitespace-nowrap">
              <th className="text-left px-2 py-2 font-medium">大項目／詳細項目</th>
              <th className="text-left px-2 py-2 font-medium">形状・摘要</th>
              <th className="text-left px-2 py-2 font-medium">発注業者</th>
              <th className="text-right px-1.5 py-2 font-medium w-14">数量</th>
              <th className="text-center px-1 py-2 font-medium w-12">単位</th>
              <th className="text-right px-2 py-2 font-medium bg-amber-50/60 text-amber-700 min-w-[6rem]">原単価</th>
              <th className="text-right px-2 py-2 font-medium bg-amber-50/60 text-amber-700 min-w-[6.5rem]">原価</th>
              <th className="text-right px-2 py-2 font-medium bg-blue-50/50 text-blue-700 min-w-[6rem]">見積単価</th>
              <th className="text-right px-2 py-2 font-medium bg-blue-50/50 text-blue-700 min-w-[6.5rem]">見積金額</th>
              <th className="text-right px-2 py-2 font-medium w-14">粗利率</th>
              <th className="text-left px-2 py-2 font-medium">備考</th>
            </tr>
          </thead>
          <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <tbody>
          {itemsByCategory.map(({ category, items: catItems }) => {
            const collapsed = collapsedIds.has(category.id);
            const isAddingHere = inlineAdd === category.id;
            return (
              <SortableCategoryGroup key={category.id} id={category.id}>
                {({ handleProps, setHeaderRef, headerStyle, isDragging, followStyle }) => (
                  <>
                <CategoryHeaderRow
                  category={category}
                  catItems={catItems}
                  collapsed={collapsed}
                  candidates={vendorCandidates}
                  onToggle={() => toggleCategory(category.id)}
                  onRenamed={(next) => {
                    onEstimateChange({
                      ...estimate,
                      categories: categories.map((c) => (c.id === next.id ? { ...c, name: next.name } : c)),
                    });
                  }}
                  onCategoryPatched={(next, totals) => {
                    onEstimateChange({
                      ...estimate,
                      categories: categories.map((c) => (c.id === next.id ? next : c)),
                      ...(totals ?? {}),
                    });
                  }}
                  onDelete={(cat) => void handleCategoryDelete(cat)}
                  handleProps={handleProps}
                  setNodeRef={setHeaderRef}
                  style={headerStyle}
                  isDragging={isDragging}
                />
                <SortableContext items={catItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  {!collapsed && catItems.map((item) => (
                    <EstimateItemRow
                      key={item.id}
                      item={item}
                      candidates={vendorCandidates}
                      onUpdate={handleItemUpdate}
                      onDelete={(row) => void handleItemDelete(row)}
                      followStyle={followStyle}
                    />
                  ))}
                </SortableContext>
                {!collapsed && isAddingHere && (
                  <tr className="border-t border-primary/20 bg-primary/5" style={followStyle}>
                    <td className="px-2 py-1.5" colSpan={11}>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground shrink-0">＋</span>
                        <input
                          ref={inlineInputRef}
                          type="text"
                          autoFocus
                          value={inlineName}
                          onChange={(e) => setInlineName(e.target.value)}
                          onKeyDown={handleInlineKeyDown}
                          placeholder={inlineAddKind === "text" ? "注釈テキストを入力..." : "詳細項目名を入力..."}
                          className="flex-1 bg-transparent border-b border-primary outline-none text-xs py-0.5 placeholder:text-muted-foreground/50"
                        />
                        {savingLine
                          ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
                          : (
                            <>
                              <button type="button" onClick={() => void commitInline()} disabled={!inlineName.trim()} className="text-[10px] text-primary font-medium hover:underline disabled:opacity-40">
                                {inlineAddKind === "text" ? "テキスト行を追加" : "追加"}
                              </button>
                              <button type="button" onClick={cancelInline} className="text-[10px] text-muted-foreground hover:underline">キャンセル</button>
                            </>
                          )
                        }
                      </div>
                    </td>
                  </tr>
                )}
                {!collapsed && !isAddingHere && inlineAdd === null && (
                  <tr style={followStyle}>
                    <td colSpan={11} className="p-0">
                      <div className="px-3 py-2 border-t border-dashed border-border/40 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startAddItem(category.id, "calc")}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:bg-primary/5 rounded px-2 py-1"
                        >
                          <Plus className="h-3 w-3" />計算行を追加
                        </button>
                        <button
                          type="button"
                          onClick={() => startAddItem(category.id, "text")}
                          className="inline-flex items-center gap-1 text-xs text-slate-600 hover:bg-slate-100 rounded px-2 py-1"
                        >
                          <Plus className="h-3 w-3" />テキスト行を追加
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                  </>
                )}
              </SortableCategoryGroup>
            );
          })}
          </tbody>
          </SortableContext>

          {/* 未分類項目（独立テキスト行含む） */}
          {uncategorized.length > 0 && (
            <tbody>
              <SortableContext items={uncategorized.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                {uncategorized.map((item) => (
                  <EstimateItemRow
                    key={item.id}
                    item={item}
                    candidates={vendorCandidates}
                    onUpdate={handleItemUpdate}
                    onDelete={(row) => void handleItemDelete(row)}
                  />
                ))}
              </SortableContext>
            </tbody>
          )}

          {seedingEmpty && (
            <tbody>
              <tr>
                <td colSpan={11} className="py-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />
                  入力欄を準備しています…
                </td>
              </tr>
            </tbody>
          )}

          {/* 大項目追加 */}
          <tfoot className="group/cat-add">
            {inlineAdd === "standalone-text" ? (
              <tr className="border-t border-primary/20 bg-primary/5">
                <td className="px-2 py-1.5" colSpan={11}>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground shrink-0">＋</span>
                    <Badge variant="outline" className="text-[10px] shrink-0 border-slate-300 text-slate-600">
                      独立テキスト行
                    </Badge>
                    <input
                      ref={inlineInputRef}
                      type="text"
                      autoFocus
                      value={inlineName}
                      onChange={(e) => setInlineName(e.target.value)}
                      onKeyDown={handleInlineKeyDown}
                      placeholder="注釈テキストを入力（大項目に紐づかない独立行）..."
                      className="flex-1 bg-transparent border-b border-primary outline-none text-xs py-0.5 placeholder:text-muted-foreground/50"
                    />
                    {savingLine
                      ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
                      : (
                        <>
                          <button type="button" onClick={() => void commitInline()} disabled={!inlineName.trim()} className="text-[10px] text-primary font-medium hover:underline disabled:opacity-40">追加</button>
                          <button type="button" onClick={cancelInline} className="text-[10px] text-muted-foreground hover:underline">キャンセル</button>
                        </>
                      )
                    }
                  </div>
                </td>
              </tr>
            ) : inlineAdd === "category" ? (
              <tr className="border-t border-primary/20 bg-primary/5">
                <td className="px-2 py-1.5" colSpan={11}>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground shrink-0">＋</span>
                    <input
                      ref={inlineInputRef}
                      type="text"
                      autoFocus
                      value={inlineName}
                      onChange={(e) => setInlineName(e.target.value)}
                      onKeyDown={handleInlineKeyDown}
                      placeholder="大項目名を入力..."
                      className="flex-1 bg-transparent border-b border-primary outline-none text-xs font-semibold py-0.5 placeholder:text-muted-foreground/50"
                    />
                    {savingLine
                      ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
                      : (
                        <>
                          <button type="button" onClick={() => void commitInline()} disabled={!inlineName.trim()} className="text-[10px] text-primary font-medium hover:underline disabled:opacity-40">追加</button>
                          <button type="button" onClick={cancelInline} className="text-[10px] text-muted-foreground hover:underline">キャンセル</button>
                        </>
                      )
                    }
                  </div>
                </td>
              </tr>
            ) : inlineAdd === null ? (
              <tr>
                <td colSpan={11} className="p-0">
                  <div className="px-3 py-2.5 border-t border-dashed border-border/40 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={startAddCategory}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:bg-primary/5 rounded px-2 py-1"
                    >
                      <Plus className="h-3.5 w-3.5" />大項目を追加
                    </button>
                    <button
                      type="button"
                      onClick={startAddStandaloneText}
                      className="inline-flex items-center gap-1 text-xs text-slate-600 hover:bg-slate-100 rounded px-2 py-1"
                    >
                      <Plus className="h-3 w-3" />独立テキスト行を追加
                    </button>
                  </div>
                </td>
              </tr>
            ) : null}
            <tr className="bg-amber-50/70 border-t border-amber-200/80">
              <td colSpan={5} className="px-3 py-2 text-right text-xs text-amber-900">
                経営調整費
                {reservePercent > 0
                  ? `（売価＋予備費の${reservePercent.toFixed(0)}%・会社規定・自動）`
                  : "（会社規定率・自動／未設定）"}
              </td>
              <td colSpan={2} className="px-3 py-2 text-right tabular-nums text-xs text-amber-900">
                ¥{managementCost.toLocaleString()}
              </td>
              <td colSpan={2} className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">¥0</td>
              <td colSpan={2} className="px-3 py-2" />
            </tr>
            <tr className="bg-slate-100/70 border-t border-border/40 font-bold">
              <td colSpan={5} className="px-3 py-3 text-right text-sm">合計</td>
              <td colSpan={2} className="px-3 py-3 text-right tabular-nums text-base">¥{liveCost.toLocaleString()}</td>
              <td colSpan={2} className="px-3 py-3 text-right tabular-nums text-base">¥{liveTotal.toLocaleString()}</td>
              <td colSpan={2} className="px-3 py-3 text-right tabular-nums text-sm">{grossRate.toFixed(1)}%</td>
            </tr>
          </tfoot>
        </table>
        </DndContext>
        </div>
      </div>

      {pdfData && (
        <EstimatePdfPreviewDialog
          open={pdfOpen}
          onOpenChange={(open) => {
            setPdfOpen(open);
            if (!open) setPdfData(null);
          }}
          data={pdfData}
        />
      )}
    </div>
  );
}
