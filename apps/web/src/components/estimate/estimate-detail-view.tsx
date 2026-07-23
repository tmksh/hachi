"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Loader2, FileDown, BookOpen, X, GripVertical, ChevronRight, ChevronDown, AlertTriangle } from "lucide-react";
import type { EstimateCategory, EstimateItem } from "@/lib/database.types";
import {
  addEstimateCategory,
  addEstimateItem,
  updateEstimateItem,
  updateEstimateCategoryName,
  importCategoryFromReference,
  bulkApplyMarginToEstimate,
  type EstimateItemUpdatePatch,
} from "@/lib/actions/constructions";
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
import { getEstimates, getEstimate, updateEstimate } from "@/lib/actions/estimates";
import { EstimateApprovalActions } from "@/components/estimate/estimate-approval-actions";
import { getEstimateMarginThreshold } from "@/lib/actions/sales-flow";
import { calcGrossProfitRatePercent, toMarginThresholdPercent } from "@/lib/estimate-margin";
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
  company_id?: string;
  cost_total?: number;
  reserve_fee_1_rate?: number;
  reserve_fee_2_rate?: number;
  reserve_fee_1_amount?: number;
  reserve_fee_2_amount?: number;
  default_gross_profit_rate?: number;
  categories?: EstimateCategory[];
  items?: EstimateItem[];
};

function recalcItemAmounts(item: EstimateItem): EstimateItem {
  const qty = Number(item.quantity) || 0;
  const costPrice = Number(item.cost_price) || 0;
  const sellingPrice = Number(item.selling_price) || 0;
  const costAmount = Math.round(qty * costPrice);
  const sellingAmount = Math.round(qty * sellingPrice);
  const grossProfit = sellingAmount - costAmount;
  const grossProfitRate = sellingAmount > 0 ? (grossProfit / sellingAmount) * 100 : 0;
  return {
    ...item,
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
  onUpdate,
}: {
  item: EstimateItem;
  onUpdate: (item: EstimateItem, totals?: EstimateTotalsPatch) => void;
}) {
  const [draft, setDraft] = useState(item);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(item);
  }, [item]);

  const isTemp = item.id.startsWith("temp-");

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

  const isTextRow = Boolean(draft.is_text_row);

  if (isTextRow) {
    return (
      <tr className={cn("border-t border-border/40 bg-slate-50/60 hover:bg-muted/10", saving && "opacity-70")}>
        <td className="px-2 py-1 text-center">
          <input type="checkbox" className="rounded border-slate-300" />
        </td>
        <td className="px-2 py-1.5" colSpan={10}>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] shrink-0 border-slate-300 text-slate-600">
              テキスト行
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
        <td className="px-2 py-1.5 text-muted-foreground text-[10px] whitespace-nowrap">売価ゼロ</td>
      </tr>
    );
  }

  return (
    <tr className={cn("border-t border-border/40 hover:bg-muted/10", saving && "opacity-70")}>
      <td className="px-2 py-1 text-center">
        <input type="checkbox" className="rounded border-slate-300" />
      </td>
      <td className="px-2 py-1.5 whitespace-nowrap">
        <input
          className={ITEM_CELL}
          value={draft.name}
          disabled={isTemp}
          placeholder="詳細項目名"
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          onBlur={() => void commit("name", draft.name)}
        />
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
        <input
          className={cn(ITEM_CELL, "text-muted-foreground")}
          value={draft.notes ?? ""}
          placeholder="—"
          disabled={isTemp}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          onBlur={() => void commit("notes", draft.notes ?? "")}
        />
      </td>
      <td className="px-1.5 py-1.5 whitespace-nowrap w-14">
        <input
          type="number"
          min={0}
          step="any"
          className={ITEM_CELL_NUM}
          value={draft.quantity}
          disabled={isTemp}
          onChange={(e) => {
            const qty = Number(e.target.value) || 0;
            setDraft((d) => recalcItemAmounts({ ...d, quantity: qty }));
          }}
          onBlur={() => void commit("quantity", draft.quantity)}
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
        <input
          type="number"
          min={0}
          step="1"
          className={cn(ITEM_CELL_NUM, "text-amber-700")}
          value={draft.cost_price}
          disabled={isTemp}
          onChange={(e) => {
            const costPrice = Number(e.target.value) || 0;
            setDraft((d) => recalcItemAmounts({ ...d, cost_price: costPrice }));
          }}
          onBlur={() => void commit("cost_price", draft.cost_price)}
        />
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums text-xs text-amber-700 bg-amber-50/30 whitespace-nowrap min-w-[6.5rem]">
        ¥{(draft.cost_amount ?? 0).toLocaleString()}
      </td>
      <td className="px-1.5 py-1.5 bg-blue-50/30 whitespace-nowrap min-w-[6rem]">
        <input
          type="number"
          min={0}
          step="1"
          className={cn(ITEM_CELL_NUM, "text-blue-700")}
          value={draft.selling_price}
          disabled={isTemp}
          onChange={(e) => {
            const sellingPrice = Number(e.target.value) || 0;
            setDraft((d) => recalcItemAmounts({ ...d, selling_price: sellingPrice }));
          }}
          onBlur={() => void commit("selling_price", draft.selling_price)}
        />
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums text-xs text-blue-700 bg-blue-50/30 font-medium whitespace-nowrap min-w-[6.5rem]">
        ¥{(draft.selling_amount ?? 0).toLocaleString()}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums text-xs whitespace-nowrap w-14">
        {(draft.gross_profit_rate ?? 0).toFixed(1)}%
      </td>
      <td className="px-2 py-1.5 text-muted-foreground text-xs whitespace-nowrap">—</td>
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
  pdfCustomer?: { name?: string | null; company_name?: string | null } | null;
}) {
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
    approvalStatus: string;
    remandComment: string | null;
    workflowRequestId: string | null;
  } | null>(null);
  // 予備費は社員にも表示（非表示による不信感を防止）
  const canSeeReserve = true;

  const refreshMarginInfo = useCallback(() => {
    getEstimateMarginThreshold(estimate.id)
      .then((r) => {
        if (!r) return;
        setMarginInfo({
          threshold: r.threshold,
          baseThreshold: r.baseThreshold,
          reservePercent: r.reservePercent,
          approvalStatus: r.approvalStatus ?? "none",
          remandComment: r.remandComment ?? null,
          workflowRequestId: r.workflowRequestId ?? null,
        });
      })
      .catch(() => {});
  }, [estimate.id]);
  const categories: EstimateCategory[] = estimate.categories ?? [];
  const items: EstimateItem[] = estimate.items ?? [];
  const costTotal = estimate.cost_total ?? 0;
  const reserve1Amount = Number(estimate.reserve_fee_1_amount ?? 0);
  const reserve2Amount = Number(estimate.reserve_fee_2_amount ?? 0);

  const itemsByCategory = categories.map((cat) => ({
    category: cat,
    items: items.filter((item) => item.category_id === cat.id),
  }));
  const uncategorized = items.filter((item) => !item.category_id);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [inlineAdd, setInlineAdd] = useState<"category" | string | null>(null);
  const [inlineAddKind, setInlineAddKind] = useState<"calc" | "text">("calc");
  const [inlineName, setInlineName] = useState("");
  const [savingLine, setSavingLine] = useState(false);
  const [savingReserve, setSavingReserve] = useState(false);
  const [seedingEmpty, setSeedingEmpty] = useState(false);
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const seededEstimateIdRef = useRef<string | null>(null);

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
      const list = await getEstimates();
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
      const data = await getEstimate(id);
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

    const categoryId = mode;
    const isTextRow = inlineAddKind === "text";
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
      sort_order: prevItems.filter((i) => i.category_id === categoryId).length,
      notes: null,
      is_text_row: isTextRow,
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

  const handleReserveAmountChange = async (field: "reserve_fee_1_amount" | "reserve_fee_2_amount", value: number) => {
    const next = Math.max(0, Math.round(value) || 0);
    const prev = { ...estimate };
    onEstimateChange({ ...estimate, [field]: next });
    setSavingReserve(true);
    try {
      await updateEstimate(estimate.id, { [field]: next });
      // 合計再計算はサーバー側。最新を取り直さずローカルで概算反映
      const r1 = field === "reserve_fee_1_amount" ? next : reserve1Amount;
      const r2 = field === "reserve_fee_2_amount" ? next : reserve2Amount;
      const lineCost = items
        .filter((i) => !i.is_text_row)
        .reduce((s, i) => s + (i.cost_amount ?? 0), 0);
      const sell = items
        .filter((i) => !i.is_text_row)
        .reduce((s, i) => s + (i.selling_amount ?? 0), 0);
      const cost_total = lineCost + r1 + r2;
      const tax = Math.floor(sell * 0.1);
      onEstimateChange({
        ...estimate,
        [field]: next,
        cost_total,
        subtotal: sell,
        tax,
        total: sell + tax,
        gross_profit: sell - cost_total,
        gross_profit_rate: sell > 0 ? ((sell - cost_total) / sell) * 100 : 0,
      });
    } catch (e) {
      onEstimateChange(prev);
      toast.error(e instanceof Error ? e.message : "予備費の更新に失敗しました");
    } finally {
      setSavingReserve(false);
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

  const applyBulkMargin = async (mode: "cost" | "sell", rateStr: string) => {
    const rate = parseFloat(rateStr);
    if (Number.isNaN(rate) || rate < 0 || rate >= 100) {
      toast.error("粗利率は 0〜99.9% の範囲で入力してください");
      return;
    }
    setBulkApplying(true);
    try {
      const { items: newItems, totals } = await bulkApplyMarginToEstimate(estimate.id, mode, rate);
      onEstimateChange({ ...estimate, items: newItems as EstimateItem[], ...(totals ?? {}) });
      toast.success(mode === "cost" ? "原価を一括設定しました" : "見積金額を一括設定しました");
      if (mode === "cost") setBulkCostOpen(false);
      else setBulkSellOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "一括設定に失敗しました");
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

  const sumCost = (list: EstimateItem[]) => list.reduce((s, i) => s + (i.cost_amount ?? 0), 0);
  const sumSell = (list: EstimateItem[]) => list.reduce((s, i) => s + (i.selling_amount ?? 0), 0);
  const calcRate = (cost: number, sell: number) => sell > 0 ? ((sell - cost) / sell) * 100 : 0;
  // 明細からライブ算出（保存前の調整でもボタンが切り替わる）
  const grossRate = calcGrossProfitRatePercent(items) || (estimate.gross_profit_rate ?? 0);
  // 承認の基準は会社設定（会社指定粗利率＋予備費率）をサーバーから取得
  const marginThreshold = marginInfo?.threshold ?? toMarginThresholdPercent(estimate.default_gross_profit_rate);
  const reservePercent = marginInfo?.reservePercent ?? 0;
  const baseThreshold = marginInfo?.baseThreshold ?? marginThreshold;
  const isLowMargin = grossRate < marginThreshold;
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
                  setPdfData(toEstimatePdfPreviewData(estimate, pdfCustomer));
                  setPdfOpen(true);
                }}
              >
                見積書（顧客向け）
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setPdfData(toCostBreakdownPdfPreviewData(estimate, pdfCustomer));
                  setPdfOpen(true);
                }}
              >
                原価内訳書（社内・予備費含む）
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <EstimateApprovalActions
            estimateId={estimate.id}
            grossProfitRate={grossRate}
            defaultGrossProfitRate={estimate.default_gross_profit_rate}
            estimateStatus={estimate.status}
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
            <p className="text-base font-bold tabular-nums leading-tight mt-px">¥{(estimate.total ?? 0).toLocaleString()}</p>
          </div>
          <div className="px-3 py-2">
            <p className="text-[10px] leading-tight text-muted-foreground">原価</p>
            <p className="text-base font-bold tabular-nums leading-tight mt-px">¥{costTotal.toLocaleString()}</p>
          </div>
          <div className="px-3 py-2">
            <p className="text-[10px] leading-tight text-muted-foreground">粗利</p>
            <p className="text-base font-bold tabular-nums leading-tight mt-px">
              ¥{(estimate.gross_profit ?? 0).toLocaleString()}
            </p>
          </div>
          <div className={cn("px-3 py-2", isLowMargin && "bg-amber-50/60")}>
            <p className={cn("text-[10px] leading-tight", isLowMargin ? "text-amber-700" : "text-muted-foreground")}>
              粗利率<span className="ml-1">(基準 {marginThreshold.toFixed(0)}%{canSeeReserve && reservePercent > 0 ? `＝指定${baseThreshold.toFixed(0)}%+予備費${reservePercent.toFixed(0)}%` : ""})</span>
            </p>
            <p className={cn("text-base font-bold tabular-nums leading-tight mt-px", isLowMargin ? "text-amber-600" : "text-emerald-700")}>
              {grossRate.toFixed(1)}%
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
        <table className="w-full text-xs border-collapse min-w-[1100px] table-fixed">
          <colgroup>
            <col className="w-8" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" />
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
              <th colSpan={6} className="bg-muted/40" />
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
              <th className="w-8 px-2 py-2 text-center"></th>
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
          {itemsByCategory.map(({ category, items: catItems }) => {
            const catCost = sumCost(catItems);
            const catSell = sumSell(catItems);
            const catRate = calcRate(catCost, catSell);
            const collapsed = collapsedIds.has(category.id);
            const isAddingHere = inlineAdd === category.id;
            return (
              <tbody key={category.id} className="group/cat">
                <tr className="bg-slate-200/80 border-t border-border/40 hover:bg-slate-300/70">
                  <td className="px-2 py-2 text-center">
                    <input type="checkbox" className="rounded border-slate-300" />
                  </td>
                  <td className="px-3 py-2 font-semibold text-slate-700" colSpan={5}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <button
                        type="button"
                        className="text-slate-400 w-4 shrink-0 text-center hover:text-slate-700"
                        aria-expanded={!collapsed}
                        aria-label={collapsed ? "展開" : "折りたたむ"}
                        onClick={() => toggleCategory(category.id)}
                      >
                        {collapsed ? "▸" : "▾"}
                      </button>
                      <CategoryNameInput
                        category={category}
                        onRenamed={(next) => {
                          onEstimateChange({
                            ...estimate,
                            categories: categories.map((c) => (c.id === next.id ? { ...c, name: next.name } : c)),
                          });
                        }}
                      />
                      <span className="text-[10px] text-muted-foreground font-normal shrink-0">{catItems.length}項目</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right text-muted-foreground bg-amber-50/40 whitespace-nowrap text-xs">小計</td>
                  <td className="px-2 py-2 text-right tabular-nums font-semibold bg-amber-50/40 whitespace-nowrap text-xs">¥{catCost.toLocaleString()}</td>
                  <td className="px-2 py-2 text-right text-muted-foreground bg-blue-50/40 whitespace-nowrap text-xs">小計</td>
                  <td className="px-2 py-2 text-right tabular-nums font-semibold bg-blue-50/40 whitespace-nowrap text-xs">¥{catSell.toLocaleString()}</td>
                  <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap text-xs">{catRate.toFixed(1)}%</td>
                  <td className="px-3 py-2"></td>
                </tr>
                {!collapsed && catItems.map((item) => (
                  <EstimateItemRow key={item.id} item={item} onUpdate={handleItemUpdate} />
                ))}
                {!collapsed && isAddingHere && (
                  <tr className="border-t border-primary/20 bg-primary/5">
                    <td className="px-2 py-1.5 text-center text-muted-foreground">＋</td>
                    <td className="px-2 py-1.5" colSpan={11}>
                      <div className="flex items-center gap-2">
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
                  <tr>
                    <td colSpan={12} className="p-0">
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
              </tbody>
            );
          })}

          {/* 未分類項目 */}
          {uncategorized.length > 0 && (
            <tbody>
              {uncategorized.map((item) => (
                <EstimateItemRow key={item.id} item={item} onUpdate={handleItemUpdate} />
              ))}
            </tbody>
          )}

          {seedingEmpty && (
            <tbody>
              <tr>
                <td colSpan={12} className="py-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />
                  入力欄を準備しています…
                </td>
              </tr>
            </tbody>
          )}

          {/* 大項目追加 */}
          <tfoot className="group/cat-add">
            {inlineAdd === "category" ? (
              <tr className="border-t border-primary/20 bg-primary/5">
                <td className="px-2 py-1.5 text-center text-muted-foreground">＋</td>
                <td className="px-2 py-1.5" colSpan={11}>
                  <div className="flex items-center gap-2">
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
                <td colSpan={12} className="p-0">
                  <div className="px-3 py-2.5 border-t border-dashed border-border/40">
                    <button
                      type="button"
                      onClick={startAddCategory}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:bg-primary/5 rounded px-2 py-1"
                    >
                      <Plus className="h-3.5 w-3.5" />大項目を追加
                    </button>
                  </div>
                </td>
              </tr>
            ) : null}
            {/* 予備費・予備予備費は明細表の外（サマリー付近）で記入。顧客向けPDF非出力 */}
            {(reserve1Amount <= 0 || reserve2Amount <= 0) && (
              <tr className="bg-rose-50 border-t border-rose-200">
                <td colSpan={12} className="px-3 py-2 text-[11px] text-rose-800 font-medium">
                  予備費・予備予備費を両方計上してください。未計上のままでは確定・提出できません。
                </td>
              </tr>
            )}
            <tr className="bg-amber-50/40 border-t border-amber-200/60">
              <td colSpan={6} className="px-3 py-2.5 text-right text-xs text-amber-900">
                <span className="font-medium">予備費（会社確保分）</span>
                <span className="block text-[10px] text-muted-foreground font-normal">担当者は使用不可・売価ゼロ</span>
              </td>
              <td colSpan={2} className="px-3 py-2.5">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  disabled={savingReserve}
                  className="h-8 text-xs tabular-nums text-right"
                  value={reserve1Amount || ""}
                  placeholder="0"
                  onChange={(e) => {
                    const v = Number(e.target.value) || 0;
                    onEstimateChange({ ...estimate, reserve_fee_1_amount: v });
                  }}
                  onBlur={(e) => void handleReserveAmountChange("reserve_fee_1_amount", Number(e.target.value) || 0)}
                />
              </td>
              <td colSpan={4} className="px-3 py-2.5 text-[10px] text-muted-foreground">原価のみ計上（顧客向けPDF非出力）</td>
            </tr>
            <tr className="bg-amber-50/25 border-t border-amber-100/80">
              <td colSpan={6} className="px-3 py-2.5 text-right text-xs text-amber-900">
                <span className="font-medium">予備予備費（現場対応分）</span>
                <span className="block text-[10px] text-muted-foreground font-normal">実行予算移行後に明細側で操作可</span>
              </td>
              <td colSpan={2} className="px-3 py-2.5">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  disabled={savingReserve}
                  className="h-8 text-xs tabular-nums text-right"
                  value={reserve2Amount || ""}
                  placeholder="0"
                  onChange={(e) => {
                    const v = Number(e.target.value) || 0;
                    onEstimateChange({ ...estimate, reserve_fee_2_amount: v });
                  }}
                  onBlur={(e) => void handleReserveAmountChange("reserve_fee_2_amount", Number(e.target.value) || 0)}
                />
              </td>
              <td colSpan={4} className="px-3 py-2.5 text-[10px] text-muted-foreground">原価のみ計上（顧客向けPDF非出力）</td>
            </tr>
            <tr className="bg-slate-100/70 border-t border-border/40 font-bold">
              <td colSpan={6} className="px-3 py-3 text-right text-sm">合計</td>
              <td colSpan={2} className="px-3 py-3 text-right tabular-nums text-base">¥{costTotal.toLocaleString()}</td>
              <td colSpan={2} className="px-3 py-3 text-right tabular-nums text-base">¥{(estimate.total ?? 0).toLocaleString()}</td>
              <td colSpan={2} className="px-3 py-3 text-right tabular-nums text-sm">{(estimate.gross_profit_rate ?? 0).toFixed(1)}%</td>
            </tr>
          </tfoot>
        </table>
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
