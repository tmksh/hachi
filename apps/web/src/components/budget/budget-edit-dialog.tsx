"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { budgetPlanTotals } from "@/lib/budget-totals";
import { createBudget, updateBudget } from "@/lib/actions/budgets";
import type { Budget, BudgetItem } from "@/lib/database.types";

type Item = { category: BudgetItem["category"]; name: string; amount: number };
type ExistingBudget = Budget & { items?: BudgetItem[] };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: ExistingBudget | null;
  onSaved: () => void;
}

const CATEGORY_LABELS: Record<NonNullable<BudgetItem["category"]>, string> = {
  revenue: "収入",
  direct_cost: "直接費",
  indirect_cost: "間接費",
};

export function BudgetEditDialog({ open, onOpenChange, existing, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [branch, setBranch] = useState("");
  const [targetRevenue, setTargetRevenue] = useState("");
  const [items, setItems] = useState<Item[]>([
    { category: "revenue", name: "工事売上", amount: 0 },
    { category: "direct_cost", name: "材料費", amount: 0 },
    { category: "direct_cost", name: "外注費", amount: 0 },
    { category: "indirect_cost", name: "人件費", amount: 0 },
  ]);

  useEffect(() => {
    if (open) {
      if (existing) {
        setFiscalYear(existing.fiscal_year);
        setBranch(existing.branch ?? "");
        setTargetRevenue(String(existing.target_revenue ?? 0));
        setItems(
          (existing.items ?? []).map(it => ({
            category: it.category,
            name: it.name,
            amount: Number(it.amount),
          }))
        );
      } else {
        setFiscalYear(new Date().getFullYear());
        setBranch("");
        setTargetRevenue("");
        setItems([
          { category: "revenue", name: "工事売上", amount: 0 },
          { category: "direct_cost", name: "材料費", amount: 0 },
          { category: "direct_cost", name: "外注費", amount: 0 },
          { category: "indirect_cost", name: "人件費", amount: 0 },
        ]);
      }
    }
  }, [open, existing]);

  const updateItem = (i: number, patch: Partial<Item>) =>
    setItems(prev => prev.map((it, j) => j === i ? { ...it, ...patch } : it));
  const addItem = () => setItems(prev => [...prev, { category: "direct_cost", name: "", amount: 0 }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, j) => j !== i));

  const { revenue: totalRevenue, cost: totalCost, grossProfit: gross } = budgetPlanTotals(items);

  const handleSave = async () => {
    if (!fiscalYear) { toast.error("年度を入力してください"); return; }
    setSaving(true);
    try {
      const validItems = items.filter(i => i.name.trim() && i.category);
      const payload = {
        fiscal_year: fiscalYear,
        branch: branch || undefined,
        target_revenue: targetRevenue ? Number(targetRevenue) : totalRevenue,
      };
      if (existing) {
        await updateBudget(existing.id, payload, validItems);
        toast.success("予算を更新しました");
      } else {
        await createBudget(payload, validItems);
        toast.success("予算を作成しました");
      }
      onSaved();
      onOpenChange(false);
    } catch { toast.error("保存に失敗しました"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{existing ? "予算を編集" : "新規予算策定"}</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 min-h-0 space-y-4 pr-1 py-1">
          {/* 基本情報 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>年度 *</Label>
              <Input type="number" value={fiscalYear} onChange={e => setFiscalYear(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>支店・部門</Label>
              <Input value={branch} onChange={e => setBranch(e.target.value)} placeholder="例: 本社、東京支店" />
            </div>
            <div className="space-y-1.5">
              <Label>目標売上</Label>
              <Input type="number" value={targetRevenue} onChange={e => setTargetRevenue(e.target.value)} placeholder="0" />
            </div>
          </div>

          {/* 明細 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>予算明細</Label>
              <Button size="sm" variant="outline" onClick={addItem} className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" />行追加
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-[120px_1fr_140px_36px] gap-2">
                  <Select value={it.category ?? "revenue"} onValueChange={v => updateItem(i, { category: v as BudgetItem["category"] })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CATEGORY_LABELS) as Array<NonNullable<BudgetItem["category"]>>).map(k => (
                        <SelectItem key={k} value={k}>{CATEGORY_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input value={it.name} onChange={e => updateItem(i, { name: e.target.value })} placeholder="項目名" className="h-9" />
                  <Input type="number" value={it.amount} onChange={e => updateItem(i, { amount: Number(e.target.value) })} className="h-9 text-right" />
                  <Button size="icon" variant="ghost" className="size-9" onClick={() => removeItem(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* サマリー */}
          <div className="grid grid-cols-3 gap-2 p-3 bg-muted/40 rounded-lg text-sm">
            <div>
              <p className="text-xs text-muted-foreground">計画売上</p>
              <p className="font-semibold tabular-nums">¥{totalRevenue.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">計画原価</p>
              <p className="font-semibold tabular-nums">¥{totalCost.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">計画粗利</p>
              <p className={`font-semibold tabular-nums ${gross >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                ¥{gross.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>キャンセル</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : existing ? "更新" : "作成"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
