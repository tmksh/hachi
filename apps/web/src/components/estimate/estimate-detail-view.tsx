"use client";

import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import type { EstimateCategory, EstimateItem } from "@/lib/database.types";
import {
  addEstimateCategory,
  addEstimateItem,
  updateEstimateItem,
  type EstimateItemUpdatePatch,
} from "@/lib/actions/constructions";

const ESTIMATE_STATUS_MAP: Record<string, string> = {
  draft: "下書き", issued: "発行済", sent: "送付済", accepted: "受注", rejected: "失注",
};

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
}: {
  estimate: EstimateForView;
  onBack?: () => void;
  loading?: boolean;
  onEstimateChange: (est: EstimateForView) => void;
  headerExtra?: React.ReactNode;
}) {
  const reserve1Rate = estimate.reserve_fee_1_rate ?? 0.02;
  const reserve2Rate = estimate.reserve_fee_2_rate ?? 0.03;
  const subtotal = estimate.subtotal ?? 0;
  const reserve1 = Math.round(subtotal * reserve1Rate);
  const reserve2 = Math.round(subtotal * reserve2Rate);
  const costTotal = estimate.cost_total ?? 0;

  const categories: EstimateCategory[] = estimate.categories ?? [];
  const items: EstimateItem[] = estimate.items ?? [];
  const itemsByCategory = categories.map((cat) => ({
    category: cat,
    items: items.filter((item) => item.category_id === cat.id),
  }));
  const uncategorized = items.filter((item) => !item.category_id);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [inlineAdd, setInlineAdd] = useState<"category" | string | null>(null);
  const [inlineName, setInlineName] = useState("");
  const [savingLine, setSavingLine] = useState(false);
  const [seedingEmpty, setSeedingEmpty] = useState(false);
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const seededEstimateIdRef = useRef<string | null>(null);

  useEffect(() => {
    setCollapsedIds(new Set());
    setInlineAdd(null);
    seededEstimateIdRef.current = null;
  }, [estimate.id]);

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

  const startAddCategory = () => {
    setInlineName("");
    setInlineAdd("category");
  };

  const startAddItem = (categoryId: string) => {
    setCollapsedIds((prev) => { const next = new Set(prev); next.delete(categoryId); return next; });
    setInlineName("");
    setInlineAdd(categoryId);
  };

  const cancelInline = () => { setInlineAdd(null); setInlineName(""); };

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
      setSavingLine(true);
      try {
        const cat = await addEstimateCategory(estimate.id, name);
        onEstimateChange({
          ...estimate,
          categories: [...prevCategories, cat],
        });
        inlineInputRef.current?.focus();
      } catch (e) {
        onEstimateChange({ ...estimate, categories: prevCategories });
        toast.error(e instanceof Error ? e.message : "追加に失敗しました");
      } finally {
        setSavingLine(false);
      }
      return;
    }

    const categoryId = mode;
    const tempId = `temp-item-${Date.now()}`;
    const optimistic: EstimateItem = {
      id: tempId,
      company_id: companyId,
      estimate_id: estimate.id,
      category_id: categoryId,
      name,
      description: null,
      specification: null,
      quantity: 1,
      unit: "式",
      cost_price: 0,
      cost_amount: 0,
      selling_price: 0,
      selling_amount: 0,
      gross_profit: 0,
      gross_profit_rate: 0,
      sort_order: prevItems.filter((i) => i.category_id === categoryId).length,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    onEstimateChange({ ...estimate, items: [...prevItems, optimistic] });
    setInlineName("");
    setSavingLine(true);
    try {
      const item = await addEstimateItem(estimate.id, categoryId, name);
      onEstimateChange({
        ...estimate,
        items: [...prevItems, item],
      });
      inlineInputRef.current?.focus();
    } catch (e) {
      onEstimateChange({ ...estimate, items: prevItems });
      toast.error(e instanceof Error ? e.message : "追加に失敗しました");
    } finally {
      setSavingLine(false);
    }
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); void commitInline(); }
    if (e.key === "Escape") cancelInline();
  };

  const handleItemUpdate = (updatedItem: EstimateItem, totals?: EstimateTotalsPatch) => {
    onEstimateChange({
      ...estimate,
      items: items.map((i) => (i.id === updatedItem.id ? updatedItem : i)),
      ...(totals ?? {}),
    });
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
  const grossRate = estimate.gross_profit_rate ?? 0;
  const isLowMargin = grossRate < 50;

  return (
    <div className={cn("space-y-3", loading && "opacity-60")}>
      {/* ヘッダー */}
      <div className="flex items-center gap-2 flex-wrap">
        {onBack && (
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground shrink-0">
            <ArrowLeft className="h-3.5 w-3.5" />見積一覧
          </button>
        )}
        {estimate.title && (
          <span className="text-base font-semibold">{estimate.title}</span>
        )}
        {estimate.estimate_no && (
          <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {estimate.estimate_no}
          </span>
        )}
        {estimate.status && (
          <Badge variant="outline" className="text-xs">{ESTIMATE_STATUS_MAP[estimate.status] ?? estimate.status}</Badge>
        )}
        {headerExtra && <div className="ml-auto flex items-center gap-2">{headerExtra}</div>}
      </div>

      {/* サマリー（KPI + 警告を1カードに統合） */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border/60">
          <div className="px-3 py-2">
            <p className="text-[10px] leading-tight text-muted-foreground">売上(税込)</p>
            <p className="text-base font-bold tabular-nums leading-tight mt-px">¥{(estimate.total ?? 0).toLocaleString()}</p>
          </div>
          <div className="px-3 py-2">
            <p className="text-[10px] leading-tight text-muted-foreground">
              原価<span className="text-amber-600 ml-1">(予備費込)</span>
            </p>
            <p className="text-base font-bold tabular-nums leading-tight mt-px">¥{(costTotal + reserve1 + reserve2).toLocaleString()}</p>
            <p className="text-[9px] leading-tight text-muted-foreground mt-px">
              予備費① {(reserve1Rate * 100).toFixed(0)}% ¥{reserve1.toLocaleString()} ／ ② {(reserve2Rate * 100).toFixed(0)}% ¥{reserve2.toLocaleString()}
            </p>
          </div>
          <div className="px-3 py-2">
            <p className="text-[10px] leading-tight text-muted-foreground">粗利</p>
            <p className="text-base font-bold tabular-nums leading-tight mt-px">
              ¥{(estimate.gross_profit ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="px-3 py-2">
            <p className="text-[10px] leading-tight text-muted-foreground">粗利率<span className="ml-1">(基準 50%)</span></p>
            <p className="text-base font-bold tabular-nums leading-tight mt-px">
              {grossRate.toFixed(1)}%
            </p>
          </div>
        </div>
        {isLowMargin && (
          <div className="border-t border-border/60 bg-muted/30 px-3 py-1.5 text-[11px] leading-tight text-muted-foreground">
            ⚠ 粗利率が基準(50%)を下回っています。上司への承認申請が必要です。
          </div>
        )}
      </div>

      {/* 明細テーブル */}
      <div className="rounded-xl border border-border overflow-x-auto">
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
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-full text-[11px] gap-1 text-amber-800 border-amber-200/80 bg-amber-50/60 hover:bg-amber-50"
                  disabled
                >
                  <ArrowLeft className="h-3 w-3 shrink-0" />原価を一覧作成
                </Button>
              </th>
              <th colSpan={2} className="px-2 py-1.5 bg-blue-50/50 border-b border-border/40">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-full text-[11px] gap-1 text-blue-800 border-blue-200/80 bg-blue-50/60 hover:bg-blue-50"
                  disabled
                >
                  見積金額を一覧作成<Plus className="h-3 w-3 shrink-0" />
                </Button>
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
                <tr
                  className="bg-slate-200/80 border-t border-border/40 cursor-pointer hover:bg-slate-300/70"
                  onClick={() => toggleCategory(category.id)}
                >
                  <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="rounded border-slate-300" />
                  </td>
                  <td className="px-3 py-2 font-semibold text-slate-700" colSpan={5}>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-left hover:text-slate-900"
                      aria-expanded={!collapsed}
                      onClick={(e) => { e.stopPropagation(); toggleCategory(category.id); }}
                    >
                      <span className="text-slate-400 w-3 text-center">{collapsed ? "▸" : "▾"}</span>
                      {category.name.trim() || (
                        <span className="text-muted-foreground font-normal">大項目名</span>
                      )}
                    </button>
                    <span className="text-[10px] text-muted-foreground ml-2 font-normal">{catItems.length}項目</span>
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
                          placeholder="詳細項目名を入力..."
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
                )}
                {!collapsed && !isAddingHere && inlineAdd === null && (
                  <tr className="cursor-pointer" onClick={() => startAddItem(category.id)}>
                    <td colSpan={12} className="p-0">
                      <div className="max-h-0 group-hover/cat:max-h-8 overflow-hidden transition-all duration-150 hover:bg-primary/5">
                        <div className="px-3 py-1.5 text-xs text-primary border-t border-dashed border-border/40">
                          <span className="inline-flex items-center gap-1"><Plus className="h-3 w-3" />詳細項目を追加</span>
                        </div>
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
              <tr className="cursor-pointer" onClick={startAddCategory}>
                <td colSpan={12} className="p-0">
                  <div className="max-h-0 group-hover/cat-add:max-h-10 overflow-hidden transition-all duration-150">
                    <div className="px-3 py-2 text-xs text-primary border-t border-dashed border-border/40 hover:bg-primary/5">
                      <span className="inline-flex items-center gap-1"><Plus className="h-3.5 w-3.5" />大項目を追加</span>
                    </div>
                  </div>
                </td>
              </tr>
            ) : null}
            <tr className="bg-amber-50/30 border-t border-border/40">
              <td colSpan={6} className="px-3 py-2 text-right text-xs text-muted-foreground">
                予備費① <span className="text-blue-600 font-medium">{(reserve1Rate * 100).toFixed(0)}%</span>
                <span className="text-[10px] ml-1">(原価の{(reserve1Rate * 100).toFixed(0)}% / 下記 {(reserve2Rate * 100).toFixed(0)}%)</span>
              </td>
              <td colSpan={2} className="px-3 py-2 text-right tabular-nums text-sm text-amber-700">¥{reserve1.toLocaleString()}</td>
              <td colSpan={2} className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">原価のみ</td>
              <td colSpan={2}></td>
            </tr>
            <tr className="bg-slate-100/70 border-t border-border/40 font-bold">
              <td colSpan={6} className="px-3 py-3 text-right text-sm">合計(予備費込)</td>
              <td colSpan={2} className="px-3 py-3 text-right tabular-nums text-base">¥{(costTotal + reserve1 + reserve2).toLocaleString()}</td>
              <td colSpan={2} className="px-3 py-3 text-right tabular-nums text-base">¥{(estimate.total ?? 0).toLocaleString()}</td>
              <td colSpan={2} className="px-3 py-3 text-right tabular-nums text-sm">{(estimate.gross_profit_rate ?? 0).toFixed(1)}%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
