"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IntegerInput } from "@/components/ui/integer-input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { Separator } from "@/components/ui/separator";
import {
  getBiSettings,
  saveBiSettings,
  getBiCompanyConfig,
  saveBiCompanyConfig,
  getBiBudgetChangeLog,
  releaseReserve,
} from "@/lib/actions/bi";
import {
  DEFAULT_OVERHEAD_ITEMS,
  MOCK_OVERHEAD_BUDGET_MAN,
  type BiOverheadItem,
  type BiBudgetChangeLog,
} from "@/lib/bi-types";
import {
  CONSTRUCTION_STATUSES,
  CONTRACT_STATUSES,
  DEAL_STAGES,
  INVOICE_STATUSES,
  DEFAULT_BI_COMPANY_CONFIG,
  type BiCompanyConfig,
  type BiForecastTierConfig,
  type BiDataSourceFilter,
  type BiSourceType,
} from "@/lib/bi-config";
import { getCurrentFiscalYear, fiscalYearLabel, DEFAULT_DEPARTMENTS, normalizeBudgetMan } from "@/lib/bi-utils";
import { toast } from "sonner";
import { Trash2, Plus, Settings2, ArrowLeft, Info, SlidersHorizontal, ShieldCheck, Lock } from "lucide-react";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/components/providers/auth-provider";
import { useCompanyPermissions } from "@/hooks/use-company-permissions";
import { permissionRoleSlugs } from "@/lib/role-assignment";

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
  unit = "man",
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  className?: string;
  unit?: "man" | "yen";
}) {
  const [raw, setRaw] = useState(formatAmount(value));

  useEffect(() => {
    setRaw(formatAmount(value));
  }, [value]);

  return (
    <div className={`relative flex items-center gap-1 ${className}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">¥</span>
      <Input
        className="pl-7 pr-2 text-right tabular-nums"
        value={raw}
        placeholder={placeholder}
        onChange={(e) => {
          setRaw(e.target.value);
          onChange(parseAmount(e.target.value));
        }}
        onBlur={() => {
          const v = parseAmount(raw);
          onChange(v);
          setRaw(formatAmount(v));
        }}
      />
      {unit === "man" ? (
        <span className="text-xs text-muted-foreground shrink-0 pr-1">万</span>
      ) : null}
    </div>
  );
}

// ── メインコンポーネント ──────────────────────────────────────────────
export type BiSettingsPanelProps = {
  variant?: "page" | "dialog";
  active?: boolean;
  fiscalYear?: number;
  onSaved?: () => void;
  onCancel?: () => void;
};

export function BiSettingsPanel({
  variant = "page",
  active = true,
  fiscalYear: fiscalYearProp,
  onSaved,
  onCancel,
}: BiSettingsPanelProps) {
  const router = useRouter();
  const { role, profile } = useAuth();
  const { canAccess } = useCompanyPermissions();
  // 予備費の設定可否は権限マトリクス（機能キー: reserve_fee）で制御。既定は本部管理者のみ
  const canEditReserve = role ? canAccess("reserve_fee", permissionRoleSlugs(profile ?? { role })) : false;
  const fiscalYear = fiscalYearProp ?? getCurrentFiscalYear();

  // ── 全社設定 ──
  const [targetRevenue, setTargetRevenue] = useState(0);
  const [targetGrossProfit, setTargetGrossProfit] = useState(0);
  const [sgaBudget, setSgaBudget] = useState(0);
  // ── 予備費（非表示%）: 管理者のみ設定可 ──
  const [reserveRatePct, setReserveRatePct] = useState(0);
  // ── 会社指定粗利率（承認の基準ライン%）: 管理者のみ設定可 ──
  const [baseRatePct, setBaseRatePct] = useState(50);
  // ── 予備費の決算戻し状態 ──
  const [reserveReleased, setReserveReleased] = useState(false);
  const [releasingReserve, setReleasingReserve] = useState(false);

  // ── 予算配賦 ──
  const [overheadMode, setOverheadMode] = useState<"breakdown" | "lump_sum">("breakdown");
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

  // ── 拠点別目標・販管費（No.80） ──
  const [locTargets, setLocTargets] = useState<
    Array<{ id: string; location_id: string; location_name: string; target_revenue: number; sga_budget: number; sort_order: number }>
  >([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyConfig, setCompanyConfig] = useState<BiCompanyConfig>(DEFAULT_BI_COMPANY_CONFIG);
  const [loadedSnapshot, setLoadedSnapshot] = useState({
    targetRevenue: 0,
    targetGrossProfit: 0,
    overheadBudget: 0,
    sgaBudget: 0,
  });
  const [changeEffectiveFrom, setChangeEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [changeNote, setChangeNote] = useState("");
  const [changeLogs, setChangeLogs] = useState<BiBudgetChangeLog[]>([]);

  // ── DB から初期値読み込み ──
  useEffect(() => {
    if (variant === "dialog" && !active) return;
    setLoading(true);
    Promise.all([getBiSettings(fiscalYear), getBiCompanyConfig(), getBiBudgetChangeLog(fiscalYear)]).then(([settings, config, logs]) => {
      setCompanyConfig(config);
      setChangeLogs(logs);
      if (settings) {
        setTargetRevenue(normalizeBudgetMan(settings.target_revenue));
        setTargetGrossProfit(normalizeBudgetMan(settings.target_gross_profit));
        setSgaBudget(normalizeBudgetMan(settings.sga_budget));
        setReserveRatePct(Math.round((settings.reserve_fee_rate ?? 0) * 1000) / 10);
        setBaseRatePct(Math.round((settings.base_gross_profit_rate ?? 0.5) * 1000) / 10);
        setReserveReleased(settings.reserve_released ?? false);
        setOverheadMode(settings.overhead_mode);
        const overheadBudgetMan = normalizeBudgetMan(settings.overhead_budget);
        setOverheadLump(overheadBudgetMan);
        setLoadedSnapshot({
          targetRevenue: normalizeBudgetMan(settings.target_revenue),
          targetGrossProfit: normalizeBudgetMan(settings.target_gross_profit),
          overheadBudget: overheadBudgetMan,
          sgaBudget: normalizeBudgetMan(settings.sga_budget),
        });

        if (settings.overhead_items.length > 0) {
          setOverheadItems(
            settings.overhead_items.map((item) => ({
              ...item,
              amount: normalizeBudgetMan(item.amount),
            }))
          );
        } else {
          setOverheadItems(
            DEFAULT_OVERHEAD_ITEMS.map((item, i) => ({ ...item, id: `new-${i}` }))
          );
        }

        if (settings.department_targets.length > 0) {
          setDeptTargets(
            settings.department_targets.map((dept) => ({
              ...dept,
              target_revenue: normalizeBudgetMan(dept.target_revenue),
              target_gross_profit: normalizeBudgetMan(dept.target_gross_profit),
            }))
          );
        }
        setLocTargets(
          (settings.location_targets ?? []).map((loc) => ({
            ...loc,
            target_revenue: normalizeBudgetMan(loc.target_revenue),
            sga_budget: normalizeBudgetMan(loc.sga_budget),
          })),
        );
      } else {
        setOverheadLump(MOCK_OVERHEAD_BUDGET_MAN);
        setOverheadItems(
          DEFAULT_OVERHEAD_ITEMS.map((item, i) => ({ ...item, id: `new-${i}` }))
        );
      }
      setLoading(false);
    }).catch(() => {
      setOverheadItems(DEFAULT_OVERHEAD_ITEMS.map((item, i) => ({ ...item, id: `new-${i}` })));
      setLoading(false);
    });
  }, [fiscalYear, variant, active]);

  // ── 内訳合計 ──
  const overheadTotal = overheadItems.reduce((s, i) => s + i.amount, 0);
  const effectiveOverhead = overheadMode === "breakdown" ? overheadTotal : overheadLump;
  const budgetFieldsChanged =
    targetRevenue !== loadedSnapshot.targetRevenue ||
    targetGrossProfit !== loadedSnapshot.targetGrossProfit ||
    effectiveOverhead !== loadedSnapshot.overheadBudget ||
    sgaBudget !== loadedSnapshot.sgaBudget;

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
        location_targets: locTargets.map((l, i) => ({
          location_id: l.location_id,
          target_revenue: l.target_revenue,
          sga_budget: l.sga_budget,
          sort_order: i,
        })),
        reserve_fee_rate: reserveRatePct / 100,
        base_gross_profit_rate: baseRatePct / 100,
        budget_change: budgetFieldsChanged
          ? { effective_from: changeEffectiveFrom, note: changeNote || undefined }
          : undefined,
      });

      if (!result.ok) {
        toast.error(result.error ?? "保存に失敗しました");
        return;
      }

      const configResult = await saveBiCompanyConfig(companyConfig);
      if (!configResult.ok) {
        toast.error(configResult.error ?? "分析設定の保存に失敗しました");
        return;
      }

      toast.success("設定を保存しました");
      if (onSaved) {
        onSaved();
      } else {
        router.push("/bi");
      }
    } finally {
      setSaving(false);
    }
  }, [fiscalYear, targetRevenue, targetGrossProfit, effectiveOverhead, sgaBudget, overheadMode, overheadItems, deptTargets, locTargets, companyConfig, reserveRatePct, baseRatePct, budgetFieldsChanged, changeEffectiveFrom, changeNote, onSaved, router]);

  const handleToggleReserveRelease = useCallback(async (release: boolean) => {
    setReleasingReserve(true);
    try {
      const res = await releaseReserve(fiscalYear, release);
      if (!res.ok) {
        toast.error(res.error ?? "予備費の決算戻しに失敗しました");
        return;
      }
      setReserveReleased(release);
      toast.success(release ? "経営調整費を利益に戻しました（決算）" : "経営調整費の決算戻しを取り消しました");
    } finally {
      setReleasingReserve(false);
    }
  }, [fiscalYear]);

  const updateForecastTier = (id: string, patch: Partial<BiForecastTierConfig>) => {
    setCompanyConfig((prev) => ({
      ...prev,
      forecast_tiers: prev.forecast_tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  };

  const addForecastTier = () => {
    const id = `tier-${Date.now()}`;
    setCompanyConfig((prev) => ({
      ...prev,
      forecast_tiers: [
        ...prev.forecast_tiers,
        {
          id,
          label: `着地 ${prev.forecast_tiers.length + 1}`,
          enabled: true,
          cumulative: false,
          sources: [],
        },
      ],
    }));
  };

  const removeForecastTier = (id: string) => {
    setCompanyConfig((prev) => ({
      ...prev,
      forecast_tiers: prev.forecast_tiers.filter((t) => t.id !== id),
    }));
  };

  type TierSourceType = "constructions" | "deals" | "contracts";

  const toggleTierSourceStatus = (
    tierId: string,
    sourceType: TierSourceType,
    value: string,
    checked: boolean
  ) => {
    setCompanyConfig((prev) => ({
      ...prev,
      forecast_tiers: prev.forecast_tiers.map((tier) => {
        if (tier.id !== tierId) return tier;
        const sources = [...tier.sources];
        const idx = sources.findIndex((s) => s.type === sourceType);
        const field = sourceType === "deals" ? "stages" : "statuses";
        if (idx === -1) {
          sources.push({ type: sourceType, [field]: checked ? [value] : [] });
          return { ...tier, sources };
        }
        const current = new Set(sources[idx][field as "statuses" | "stages"] ?? []);
        if (checked) current.add(value);
        else current.delete(value);
        sources[idx] = { ...sources[idx], [field]: Array.from(current) };
        return { ...tier, sources };
      }),
    }));
  };

  const tierHasSourceValue = (
    tier: BiForecastTierConfig,
    sourceType: TierSourceType,
    value: string
  ) => {
    const source = tier.sources.find((s) => s.type === sourceType);
    const list = sourceType === "deals" ? source?.stages : source?.statuses;
    return list?.includes(value) ?? false;
  };

  const actualHasSourceValue = (sourceType: BiSourceType, value: string) => {
    const source = companyConfig.actual_sources.find((s) => s.type === sourceType);
    if (sourceType === "constructions" || sourceType === "contracts") return source?.statuses?.includes(value) ?? false;
    if (sourceType === "deals") return source?.stages?.includes(value) ?? false;
    if (sourceType === "invoices") return source?.statuses?.includes(value) ?? false;
    return false;
  };

  const toggleActualSource = (sourceType: BiSourceType, value: string, checked: boolean) => {
    setCompanyConfig((prev) => {
      const sources = [...prev.actual_sources];
      const idx = sources.findIndex((s) => s.type === sourceType);
      const field = sourceType === "deals" ? "stages" : "statuses";
      if (idx === -1) {
        sources.push({ type: sourceType, [field]: checked ? [value] : [] } as BiDataSourceFilter);
        return { ...prev, actual_sources: sources };
      }
      const current = new Set(sources[idx][field as "statuses" | "stages"] ?? []);
      if (checked) current.add(value);
      else current.delete(value);
      sources[idx] = { ...sources[idx], [field]: Array.from(current) };
      return { ...prev, actual_sources: sources.filter((s) => {
        const list = s.type === "deals" ? s.stages : s.statuses;
        return (list?.length ?? 0) > 0;
      }) };
    });
  };

  const fieldLabel: Record<BiBudgetChangeLog["field_name"], string> = {
    overhead_budget: "製造間接費",
    sga_budget: "販管費",
    target_revenue: "売上目標",
    target_gross_profit: "粗利目標",
  };

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

  const handleCancel = () => {
    if (onCancel) onCancel();
    else router.push("/bi");
  };

  if (loading) {
    return (
      <div className={variant === "dialog" ? "py-4 space-y-5" : "p-4 md:p-6 space-y-5"}>
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className={variant === "dialog" ? "space-y-6" : "p-4 md:p-6 space-y-6 max-w-3xl"}>
      {/* ── ヘッダー（ページのみ） ── */}
      {variant === "page" && (
        <div className="flex items-start justify-between gap-4">
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 -ml-2 text-muted-foreground"
              onClick={handleCancel}
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
      )}

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
            <Label className="text-xs text-muted-foreground">全社売上目標（年額・万円）</Label>
            <AmountInput value={targetRevenue} onChange={setTargetRevenue} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">全社粗利目標（年額・万円）</Label>
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
              <Label className="text-xs text-muted-foreground">予算配賦額（年額・万円）</Label>
              <AmountInput value={overheadLump} onChange={setOverheadLump} className="max-w-xs" />
            </div>
          ) : (
            /* ── モードA: 内訳入力 ── */
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_180px_32px] gap-2 px-1 pb-1">
                <span className="text-xs text-muted-foreground font-medium">項目</span>
                <span className="text-xs text-muted-foreground font-medium text-right">金額（年額・万円）</span>
                <span />
              </div>
              {overheadItems.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_180px_32px] gap-2 items-center">
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
                  ¥{overheadTotal.toLocaleString()}万
                </span>
              </div>
              {overheadTotal > 0 && (
                <p className="text-[11px] text-muted-foreground text-right px-1">
                  月次按分（÷12）: ¥{Math.round(overheadTotal / 12).toLocaleString()}万/月
                </p>
              )}
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
            <Label className="text-xs text-muted-foreground">販管費予算（年額・万円）</Label>
            <AmountInput value={sgaBudget} onChange={setSgaBudget} className="max-w-xs" />
          </div>
        </CardContent>
      </Card>

      {/* ── 経営調整費（会社確保分・社員にも表示）── */}
      <Card className={canEditReserve ? "border-amber-200/70" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-600" />
            経営調整費（会社規定・目安1〜2%）
            {!canEditReserve && (
              <span className="ml-1 inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
                <Lock className="h-3 w-3" />設定権限がありません
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">会社指定粗利率（承認の基準ライン%）</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  disabled={!canEditReserve}
                  className="max-w-[120px] tabular-nums"
                  value={baseRatePct}
                  onChange={(e) => setBaseRatePct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">経営調整費率（見積全体に対する%）</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  disabled={!canEditReserve}
                  className="max-w-[120px] tabular-nums"
                  value={reserveRatePct}
                  onChange={(e) => setReserveRatePct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            承認の基準 ＝ <span className="font-semibold text-amber-700">{(baseRatePct + reserveRatePct).toFixed(1)}%</span>
            （会社指定{baseRatePct.toFixed(1)}% ＋ 経営調整費{reserveRatePct.toFixed(1)}%）。見積・実行予算の粗利率がこれを下回ると上長承認が必要です。
          </div>
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-amber-50 border border-amber-100 rounded-lg p-2.5">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
            <span>
              見積全体（予備費を含む）に対して会社率を原価として一律計上します。担当者は明細で編集できません。
              社員にも表示し、非表示による不信感を防ぎます。BIでは利益から控除した保守的な数字を表示し、決算時に利益へ戻せます。
              見積・実行予算では「会社指定粗利＋経営調整費」を満たさない場合に上長へ承認申請が必要になります。
            </span>
          </div>
          {canEditReserve && reserveRatePct > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5">
              <div className="text-xs">
                <p className="font-medium">
                  決算処理：経営調整費を利益に戻す
                </p>
                <p className="text-muted-foreground mt-0.5">
                  {reserveReleased
                    ? "現在は「戻し済み」。BIは予備費を含む実値を表示しています。"
                    : "現在は「控除中」。決算でここから利益へ戻せます。"}
                </p>
              </div>
              <Button
                variant={reserveReleased ? "outline" : "default"}
                size="sm"
                className={reserveReleased ? "shrink-0" : "shrink-0 bg-amber-600 hover:bg-amber-700"}
                disabled={releasingReserve}
                onClick={() => void handleToggleReserveRelease(!reserveReleased)}
              >
                {releasingReserve ? "処理中..." : reserveReleased ? "決算戻しを取消" : "決算：経営調整費を利益に戻す"}
              </Button>
            </div>
          )}
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
            <span className="text-xs text-muted-foreground font-medium">売上目標（年額・万円）</span>
            <span className="text-xs text-muted-foreground font-medium">粗利目標（年額・万円）</span>
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

      {/* ── 拠点別目標・販管費（No.80）。拠点名の追加・削除は設定 > CRMマスタ ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">拠点別目標・販管費</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {locTargets.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              拠点がありません。
              <Link href="/settings" className="underline underline-offset-2 text-foreground ml-1">
                設定 → マスタ → CRMマスタ
              </Link>
              で拠点を追加してください。
            </p>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 pb-1 px-1">
                <span className="text-xs text-muted-foreground font-medium">拠点</span>
                <span className="text-xs text-muted-foreground font-medium">売上目標（年額・万円）</span>
                <span className="text-xs text-muted-foreground font-medium">販管費（年額・万円）</span>
              </div>
              {locTargets.map((loc) => (
                <div key={loc.location_id} className="grid grid-cols-[1fr_1fr_1fr] gap-2 items-center">
                  <span className="text-sm font-medium px-1">{loc.location_name}</span>
                  <AmountInput
                    value={loc.target_revenue}
                    onChange={(v) =>
                      setLocTargets((prev) =>
                        prev.map((d) => d.location_id === loc.location_id ? { ...d, target_revenue: v } : d),
                      )
                    }
                  />
                  <AmountInput
                    value={loc.sga_budget}
                    onChange={(v) =>
                      setLocTargets((prev) =>
                        prev.map((d) => d.location_id === loc.location_id ? { ...d, sga_budget: v } : d),
                      )
                    }
                  />
                </div>
              ))}
            </>
          )}
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/40 border border-border/50 rounded-lg p-2.5 mt-1">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              拠点の追加・改名・削除は
              <Link href="/settings" className="underline underline-offset-2 text-foreground mx-1">
                設定 → マスタ → CRMマスタ
              </Link>
              で行います。ここは年度ごとの売上目標・販管費のみです。
            </span>
          </div>
        </CardContent>
      </Card>

      {budgetFieldsChanged && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">期中変更（修正履歴）</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">適用開始日（遡及可）</Label>
              <Input type="date" value={changeEffectiveFrom} onChange={(e) => setChangeEffectiveFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">変更理由メモ</Label>
              <Input value={changeNote} onChange={(e) => setChangeNote(e.target.value)} placeholder="例: 人件費増により予算配賦を上方修正" />
            </div>
          </CardContent>
        </Card>
      )}

      {changeLogs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">予算変更履歴</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs">
                    <th className="text-left px-5 py-2 font-medium text-muted-foreground">適用日</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">項目</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">変更前</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">変更後</th>
                    <th className="text-left px-5 py-2 font-medium text-muted-foreground">メモ</th>
                  </tr>
                </thead>
                <tbody>
                  {changeLogs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="px-5 py-2.5 tabular-nums">{log.effective_from}</td>
                      <td className="px-4 py-2.5">{fieldLabel[log.field_name]}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">¥{Number(log.old_value).toLocaleString()}万</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">¥{Number(log.new_value).toLocaleString()}万</td>
                      <td className="px-5 py-2.5 text-xs text-muted-foreground">{log.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 分析ルール（会社単位・SaaS） ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            分析ルール（会社共通）
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">請求ベース粗利率（原価なし時）</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  className="max-w-[120px] tabular-nums"
                  value={Math.round(companyConfig.invoice_gross_profit_rate * 100)}
                  onChange={(e) =>
                    setCompanyConfig((prev) => ({
                      ...prev,
                      invoice_gross_profit_rate: Math.min(100, Math.max(0, Number(e.target.value) || 0)) / 100,
                    }))
                  }
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">商談・契約ベース粗利率</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  className="max-w-[120px] tabular-nums"
                  value={Math.round(companyConfig.deal_gross_profit_rate * 100)}
                  onChange={(e) =>
                    setCompanyConfig((prev) => ({
                      ...prev,
                      deal_gross_profit_rate: Math.min(100, Math.max(0, Number(e.target.value) || 0)) / 100,
                    }))
                  }
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">見込度（A/B/C）の確度%</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                顧客に設定した見込度を、BIの見込み売上に反映する際の掛け率です
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(["A", "B", "C"] as const).map((grade) => (
                <div key={grade} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">見込 {grade}</Label>
                  <div className="flex items-center gap-2">
                    <IntegerInput
                      className="max-w-[120px] tabular-nums"
                      value={companyConfig.prospect_grade_rates[grade]}
                      onValueChange={(v) =>
                        setCompanyConfig((prev) => ({
                          ...prev,
                          prospect_grade_rates: {
                            ...prev.prospect_grade_rates,
                            [grade]: Math.min(100, Math.max(0, v)),
                          },
                        }))
                      }
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">特需の契約率（会社デフォルト）</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                特需案件で個別確度が未設定のときに使う掛け率です。運用上は100%か0%かの判断になりやすく、使い方は各社に委ねます
              </p>
            </div>
            <div className="flex items-center gap-2">
              <IntegerInput
                className="max-w-[120px] tabular-nums"
                value={companyConfig.special_demand_rate}
                onValueChange={(v) =>
                  setCompanyConfig((prev) => ({
                    ...prev,
                    special_demand_rate: Math.min(100, Math.max(0, v)),
                  }))
                }
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-sm font-medium">実績データソース</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">工事</p>
                <div className="flex flex-wrap gap-2">
                  {CONSTRUCTION_STATUSES.map((s) => (
                    <label key={s.value} className="inline-flex items-center gap-1.5 text-xs border rounded-md px-2 py-1">
                      <input
                        type="checkbox"
                        checked={actualHasSourceValue("constructions", s.value)}
                        onChange={(e) => toggleActualSource("constructions", s.value, e.target.checked)}
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">請求</p>
                <div className="flex flex-wrap gap-2">
                  {INVOICE_STATUSES.map((s) => (
                    <label key={s.value} className="inline-flex items-center gap-1.5 text-xs border rounded-md px-2 py-1">
                      <input
                        type="checkbox"
                        checked={actualHasSourceValue("invoices", s.value)}
                        onChange={(e) => toggleActualSource("invoices", s.value, e.target.checked)}
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">契約</p>
                <div className="flex flex-wrap gap-2">
                  {CONTRACT_STATUSES.map((s) => (
                    <label key={s.value} className="inline-flex items-center gap-1.5 text-xs border rounded-md px-2 py-1">
                      <input
                        type="checkbox"
                        checked={actualHasSourceValue("contracts", s.value)}
                        onChange={(e) => toggleActualSource("contracts", s.value, e.target.checked)}
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">商談</p>
                <div className="flex flex-wrap gap-2">
                  {DEAL_STAGES.map((s) => (
                    <label key={s.value} className="inline-flex items-center gap-1.5 text-xs border rounded-md px-2 py-1">
                      <input
                        type="checkbox"
                        checked={actualHasSourceValue("deals", s.value)}
                        onChange={(e) => toggleActualSource("deals", s.value, e.target.checked)}
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
            <div>
              <p className="text-sm font-medium">全社月次の製造間接費按分</p>
              <p className="text-xs text-muted-foreground">部門別月次は常に売上構成比で按分します</p>
            </div>
            <Tabs
              value={companyConfig.monthly_overhead_mode}
              onValueChange={(v) =>
                setCompanyConfig((prev) => ({
                  ...prev,
                  monthly_overhead_mode: v as "equal" | "revenue_share",
                }))
              }
            >
              <TabsList className="h-8">
                <TabsTrigger value="equal" className="text-xs px-3 h-7">均等 (÷12)</TabsTrigger>
                <TabsTrigger value="revenue_share" className="text-xs px-3 h-7">売上構成比</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Separator />

          {companyConfig.forecast_tiers.map((tier) => (
            <div key={tier.id} className="rounded-lg border border-border/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={tier.enabled}
                    onCheckedChange={(v) => updateForecastTier(tier.id, { enabled: v })}
                  />
                  <Input
                    value={tier.label}
                    onChange={(e) => updateForecastTier(tier.id, { label: e.target.value })}
                    className="h-8 max-w-xs text-sm font-medium"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={tier.cumulative}
                      onCheckedChange={(v) => updateForecastTier(tier.id, { cumulative: v })}
                    />
                    前段階を加算（例: A見込含）
                  </label>
                  {companyConfig.forecast_tiers.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeForecastTier(tier.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {tier.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">工事ステータス</p>
                    <div className="flex flex-wrap gap-2">
                      {CONSTRUCTION_STATUSES.map((s) => (
                        <label key={s.value} className="inline-flex items-center gap-1.5 text-xs border rounded-md px-2 py-1">
                          <input
                            type="checkbox"
                            checked={tierHasSourceValue(tier, "constructions", s.value)}
                            onChange={(e) => toggleTierSourceStatus(tier.id, "constructions", s.value, e.target.checked)}
                          />
                          {s.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">契約ステータス</p>
                    <div className="flex flex-wrap gap-2">
                      {CONTRACT_STATUSES.map((s) => (
                        <label key={s.value} className="inline-flex items-center gap-1.5 text-xs border rounded-md px-2 py-1">
                          <input
                            type="checkbox"
                            checked={tierHasSourceValue(tier, "contracts", s.value)}
                            onChange={(e) => toggleTierSourceStatus(tier.id, "contracts", s.value, e.target.checked)}
                          />
                          {s.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">商談ステージ</p>
                    <div className="flex flex-wrap gap-2">
                      {DEAL_STAGES.map((s) => (
                        <label key={s.value} className="inline-flex items-center gap-1.5 text-xs border rounded-md px-2 py-1">
                          <input
                            type="checkbox"
                            checked={tierHasSourceValue(tier, "deals", s.value)}
                            onChange={(e) => toggleTierSourceStatus(tier.id, "deals", s.value, e.target.checked)}
                          />
                          {s.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addForecastTier}>
            <Plus className="h-3.5 w-3.5" />
            着地予測パターンを追加
          </Button>

          <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/40 border border-border/50 rounded-lg p-2.5">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              着地予測の名称・集計対象（A見込等）は会社ごとに設定できます。他社では不要な段階を無効化するか、商談ベースのパイプラインに切り替えてください。
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── 保存ボタン（下部） ── */}
      <div className={`flex justify-end gap-3 pt-2 ${variant === "dialog" ? "pb-2" : "pb-8"}`}>
        <Button variant="outline" onClick={handleCancel}>キャンセル</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "保存中…" : "設定を保存"}
        </Button>
      </div>
    </div>
  );
}
