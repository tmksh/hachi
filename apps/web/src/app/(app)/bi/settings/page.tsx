"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { Separator } from "@/components/ui/separator";
import {
  getBiSettings,
  saveBiSettings,
  DEFAULT_OVERHEAD_ITEMS,
  type BiOverheadItem,
} from "@/lib/actions/bi";
import { getCurrentFiscalYear, fiscalYearLabel, DEFAULT_DEPARTMENTS } from "@/lib/bi-utils";
import { toast } from "sonner";
import { Trash2, Plus, Settings2, ArrowLeft, Info } from "lucide-react";

// ── 数値入力ヘルパー ──────────────────────────────────────────────────
function parseAmount(v: string): number {
  return Math.max(0, Number(v.replace(/,/g, "")) || 0);
}
function formatAmount(v: number): string {
  return v === 0 ? "" : v.toLocaleString();
}

// ── 金額インプット ────────────────────────────────────────────────────
function AmountInput({
  value,
  onChange,
  placeholder = "0",
  className = "",
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  className?: string;
}) {
  const [raw, setRaw] = useState(formatAmount(value));

  useEffect(() => {
    setRaw(formatAmount(value));
  }, [value]);

  return (
    <div className={`relative ${className}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">¥</span>
      <Input
        className="pl-7 text-right tabular-nums"
        value={raw}
        placeholder={placeholder}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={() => {
          const v = parseAmount(raw);
          onChange(v);
          setRaw(formatAmount(v));
        }}
      />
    </div>
  );
}

// ── メインコンポーネント ──────────────────────────────────────────────
export default function BiSettingsPage() {
  const router = useRouter();
  const fiscalYear = getCurrentFiscalYear();

  // ── 全社設定 ──
  const [targetRevenue, setTargetRevenue] = useState(0);
  const [targetGrossProfit, setTargetGrossProfit] = useState(0);
  const [sgaBudget, setSgaBudget] = useState(0);

  // ── 予算配賦 ──
  const [overheadMode, setOverheadMode] = useState<"breakdown" | "lump_sum">("lump_sum");
  const [overheadLump, setOverheadLump] = useState(0);
  const [overheadItems, setOverheadItems] = useState<
    Array<{ id: string; name: string; amount: number; sort_order: number; is_custom: boolean }>
  >([]);

  // ── 部門別目標 ──
  const [deptTargets, setDeptTargets] = useState<
    Array<{ id: string; department_name: string; target_revenue: number; target_gross_profit: number; sort_order: number }>
  >(
    DEFAULT_DEPARTMENTS.map((name, i) => ({
      id: `default-${i}`,
      department_name: name,
      target_revenue: 0,
      target_gross_profit: 0,
      sort_order: i,
    }))
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── DB から初期値読み込み ──
  useEffect(() => {
    getBiSettings(fiscalYear).then((settings) => {
      if (settings) {
        setTargetRevenue(settings.target_revenue);
        setTargetGrossProfit(settings.target_gross_profit);
        setSgaBudget(settings.sga_budget);
        setOverheadMode(settings.overhead_mode);
        setOverheadLump(settings.overhead_budget);

        if (settings.overhead_items.length > 0) {
          setOverheadItems(settings.overhead_items);
        } else {
          setOverheadItems(
            DEFAULT_OVERHEAD_ITEMS.map((item, i) => ({ ...item, id: `new-${i}` }))
          );
        }

        if (settings.department_targets.length > 0) {
          setDeptTargets(settings.department_targets);
        }
      } else {
        setOverheadItems(
          DEFAULT_OVERHEAD_ITEMS.map((item, i) => ({ ...item, id: `new-${i}` }))
        );
      }
      setLoading(false);
    }).catch(() => {
      setOverheadItems(DEFAULT_OVERHEAD_ITEMS.map((item, i) => ({ ...item, id: `new-${i}` })));
      setLoading(false);
    });
  }, [fiscalYear]);

  // ── 内訳合計 ──
  const overheadTotal = overheadItems.reduce((s, i) => s + i.amount, 0);
  const effectiveOverhead = overheadMode === "breakdown" ? overheadTotal : overheadLump;

  // ── 保存 ──
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const result = await saveBiSettings({
        fiscal_year: fiscalYear,
        target_revenue: targetRevenue,
        target_gross_profit: targetGrossProfit,
        overhead_budget: effectiveOverhead,
        sga_budget: sgaBudget,
        overhead_mode: overheadMode,
        overhead_items: overheadItems.map((item, i) => ({
          name: item.name,
          amount: item.amount,
          sort_order: i,
          is_custom: item.is_custom,
        })),
        department_targets: deptTargets.map((d, i) => ({
          department_name: d.department_name,
          target_revenue: d.target_revenue,
          target_gross_profit: d.target_gross_profit,
          sort_order: i,
        })),
      });

      if (result.ok) {
        toast.success("設定を保存しました");
        router.push("/bi");
      } else {
        toast.error(result.error ?? "保存に失敗しました");
      }
    } finally {
      setSaving(false);
    }
  }, [fiscalYear, targetRevenue, targetGrossProfit, effectiveOverhead, sgaBudget, overheadMode, overheadItems, deptTargets, router]);

  // ── 内訳行の操作 ──
  const updateItem = (id: string, field: "name" | "amount", value: string | number) => {
    setOverheadItems((prev) =>
      prev.map((item) => item.id === id ? { ...item, [field]: value } : item)
    );
  };

  const removeItem = (id: string) => {
    setOverheadItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addCustomItem = () => {
    const newId = `custom-${Date.now()}`;
    setOverheadItems((prev) => [
      ...prev,
      { id: newId, name: "", amount: 0, sort_order: prev.length, is_custom: true },
    ]);
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-5">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      {/* ── ヘッダー ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 text-muted-foreground"
            onClick={() => router.push("/bi")}
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            BIダッシュボードへ
          </Button>
          <PageHeader
            title="BI 期首設定"
            description={`${fiscalYearLabel(fiscalYear)} の予算・目標値を設定します`}
          />
        </div>
        <Button onClick={handleSave} disabled={saving} className="shrink-0">
          {saving ? "保存中…" : "保存"}
        </Button>
      </div>

      {/* ── 全社目標 ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            全社目標
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">全社売上目標（年額）</Label>
            <AmountInput value={targetRevenue} onChange={setTargetRevenue} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">全社粗利目標（年額）</Label>
            <AmountInput value={targetGrossProfit} onChange={setTargetGrossProfit} />
          </div>
        </CardContent>
      </Card>

      {/* ── 予算配賦（製造間接費） ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-sm font-semibold">
              予算配賦（製造間接費）
            </CardTitle>
            <Tabs
              value={overheadMode}
              onValueChange={(v) => setOverheadMode(v as "breakdown" | "lump_sum")}
            >
              <TabsList className="h-8">
                <TabsTrigger value="breakdown" className="text-xs px-3 h-7">内訳入力</TabsTrigger>
                <TabsTrigger value="lump_sum"  className="text-xs px-3 h-7">一括入力</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {overheadMode === "lump_sum" ? (
            /* ── モードB: 一括入力 ── */
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">予算配賦額（年額）</Label>
              <AmountInput value={overheadLump} onChange={setOverheadLump} className="max-w-xs" />
            </div>
          ) : (
            /* ── モードA: 内訳入力 ── */
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_160px_32px] gap-2 px-1 pb-1">
                <span className="text-xs text-muted-foreground font-medium">項目</span>
                <span className="text-xs text-muted-foreground font-medium text-right">金額（年額）</span>
                <span />
              </div>
              {overheadItems.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_160px_32px] gap-2 items-center">
                  {item.is_custom ? (
                    <Input
                      value={item.name}
                      placeholder="項目名"
                      className="h-8 text-sm"
                      onChange={(e) => updateItem(item.id, "name", e.target.value)}
                    />
                  ) : (
                    <span className="text-sm px-1">{item.name}</span>
                  )}
                  <AmountInput
                    value={item.amount}
                    onChange={(v) => updateItem(item.id, "amount", v)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground/50 hover:text-red-500"
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                className="mt-1 text-xs gap-1.5"
                onClick={addCustomItem}
              >
                <Plus className="h-3.5 w-3.5" />
                項目を追加
              </Button>

              <Separator className="my-2" />
              <div className="flex justify-between items-center px-1">
                <span className="text-sm font-semibold">合計</span>
                <span className="text-base font-bold tabular-nums">
                  ¥{overheadTotal.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-blue-50 border border-blue-100 rounded-lg p-2.5 mt-2">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-400" />
            <span>
              期中は固定値として使用されます。月別表示では年額 ÷ 12 の均等按分を適用します。
              {overheadMode === "breakdown" && " 内訳入力・一括入力を切り替えても合計値は保持されます。"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── 販管費予算 ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">販管費予算</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">販管費予算（年額）</Label>
            <AmountInput value={sgaBudget} onChange={setSgaBudget} className="max-w-xs" />
          </div>
        </CardContent>
      </Card>

      {/* ── 部門別目標 ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">部門別目標</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 pb-1 px-1">
            <span className="text-xs text-muted-foreground font-medium">部門</span>
            <span className="text-xs text-muted-foreground font-medium">売上目標（年額）</span>
            <span className="text-xs text-muted-foreground font-medium">粗利目標（年額）</span>
          </div>
          {deptTargets.map((dept) => (
            <div key={dept.id} className="grid grid-cols-[1fr_1fr_1fr] gap-2 items-center">
              <span className="text-sm font-medium px-1">{dept.department_name}</span>
              <AmountInput
                value={dept.target_revenue}
                onChange={(v) =>
                  setDeptTargets((prev) =>
                    prev.map((d) => d.id === dept.id ? { ...d, target_revenue: v } : d)
                  )
                }
              />
              <AmountInput
                value={dept.target_gross_profit}
                onChange={(v) =>
                  setDeptTargets((prev) =>
                    prev.map((d) => d.id === dept.id ? { ...d, target_gross_profit: v } : d)
                  )
                }
              />
            </div>
          ))}

          <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/40 border border-border/50 rounded-lg p-2.5 mt-1">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            部門達成率 = 部門売上実績 ÷ 部門売上目標で算出されます。
          </div>
        </CardContent>
      </Card>

      {/* ── 保存ボタン（下部） ── */}
      <div className="flex justify-end gap-3 pt-2 pb-8">
        <Button variant="outline" onClick={() => router.push("/bi")}>キャンセル</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "保存中…" : "設定を保存"}
        </Button>
      </div>
    </div>
  );
}
