"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LayoutDashboard,
  PieChart as PieIcon,
  Info,
  Settings2,
  BarChart3,
  TrendingUp,
  ChevronRight,
  ShieldCheck,
  Eye,
  EyeOff,
  RotateCcw,
  MessageCircle,
  Sparkles,
  FileText,
} from "lucide-react";
import { useBridgeChat } from "@/contexts/chat-panel-context";
import dynamic from "next/dynamic";
import {
  getBiSettings,
  getBiActuals,
  getBiProspectSummary,
  getBiHeadcount,
  releaseReserve,
  type BiProspectSummary,
  type BiHeadcountSummary,
} from "@/lib/actions/bi";
import { useAuth } from "@/components/providers/auth-provider";
import { useCompanyPermissions } from "@/hooks/use-company-permissions";
import { permissionRoleSlugs } from "@/lib/role-assignment";
import { toast } from "sonner";
import type { BiAnnualSettings, BiActuals } from "@/lib/bi-types";
import { MOCK_OVERHEAD_BUDGET_MAN } from "@/lib/bi-types";
import {
  getCurrentFiscalYear,
  fiscalYearLabel,
  listFiscalYears,
  buildFiscalMonthLabels,
  getForecastStartIndex,
  DEFAULT_FISCAL_MONTH_START,
  normalizeBudgetMan,
  buildRealisticMonthlyComboData,
  shouldUseMonthlyTrendMock,
} from "@/lib/bi-utils";
import {
  buildBiDashboardMock,
  shouldUseBiDashboardMock,
  resolveDashboardProspectSummary,
  buildBiDashboardMonthlyCombo,
} from "@/lib/bi-mock-data";
import {
  getFinancialActualsForBi,
  type FinancialActualsForBi,
} from "@/lib/actions/financial-statements";
import { BiDepartmentCards, type BiAxisMode } from "@/components/bi/bi-department-cards";
import { BiDepartmentProjectsSheet } from "@/components/bi/bi-department-projects-sheet";
import { KpiRow } from "@/components/shared/kpi-row";
import { cn } from "@/lib/utils";
import { useBrandColor } from "@/hooks/use-brand-color";
import { buildBrandSeriesPalette, computeBrandFromHex } from "@/lib/brand-color";

const chartFallback = () => <div className="h-64 animate-pulse rounded-xl bg-muted" />;
const ComboChart = dynamic(
  () => import("@/components/charts/combo-chart").then((m) => m.ComboChart),
  { loading: chartFallback },
);
const TrendAreaChart = dynamic(
  () => import("@/components/charts/trend-area-chart").then((m) => m.TrendAreaChart),
  { loading: chartFallback },
);
const HorizontalBarChart = dynamic(
  () => import("@/components/charts/horizontal-bar-chart").then((m) => m.HorizontalBarChart),
  { loading: chartFallback },
);
const DonutChart = dynamic(
  () => import("@/components/charts/donut-chart").then((m) => m.DonutChart),
  { loading: chartFallback },
);
const BiSettingsDialog = dynamic(
  () => import("@/components/bi/bi-settings-dialog").then((m) => m.BiSettingsDialog),
);

const BI_NEGATIVE = "#e11d48";

const FALLBACK_DEPT_ACTUALS = [
  { name: "一般住宅",  label: "A部門", revenue: 0, grossProfit: 0 },
  { name: "新築",      label: "B部門", revenue: 0, grossProfit: 0 },
  { name: "公共工事",  label: "C部門", revenue: 0, grossProfit: 0 },
  { name: "リフォーム", label: "D部門", revenue: 0, grossProfit: 0 },
];

function makeFallbackMonthly(startMonth = DEFAULT_FISCAL_MONTH_START) {
  return buildFiscalMonthLabels(startMonth).map((month) => ({ month, revenue: 0, grossProfit: 0 }));
}

const FALLBACK_FORECAST_TIERS = [
  { id: "contracted", label: "着地（契約済）", revenue: 0, grossProfit: 0 },
  { id: "prospective", label: "着地（A見込含）", revenue: 0, grossProfit: 0 },
];

// ── ユーティリティ ──────────────────────────────────────────────────
function r1(v: number) { return Math.round(v * 10) / 10; }
function pct(part: number, whole: number) { return whole > 0 ? r1((part / whole) * 100) : 0; }

/** 表示単位（No.82）。内部データは円（画面上は万円）で保持し、表示のみ切り替える */
type BiDisplayUnit = "man" | "yen" | "thousand" | "million";

const BI_DISPLAY_UNIT_OPTIONS: Array<{ value: BiDisplayUnit; label: string }> = [
  { value: "man", label: "万円" },
  { value: "yen", label: "円" },
  { value: "thousand", label: "千円" },
  { value: "million", label: "百万円" },
];

/** 万円の値を選択中の表示単位でフォーマット */
function fmtManWithUnit(v: number, unit: BiDisplayUnit): string {
  const man = Math.abs(v);
  switch (unit) {
    case "yen":
      return `¥${Math.round(man * 10_000).toLocaleString()}`;
    case "thousand":
      return `¥${Math.round(man * 10).toLocaleString()}千円`;
    case "million":
      return `¥${(man / 100).toLocaleString("ja-JP", { maximumFractionDigits: 1 })}百万円`;
    default:
      return `¥${man.toLocaleString()}万`;
  }
}
function deltaLabel(pt: number | null | undefined, unit = "pt") {
  if (pt == null) return undefined;
  const sign = pt > 0 ? "+" : "";
  return `前月比 ${sign}${pt}${unit}`;
}

type MonthlyDetailRow =
  | {
      kind: "actual";
      label: string;
      hasActivity: boolean;
      revenue: number;
      grossProfit: number;
      allocation: number;
      grossProfitTotal: number;
      cumulative: number;
    }
  | { kind: "forecast"; label: string };

/** 月次明細（前半：実績期間を個別行、後半：着地予測1行） */
function buildMonthlyDetailRows(
  monthly: Array<{ month: string; revenue: number; grossProfit: number }>,
  allocations: number[],
  settingsConfigured: boolean,
  overheadForCalc: number,
  forecastStartIdx: number,
): MonthlyDetailRow[] {
  const uniformAlloc =
    settingsConfigured && overheadForCalc > 0 ? Math.round(overheadForCalc / 12) : 0;

  const resolveAlloc = (i: number) => {
    const v = allocations[i] > 0 ? allocations[i] : uniformAlloc;
    return v > 0 ? v : 0;
  };

  const rows: MonthlyDetailRow[] = [];
  let cumulative = 0;

  for (let i = 0; i < forecastStartIdx; i++) {
    const m = monthly[i];
    const hasActivity = m.revenue !== 0 || m.grossProfit !== 0;
    const alloc = resolveAlloc(i);

    if (hasActivity) {
      const grossProfitTotal = m.grossProfit - alloc;
      cumulative += grossProfitTotal;
      rows.push({
        kind: "actual",
        label: m.month,
        hasActivity: true,
        revenue: m.revenue,
        grossProfit: m.grossProfit,
        allocation: alloc,
        grossProfitTotal,
        cumulative,
      });
    } else {
      rows.push({
        kind: "actual",
        label: m.month,
        hasActivity: false,
        revenue: 0,
        grossProfit: 0,
        allocation: alloc,
        grossProfitTotal: 0,
        cumulative,
      });
    }
  }

  const forecastStart = monthly[forecastStartIdx]?.month ?? monthly[forecastStartIdx]?.month ?? "予測";
  const forecastEnd = monthly[monthly.length - 1]?.month ?? "3月";
  rows.push({
    kind: "forecast",
    label: `${forecastStart}〜${forecastEnd}（着地予測）`,
  });

  return rows;
}

/** グラフ用モック系列から月次明細行を生成（表ビューとグラフの連動用） */
function buildMonthlyDetailRowsFromCombo(
  comboData: Array<{ month: string; 粗利額: number; 月次予定配賦: number; 累計: number }>,
  forecastStartIdx: number,
  grossProfitRatePct: number,
): MonthlyDetailRow[] {
  const rate = grossProfitRatePct > 0 ? grossProfitRatePct / 100 : 0.586;
  const rows: MonthlyDetailRow[] = [];

  for (let i = 0; i < forecastStartIdx; i++) {
    const pt = comboData[i];
    if (!pt) continue;
    const grossProfit = pt.粗利額;
    const allocation = Math.abs(pt.月次予定配賦);
    const grossProfitTotal = grossProfit - allocation;
    const hasActivity = grossProfit !== 0 || allocation !== 0;

    rows.push({
      kind: "actual",
      label: pt.month,
      hasActivity,
      revenue: hasActivity && rate > 0 ? Math.round(grossProfit / rate) : 0,
      grossProfit,
      allocation,
      grossProfitTotal,
      cumulative: pt.累計,
    });
  }

  const forecastStart = comboData[forecastStartIdx]?.month ?? "予測";
  const forecastEnd = comboData[comboData.length - 1]?.month ?? "3月";
  rows.push({
    kind: "forecast",
    label: `${forecastStart}〜${forecastEnd}（着地予測）`,
  });

  return rows;
}

function resolveMonthlyAllocation(
  index: number,
  allocations: number[],
  settingsConfigured: boolean,
  overheadForCalc: number,
): number {
  const uniformAlloc =
    settingsConfigured && overheadForCalc > 0 ? Math.round(overheadForCalc / 12) : 0;
  const v = allocations[index] > 0 ? allocations[index] : uniformAlloc;
  return v > 0 ? v : 0;
}

function fmtMonthlyAlloc(
  allocation: number,
  settingsConfigured: boolean,
  fmt: (v: number) => string,
) {
  if (!settingsConfigured || allocation <= 0) return "—";
  return `▲${fmt(allocation)}`;
}

// ── セクションヘッダー ───────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, right }: { icon: React.ElementType; title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mt-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[var(--brand-dark)]" />
        <span className="text-sm font-bold text-foreground">{title}</span>
      </div>
      {right}
    </div>
  );
}

// ── パネル ────────────────────────────────────────────────────────────
function BiPanel({
  title,
  description,
  children,
  headerRight,
  className,
  flush,
  collapsible,
  defaultOpen = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  headerRight?: ReactNode;
  className?: string;
  flush?: boolean;
  /** 折りたたみ可能にする（明細テーブルなど。既定は閉じた状態） */
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const showBody = !collapsible || open;

  return (
    <div className={cn("frost-card rounded-lg flex flex-col", flush ? "gap-0" : "p-4 gap-3", className)}>
      <div className={cn(
        "flex items-start justify-between gap-2 shrink-0",
        showBody && "pb-2.5 border-b border-border/60",
        flush && "px-4 pt-4",
      )}>
        {collapsible ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 min-w-0 text-left group"
          >
            <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-90")} />
            <span className="min-w-0">
              <span className="text-xs font-bold text-foreground group-hover:text-[var(--brand-dark)]">{title}</span>
              {description ? <span className="block text-[11px] text-muted-foreground mt-0.5">{description}</span> : null}
            </span>
          </button>
        ) : (
          <div className="min-w-0">
            <span className="text-xs font-bold text-foreground">{title}</span>
            {description ? <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p> : null}
          </div>
        )}
        {headerRight}
      </div>
      {showBody ? <div className="min-w-0">{children}</div> : null}
    </div>
  );
}

/** BI2 と同系のカード枠 */
function ExecCard({
  title,
  right,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white shadow-[0_8px_28px_-10px_rgba(var(--brand-dark-rgb),0.16)] ring-1 ring-[rgba(var(--brand-accent-rgb),0.85)] flex flex-col min-h-0",
        className,
      )}
    >
      {(title || right) && (
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-1">
          {title ? (
            <h3 className="text-[15px] font-bold tracking-tight text-slate-900">{title}</h3>
          ) : (
            <span />
          )}
          {right}
        </div>
      )}
      <div className={cn("px-4 pb-3 min-w-0 flex-1", bodyClassName)}>{children}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// メイン
// ────────────────────────────────────────────────────────────────────
export function BiClient({
  initialSettings = null,
  initialActuals = null,
}: {
  initialSettings?: BiAnnualSettings | null;
  initialActuals?: BiActuals | null;
}) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { role, profile } = useAuth();
  const { canAccess } = useCompanyPermissions();
  // 予備費の実値確認・決算戻しの操作可否は権限マトリクス（reserve_fee）で制御
  const canManageReserve = role ? canAccess("reserve_fee", permissionRoleSlugs(profile ?? { role })) : false;
  const [showTheoretical, setShowTheoretical] = useState(false);
  const [showActualReserve, setShowActualReserve] = useState(false);
  const [releasingReserve, setReleasingReserve] = useState(false);
  const [settings, setSettings] = useState<BiAnnualSettings | null>(
    () => initialSettings ?? queryClient.getQueryData(["bi-settings", getCurrentFiscalYear()]) ?? null,
  );
  const [actuals, setActuals] = useState<BiActuals | null>(
    () => initialActuals ?? queryClient.getQueryData(["bi-actuals", getCurrentFiscalYear()]) ?? null,
  );
  const [prevActuals, setPrevActuals] = useState<BiActuals | null>(null);
  const [prospectSummary, setProspectSummary] = useState<BiProspectSummary | null>(null);
  const [yoyMode, setYoyMode] = useState<"cumulative" | "monthly">("cumulative");
  const [monthlyView, setMonthlyView] = useState<"chart" | "table">("chart");
  const [includeSpecial, setIncludeSpecial] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(
    () => !!(initialSettings ?? queryClient.getQueryData(["bi-settings", getCurrentFiscalYear()])),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fiscalYear, setFiscalYear] = useState(getCurrentFiscalYear());
  const fiscalYearOptions = listFiscalYears(5);
  const { openBridgeChat } = useBridgeChat();
  /** idle → 提案表示 → 回答済み */
  const [consultStep, setConsultStep] = useState<"idle" | "suggest" | "done">("idle");
  /** 表示単位切替（No.82）。内部データは変えず表示のみ変換 */
  const [displayUnit, setDisplayUnit] = useState<BiDisplayUnit>("man");
  /** 部門/拠点PJ一覧パネル（No.75/80）で表示中のキー */
  const [deptDetailName, setDeptDetailName] = useState<string | null>(null);
  /** No.80: 部門軸 / 拠点軸 */
  const [axisMode, setAxisMode] = useState<BiAxisMode>("department");
  /** 換算人数（No.77/78: 正社員=1.0 / パート=0.5） */
  const [headcount, setHeadcount] = useState<BiHeadcountSummary | null>(null);
  /** 全社サマリーの表示モード（No.77/78: 滝チャート内で切替） */
  const [summaryMode, setSummaryMode] = useState<"company" | "perCapita">("company");
  /** No.95: 選択年度の確定済み決算書（存在すれば確定値として表示） */
  const [finActuals, setFinActuals] = useState<FinancialActualsForBi | null>(null);

  const fmtMan = useCallback((v: number) => fmtManWithUnit(v, displayUnit), [displayUnit]);
  const fmtSigned = useCallback((v: number) => (v < 0 ? `▲${fmtMan(v)}` : fmtMan(v)), [fmtMan]);
  const fmtTargetMan = useCallback(
    (v: number | null | undefined) => (v == null ? "未設定" : fmtMan(v)),
    [fmtMan],
  );

  // 決算書（/financials）へのリンクは経営層ロールのみ表示（No.79）
  const canViewFinancials = ["hq_admin", "admin", "executive"].includes(role ?? "");

  useEffect(() => {
    getBiHeadcount().then(setHeadcount).catch(() => {});
  }, []);

  // No.95: 確定済み決算書があれば取得してBIに反映（無ければ null → 速報値表示）
  useEffect(() => {
    let cancelled = false;
    setFinActuals(null);
    getFinancialActualsForBi(fiscalYear)
      .then((fa) => { if (!cancelled) setFinActuals(fa); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [fiscalYear]);

  useEffect(() => {
    setConsultStep("idle");
  }, [fiscalYear]);

  const { hex: brandHex } = useBrandColor();
  const brand = computeBrandFromHex(brandHex);
  const CHART_PRIMARY = brandHex;
  const CHART_DARK    = brand.dark;
  const CHART_MID     = brand.mid;
  const CHART_ACCENT  = brand.accent;

  useEffect(() => {
    if (searchParams.get("settings") === "1") {
      setSettingsOpen(true);
      window.history.replaceState(null, "", "/bi");
    }
  }, [searchParams]);

  const biFetchInflight = useRef(false);
  const loadBiData = useCallback((silent = false, includePrevYear = true) => {
    if (biFetchInflight.current) return Promise.resolve();
    biFetchInflight.current = true;
    if (!silent) setSettingsLoaded(false);
    return Promise.all([
      getBiSettings(fiscalYear),
      getBiActuals(fiscalYear),
      // 前年実績は変化がほぼないため、ポーリング時はスキップして負荷を抑える
      includePrevYear ? getBiActuals(fiscalYear - 1) : Promise.resolve(undefined),
      getBiProspectSummary(),
    ])
      .then(([s, a, p, ps]) => {
        setSettings(s);
        setActuals(a);
        queryClient.setQueryData(["bi-settings", fiscalYear], s);
        queryClient.setQueryData(["bi-actuals", fiscalYear], a);
        if (p !== undefined) setPrevActuals(p);
        setProspectSummary(ps);
      })
      .finally(() => {
        biFetchInflight.current = false;
        setSettingsLoaded(true);
      });
  }, [fiscalYear, queryClient]);

  // 初回マウントは SSR の初期データを使い、不足分（前年実績・見込みサマリ）のみ取得。
  // 年度変更時はローディング表示付きで全体を再取得。
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      if (!settings) {
        void loadBiData(false);
        return;
      }
      Promise.all([getBiActuals(fiscalYear - 1), getBiProspectSummary()])
        .then(([p, ps]) => { setPrevActuals(p); setProspectSummary(ps); });
      return;
    }
    loadBiData(false);
  }, [fiscalYear, loadBiData, initialSettings]);

  // タブ復帰時のみ静かに更新（window focus は頻発するので使わない）+ 2分ポーリング
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") void loadBiData(true, false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void loadBiData(true, false);
    }, 300000);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(interval);
    };
  }, [loadBiData]);

  const handleToggleReserveRelease = useCallback(async (release: boolean) => {
    setReleasingReserve(true);
    try {
      const res = await releaseReserve(fiscalYear, release);
      if (!res.ok) { toast.error(res.error ?? "操作に失敗しました"); return; }
      toast.success(release ? "予備費を利益に戻しました（決算）" : "予備費の決算戻しを取り消しました");
      await loadBiData(true);
    } finally {
      setReleasingReserve(false);
    }
  }, [fiscalYear, loadBiData]);

  const fiscalMonthStartRaw       = actuals?.fiscalMonthStart ?? DEFAULT_FISCAL_MONTH_START;
  const useDashboardMock          = shouldUseBiDashboardMock(fiscalYear, fiscalMonthStartRaw);
  const dashboardMock             = useDashboardMock ? buildBiDashboardMock(fiscalMonthStartRaw) : null;

  const effectiveSettings         = dashboardMock?.settings ?? settings;
  const effectiveActuals          = dashboardMock?.actuals ?? actuals;
  const effectivePrevActuals      = dashboardMock?.prevActuals ?? prevActuals;
  // 見込み売上は実CRMの見込度を優先。空のときだけデモ母数＋会社設定の確度%
  const effectiveProspectSummary  = useDashboardMock && dashboardMock
    ? resolveDashboardProspectSummary(dashboardMock.prospectSummary, prospectSummary)
    : prospectSummary;

  const settingsConfigured = effectiveSettings !== null;
  const targetRevenue  = settingsConfigured ? normalizeBudgetMan(effectiveSettings.target_revenue ?? 0)        : null;
  const overheadBudget = settingsConfigured ? normalizeBudgetMan(effectiveSettings.overhead_budget ?? 0)       : null;
  const sgaBudget      = settingsConfigured ? normalizeBudgetMan(effectiveSettings.sga_budget ?? 0)            : null;
  const targetGp       = settingsConfigured ? normalizeBudgetMan(effectiveSettings.target_gross_profit ?? 0)   : null;

  const overheadForCalc      = overheadBudget ?? 0;
  const sgaForCalc           = sgaBudget ?? 0;
  const targetRevenueForCalc = targetRevenue ?? 0;
  const targetGpForCalc      = targetGp ?? 0;

  const fiscalMonthStart          = effectiveActuals?.fiscalMonthStart          ?? DEFAULT_FISCAL_MONTH_START;
  const forecastStartIndex        = getForecastStartIndex(fiscalMonthStart);

  const deptActuals               = effectiveActuals?.deptActuals               ?? FALLBACK_DEPT_ACTUALS;
  const locationActuals           = effectiveActuals?.locationActuals           ?? [];
  const streamPalette = buildBrandSeriesPalette(brandHex, Math.max(deptActuals.length, locationActuals.length, 4));
  const DEPT_CHART_COLORS = streamPalette.map((p) => p.color);
  const monthlyActuals            = effectiveActuals?.monthly                   ?? makeFallbackMonthly(fiscalMonthStart);
  const monthlyOverheadAllocations = effectiveActuals?.monthlyOverheadAllocations ?? Array(12).fill(0);
  const monthlySgaAllocations     = effectiveActuals?.monthlySgaAllocations     ?? Array(12).fill(0);
  const forecastTiers             = effectiveActuals?.forecastTiers             ?? FALLBACK_FORECAST_TIERS;
  const sparklines                = effectiveActuals?.sparklines;
  const grossProfitRateDelta      = effectiveActuals?.deltas.grossProfitRatePt;

  const deptTargetMap:   Record<string, number> = {};
  const deptGpTargetMap: Record<string, number> = {};
  if (effectiveSettings?.department_targets?.length) {
    effectiveSettings.department_targets.forEach((d) => {
      deptTargetMap[d.department_name]   = d.target_revenue;
      deptGpTargetMap[d.department_name] = d.target_gross_profit;
    });
  }
  const locTargetMap: Record<string, { target: number; sga: number }> = {};
  if (effectiveSettings?.location_targets?.length) {
    effectiveSettings.location_targets.forEach((l) => {
      locTargetMap[l.location_id] = { target: l.target_revenue, sga: l.sga_budget };
    });
  }

  // 工事台帳ベース（部門合算）。No.95: 確定済み決算書があるときは全社KPIを会計値で上書きする。
  const constructionRevenue = deptActuals.reduce((s, d) => s + d.revenue, 0);
  const constructionGrossProfitActual = deptActuals.reduce((s, d) => s + d.grossProfit, 0);
  const useAccountingKpis = Boolean(finActuals);
  const accountingRevenueMan = finActuals ? finActuals.revenue / 10_000 : 0;
  const accountingGrossProfitMan = finActuals ? finActuals.grossProfit / 10_000 : 0;
  const accountingOperatingIncomeMan = finActuals ? finActuals.operatingIncome / 10_000 : 0;
  const accountingSgaMan = finActuals ? finActuals.sellingGeneralAdmin / 10_000 : 0;

  const totalRevenue = useAccountingKpis ? accountingRevenueMan : constructionRevenue;
  const totalGrossProfitActual = useAccountingKpis
    ? accountingGrossProfitMan
    : constructionGrossProfitActual;

  // ── 予備費（非表示%）──────────────────────────────────────────────
  // 会社指定の予備費率で売上から控除額を算出。通常時は利益から控除して保守表示し、
  // 決算で戻す（reserve_released=true）と実値に戻る。管理者は実値トグルで一時的に確認可。
  // 会計ベースKPI時は予備費控除しない（決算書側で既に最終利益になっている）。
  const reserveRate     = effectiveSettings?.reserve_fee_rate ?? 0;
  const reserveReleased = effectiveSettings?.reserve_released ?? false;
  const reserveAmount   = Math.round((useAccountingKpis ? constructionRevenue : totalRevenue) * reserveRate);
  // 控除中か（率>0 かつ 未決算 かつ 実値トグルOFF）
  const reserveActive   = !useAccountingKpis && reserveRate > 0 && !reserveReleased && !showActualReserve;
  const totalGrossProfit = totalGrossProfitActual - (reserveActive ? reserveAmount : 0);

  const grossProfitRate  = pct(totalGrossProfit, totalRevenue);
  const achieveRateTotal = pct(totalRevenue, targetRevenueForCalc);

  // No.105: 固定費（予定配賦）・販管費の年額は、期中は月割り（経過月数/12）で按分して控除する。
  // 過年度は12ヶ月分（=年額）をそのまま使用。
  const elapsedMonths = fiscalYear === getCurrentFiscalYear(fiscalMonthStart)
    ? Math.max(1, Math.min(getForecastStartIndex(fiscalMonthStart), 12))
    : 12;
  const overheadYtd = useAccountingKpis
    ? 0
    : Math.round(overheadForCalc * elapsedMonths / 12);
  const sgaYtd = useAccountingKpis
    ? accountingSgaMan
    : Math.round(sgaForCalc * elapsedMonths / 12);

  // 会計ベースでは売上総利益＝決算書の売上総利益、営業利益＝決算書の営業利益を正とする（No.95）
  const grossProfitTotal = useAccountingKpis
    ? accountingGrossProfitMan
    : totalGrossProfit - overheadYtd;
  const gptRate          = pct(grossProfitTotal, totalRevenue);
  const operatingProfit  = useAccountingKpis
    ? accountingOperatingIncomeMan
    : grossProfitTotal - sgaYtd;
  const opRate           = pct(operatingProfit, totalRevenue);
  const kpiBasisLabel = useAccountingKpis ? "※会計ベース（決算書）" : "※工事粗利ベース";

  // 1人当たり（No.77/78）: 滝チャートの各金額を換算人数で割る
  const headcountWeight = headcount?.weight ?? 0;
  const perCapitaDivisor = summaryMode === "perCapita" && headcountWeight > 0 ? headcountWeight : 1;
  const perCapita = (v: number) => Math.round((v / perCapitaDivisor) * 10) / 10;
  const consultActionAsk =
    operatingProfit < 0
      ? "見込みの高い商談へ、今週中に再メール・電話のフォローを出しますか？"
      : achieveRateTotal < 80
        ? "未フォローの見込み顧客に、担当者から再アプローチを指示しますか？"
        : "パイプラインの上位案件を優先して、見積・契約の着手を早めますか？";

  const monthlyComboDataRaw = (() => {
    let cum = 0;
    return monthlyActuals.map((m, i) => {
      const alloc = resolveMonthlyAllocation(
        i,
        monthlyOverheadAllocations,
        settingsConfigured,
        overheadForCalc,
      );
      const grossProfitTotal = m.grossProfit - alloc;
      cum += grossProfitTotal;
      return {
        month: m.month,
        粗利額: m.grossProfit,
        月次予定配賦: alloc > 0 ? -alloc : 0,
        累計: cum,
      };
    });
  })();

  const useTrendMock = useDashboardMock || shouldUseMonthlyTrendMock(monthlyActuals, monthlyComboDataRaw);
  const monthlyComboData = useDashboardMock
    ? buildBiDashboardMonthlyCombo(fiscalMonthStart)
    : useTrendMock
      ? buildRealisticMonthlyComboData(
          monthlyActuals,
          totalGrossProfit > 0 ? totalGrossProfit : 2400,
          settingsConfigured ? overheadForCalc : MOCK_OVERHEAD_BUDGET_MAN,
        )
      : monthlyComboDataRaw;

  const monthlyDetailRows = useTrendMock
    ? buildMonthlyDetailRowsFromCombo(monthlyComboData, forecastStartIndex, grossProfitRate)
    : buildMonthlyDetailRows(
        monthlyActuals,
        monthlyOverheadAllocations,
        settingsConfigured,
        overheadForCalc,
        forecastStartIndex,
      );

  // 月別推移パネルの判断用サマリー（グラフがモックのときはグラフと同じ系列を参照）
  const trendSummarySource = useTrendMock ? monthlyComboData : null;
  const lastActualCumulative = (() => {
    if (trendSummarySource) {
      const idx = Math.min(forecastStartIndex, trendSummarySource.length) - 1;
      return idx >= 0 ? trendSummarySource[idx].累計 : 0;
    }
    let last = 0;
    for (const r of monthlyDetailRows) {
      if (r.kind === "actual" && r.hasActivity) last = r.cumulative;
    }
    return last;
  })();
  const trendGrossProfitTotal = useTrendMock
    ? monthlyComboData.reduce((s, r) => s + r.粗利額, 0)
    : totalGrossProfit;
  // 損益分岐点まで＝年間間接費 − 累計粗利（>0でまだ未達、<=0で超過）
  const breakevenGap = overheadForCalc - trendGrossProfitTotal;

  // ── 昨対比較（売上・月次/累計） ──────────────────────────────────
  const prevMonthly = effectivePrevActuals?.monthly ?? makeFallbackMonthly(fiscalMonthStart);
  const hasPrevData = effectivePrevActuals?.hasData ?? false;
  // 過去年度を選択中は全月が実績。当年度のみ未到来月を除外
  const isCurrentFY = fiscalYear === getCurrentFiscalYear(fiscalMonthStart);
  const yoyActualEndIdx = isCurrentFY ? forecastStartIndex : 12;

  const yoyRows = (() => {
    let curCum = 0;
    let prevCum = 0;
    return monthlyActuals.map((m, i) => {
      const prevRev = prevMonthly[i]?.revenue ?? 0;
      const isFuture = i >= yoyActualEndIdx;
      if (!isFuture) curCum += m.revenue;
      prevCum += prevRev;
      return {
        month: m.month,
        isFuture,
        current: m.revenue,
        prev: prevRev,
        currentCum: curCum,
        prevCum,
        monthlyRatio: !isFuture && prevRev > 0 ? r1((m.revenue / prevRev) * 100) : null,
        cumulativeRatio: !isFuture && prevCum > 0 ? r1((curCum / prevCum) * 100) : null,
      };
    });
  })();

  // 月次モード: 当月棒＋期首からの累計線（例: 6月表示で4〜5月累計と6月が同時に見える）
  const yoyChartData = yoyRows.map((row) => {
    if (yoyMode === "cumulative") {
      return {
        month: row.month,
        当期: row.isFuture ? 0 : row.currentCum,
        前期: row.prevCum,
        当期累計: 0,
      };
    }
    return {
      month: row.month,
      当期: row.isFuture ? 0 : row.current,
      前期: row.prev,
      当期累計: row.isFuture ? 0 : row.currentCum,
    };
  });

  const yoyRatioClass = (ratio: number | null) =>
    ratio == null ? "text-muted-foreground" : ratio >= 100 ? "text-[var(--brand-dark)]" : "text-rose-500";
  const fmtRatio = (ratio: number | null) => (ratio == null ? "—" : `${ratio}%`);

  // 部門別昨対比: 前年度の部門実績を部門名でマッチング
  const prevDeptMap = new Map(
    (effectivePrevActuals?.deptActuals ?? []).map((d) => [d.name, d]),
  );
  const deptYoY = (name: string, currentRevenue: number) => {
    const prevRev = prevDeptMap.get(name)?.revenue ?? 0;
    return {
      prevRevenue: prevRev,
      ratio: prevRev > 0 ? r1((currentRevenue / prevRev) * 100) : null,
    };
  };
  const prevDeptTotalRevenue = (effectivePrevActuals?.deptActuals ?? []).reduce((s, d) => s + d.revenue, 0);
  const deptTotalYoYRatio = prevDeptTotalRevenue > 0 ? r1((totalRevenue / prevDeptTotalRevenue) * 100) : null;

  const deptCards = deptActuals.map((d, i) => {
    const target = deptTargetMap[d.name] ?? null;
    const gpTarget = deptGpTargetMap[d.name] ?? null;
    const rate = target != null && target > 0 ? pct(d.revenue, target) : 0;
    const gpRate = pct(d.grossProfit, d.revenue);
    const deptSga = totalRevenue > 0 ? Math.round(sgaForCalc * (d.revenue / totalRevenue)) : 0;
    const deptOp = d.grossProfit - deptSga;
    const yoy = deptYoY(d.name, d.revenue);
    return {
      id: d.name,
      name: d.name,
      label: d.label,
      revenue: d.revenue,
      grossProfit: d.grossProfit,
      target,
      gpTarget,
      achieveRate: rate,
      yoyRatio: yoy.ratio,
      prevRevenue: yoy.prevRevenue,
      gpRate,
      deptSga,
      deptOp,
      color: DEPT_CHART_COLORS[i % DEPT_CHART_COLORS.length],
    };
  });

  // 拠点カード（No.80）: 売上・粗利は工事の location_id、販管費は拠点別予算
  const prevLocMap = new Map(
    (effectivePrevActuals?.locationActuals ?? []).map((l) => [l.id, l]),
  );
  const locationCards = locationActuals.map((l, i) => {
    const targets = locTargetMap[l.id];
    const target = targets?.target ?? null;
    const locSga = targets?.sga ?? 0;
    const rate = target != null && target > 0 ? pct(l.revenue, target) : 0;
    const gpRate = pct(l.grossProfit, l.revenue);
    const prevRev = prevLocMap.get(l.id)?.revenue ?? 0;
    return {
      id: l.id,
      name: l.name,
      label: l.label,
      revenue: l.revenue,
      grossProfit: l.grossProfit,
      target,
      gpTarget: null as number | null,
      achieveRate: rate,
      yoyRatio: prevRev > 0 ? r1((l.revenue / prevRev) * 100) : null,
      prevRevenue: prevRev,
      gpRate,
      deptSga: locSga,
      deptOp: l.grossProfit - locSga,
      color: DEPT_CHART_COLORS[i % DEPT_CHART_COLORS.length],
    };
  });

  const axisCards = axisMode === "location" ? locationCards : deptCards;

  const execDonut = deptCards
    .filter((d) => d.revenue > 0)
    .map((d) => ({ label: d.name, value: d.revenue, color: d.color }));

  const prospectBars = (effectiveProspectSummary?.rows ?? []).map((row, i) => ({
    label: `見込 ${row.grade}（${row.rate}%）`,
    values: [row.weightedRevenue],
    color: DEPT_CHART_COLORS[i % DEPT_CHART_COLORS.length],
  }));

  const contractedTier = forecastTiers.find((t) => t.id === "contracted") ?? forecastTiers[0];
  const prospectiveTier = forecastTiers.find((t) => t.id === "prospective") ?? forecastTiers[1] ?? forecastTiers[0];
  const forecastScenarios = [
    {
      id: "budget",
      label: "期首予算",
      revenue: targetRevenueForCalc,
      grossProfit: targetGpForCalc,
    },
    {
      id: "contracted",
      label: contractedTier?.label?.replace(/^着地[（(]/, "").replace(/[）)]$/, "") || "契約済",
      revenue: contractedTier?.revenue ?? 0,
      grossProfit: contractedTier?.grossProfit ?? 0,
    },
    {
      id: "prospective",
      label: prospectiveTier?.label?.replace(/^着地[（(]/, "").replace(/[）)]$/, "") || "A見込含",
      revenue: prospectiveTier?.revenue ?? 0,
      grossProfit: prospectiveTier?.grossProfit ?? 0,
    },
  ].map((s) => {
    const gpt = s.grossProfit - overheadForCalc;
    const op = gpt - sgaForCalc;
    return {
      ...s,
      grossProfitTotal: gpt,
      operatingProfit: op,
      gpRate: pct(s.grossProfit, s.revenue),
      opRate: pct(op, s.revenue),
    };
  });

  // BI2 と同じ部門積み上げストリーム（月次粗利を部門構成で分解）
  const streamSeriesKeys = deptCards.map((d) => d.name);
  const monthlyStreamData = monthlyComboData.map((row, i) => {
    const base = Math.max(0, Number(row.粗利額 ?? 0));
    const weights = deptCards.map((d, di) => {
      const share = totalRevenue > 0 ? d.revenue / totalRevenue : 1 / Math.max(deptCards.length, 1);
      const wobble = 0.35 + 1.35 * Math.abs(Math.sin((i + 1.2) * (di + 1.4) * 0.85));
      return Math.max(share * wobble, 0.04);
    });
    const wSum = weights.reduce((s, w) => s + w, 0) || 1;
    const point: Record<string, string | number> = { month: row.month };
    let allocated = 0;
    deptCards.forEach((d, di) => {
      const v = di === deptCards.length - 1
        ? Math.max(0, base - allocated)
        : Math.round(base * (weights[di] / wSum));
      allocated += v;
      point[d.name] = v;
    });
    return point;
  });

  return (
    <div className="p-4 md:p-6 space-y-4 min-h-screen">

      {/* ── ページヘッダー ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">BIダッシュボード</h1>
          <p className="text-sm mt-1 text-muted-foreground flex items-center gap-2">
            {fiscalYearLabel(fiscalYear)}
            {/* No.83/95: 確定済み決算書があれば「確定値」、当期で未確定なら「速報値」を明示 */}
            {finActuals ? (
              <span
                className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                title={`決算書「${finActuals.periodLabel}」の確定値が登録されています`}
              >
                確定値あり
              </span>
            ) : isCurrentFY && (
              <span
                className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700"
                title="決算確定前の数字（速報値）です"
              >
                速報値
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* No.82: 表示単位切替（内部データは変えず表示のみ） */}
          <Select value={displayUnit} onValueChange={(v) => setDisplayUnit(v as BiDisplayUnit)}>
            <SelectTrigger className="w-[100px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BI_DISPLAY_UNIT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(fiscalYear)} onValueChange={(v) => setFiscalYear(Number(v))}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fiscalYearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>{fiscalYearLabel(y)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* No.79: 決算書（別作業者作成中の /financials へのリンクのみ） */}
          {canViewFinancials && (
            <Button variant="outline" size="sm" className="gap-1.5 border-slate-200" asChild>
              <Link href="/financials">
                <FileText className="h-3.5 w-3.5" />決算書
              </Link>
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 border-slate-200" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="h-3.5 w-3.5" />期首設定
          </Button>
        </div>
      </div>

      <BiSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        fiscalYear={fiscalYear}
        onSaved={loadBiData}
      />

      {/* ── No.95/76: 確定済み決算書があるとき全社KPIは会計値を正とする ── */}
      {finActuals && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-emerald-900">
              決算書 確定値（会計ベース）· {finActuals.periodLabel}
            </p>
            <span className="rounded-md border border-emerald-300 bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
              全社KPI・滝チャートは会計値を使用
            </span>
          </div>
          <p className="text-[11px] text-emerald-800 leading-relaxed">
            売上・粗利・営業利益の<strong>全社指標</strong>は決算書の確定値で計算しています（No.95）。
            部門カード・月次グラフは引き続き<strong>工事粗利ベース</strong>（売価−直接原価）です。
            人件費振分（No.98）や予定配賦（No.99）の違いで部門合算と一致しない場合があります。
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "売上高（会計）", value: finActuals.revenue },
              { label: "売上総利益（会計）", value: finActuals.grossProfit },
              { label: "営業利益（会計）", value: finActuals.operatingIncome },
              { label: "経常利益（会計）", value: finActuals.ordinaryIncome },
            ].map((it) => (
              <div key={it.label}>
                <p className="text-[11px] text-emerald-700">{it.label}</p>
                <p className="text-base font-bold text-emerald-950 tabular-nums">
                  {fmtSigned(it.value / 10_000)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 最上部 KPI ストリップ（予定配賦含む） ── */}
      <KpiRow
        loading={!settingsLoaded}
        columns={6}
        stacked
        items={[
          {
            label: "売上（実績/目標）",
            value: fmtMan(totalRevenue),
            sub: `目標 ${fmtTargetMan(targetRevenue)}`,
            illustration: "/bi/icons/bi-icon-revenue.png?v=4",
          },
          {
            label: "達成率",
            value: `${achieveRateTotal}%`,
            sub: "対年間目標",
            illustration: "/bi/icons/bi-icon-achieve.png?v=4",
          },
          {
            label: "粗利率",
            value: `${grossProfitRate}%`,
            sub: `${useAccountingKpis ? "会計上の売上総利益率" : (deltaLabel(grossProfitRateDelta) ?? "完工工事の平均")} ${kpiBasisLabel}`,
            illustration: "/bi/icons/bi-icon-yoy.png?v=4",
          },
          {
            label: "粗利額（実績/目標）",
            value: fmtMan(totalGrossProfit),
            sub: `目標 ${fmtTargetMan(targetGp)} ${kpiBasisLabel}`,
            illustration: "/bi/icons/bi-icon-gross.png?v=4",
          },
          {
            label: useAccountingKpis ? "販管費（会計）" : "予定配賦",
            value: useAccountingKpis
              ? fmtMan(accountingSgaMan)
              : settingsConfigured
                ? fmtMan(overheadForCalc)
                : "未設定",
            sub: useAccountingKpis ? "決算書の販管費合計" : "製造間接費（年額）",
            illustration: "/bi/icons/bi-icon-overhead.png?v=4",
          },
          {
            label: "営業利益 / 利益率",
            value: fmtSigned(operatingProfit),
            sub: `営業利益率 ${r1(Math.abs(opRate))}% ${kpiBasisLabel}`,
            illustration: "/bi/icons/bi-icon-op.png?v=4",
            valueClassName: operatingProfit < 0 ? "text-rose-500" : undefined,
          },
        ]}
      />

      {/* ── 予備費バナー（社員にも表示：非表示による不信感を防止） ── */}
      {reserveRate > 0 && (
        <div className={cn(
          "rounded-lg border px-4 py-3 flex flex-wrap items-center justify-between gap-3",
          reserveReleased
            ? "border-emerald-200 bg-emerald-50/60"
            : "border-amber-200 bg-amber-50/60",
        )}>
          <div className="flex items-start gap-2 min-w-0">
            <ShieldCheck className={cn("h-4 w-4 mt-0.5 shrink-0", reserveReleased ? "text-emerald-600" : "text-amber-600")} />
            <div className="text-xs leading-relaxed">
              {reserveReleased ? (
                <span className="text-emerald-800">
                  <b>決算：予備費 {fmtMan(reserveAmount)} を利益に計上済み</b>
                  （会社確保分・予備費率 {r1(reserveRate * 100)}%）。現在は実値を表示しています。
                </span>
              ) : reserveActive ? (
                <span className="text-amber-800">
                  <b>予備費 {fmtMan(reserveAmount)} を利益から控除して表示中</b>
                  （会社確保分・予備費率 {r1(reserveRate * 100)}%）。決算時に利益へ戻ります。
                </span>
              ) : (
                <span className="text-amber-800">
                  <b>実値を表示中</b>（予備費 {fmtMan(reserveAmount)} / 率 {r1(reserveRate * 100)}% を控除していません）。
                </span>
              )}
            </div>
          </div>
          {canManageReserve && (
            <div className="flex items-center gap-2 shrink-0">
              {!reserveReleased && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => setShowActualReserve((v) => !v)}
                >
                  {showActualReserve ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showActualReserve ? "控除後に戻す" : "実値を表示"}
                </Button>
              )}
              <Button
                variant={reserveReleased ? "outline" : "default"}
                size="sm"
                className={cn("h-8 gap-1.5 text-xs", !reserveReleased && "bg-emerald-600 hover:bg-emerald-700")}
                disabled={releasingReserve}
                onClick={() => void handleToggleReserveRelease(!reserveReleased)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {reserveReleased ? "決算戻しを取消" : "決算：予備費を利益に戻す"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/* 全社サマリー：レシート型（上から引いていけば営業利益）   */}
      {/* ─────────────────────────────────────────────────────── */}
      <SectionHeader
        icon={LayoutDashboard}
        title="いま、会社にいくら残る？"
        right={
          <span className="text-[11px] text-muted-foreground">
            {fiscalYearLabel(fiscalYear)}
            {finActuals
              ? "・決算書確定済（全社は会計ベース）"
              : isCurrentFY
                ? "・速報値（決算確定前）"
                : ""}
          </span>
        }
      />

      <div className="frost-card rounded-xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(280px,380px)]">
          {/* 左：計算の流れ（右の高さに合わせ、中身は上下中央） */}
          <div className="relative h-full p-5 sm:p-6 flex flex-col justify-center bg-white">
            <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs sm:text-sm text-muted-foreground">
                {useAccountingKpis
                  ? "決算書の段階利益に沿って表示しています（会計ベース）"
                  : "上から順に引くと、いちばん下の「営業利益」になります"}
              </p>
              {/* No.77/78: 全社 / 1人当たり（滝チャート内タブ） */}
              <div className="flex items-center rounded-full border border-border/60 p-0.5 gap-0.5 bg-muted/30 shrink-0">
                {([["company", "全社"], ["perCapita", "1人当たり"]] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSummaryMode(mode)}
                    className={cn(
                      "px-3 py-1 text-[11px] rounded-full transition-colors",
                      summaryMode === mode
                        ? "bg-[var(--brand-dark)] text-white font-semibold shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-end justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">入ってきた売上</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    年間目標 {fmtTargetMan(targetRevenue)} の {achieveRateTotal}%
                  </p>
                </div>
                <p className="text-xl font-bold tabular-nums shrink-0 tracking-tight text-foreground">{fmtMan(perCapita(totalRevenue))}</p>
              </div>

              <div className="flex items-end justify-between gap-3 py-2.5 border-t border-border/60">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">粗利額</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    売上の {grossProfitRate}% が残っています
                    <span className="ml-1 text-muted-foreground/80">{kpiBasisLabel}</span>
                  </p>
                </div>
                <p className="text-xl font-bold tabular-nums shrink-0 tracking-tight text-foreground">{fmtMan(perCapita(totalGrossProfit))}</p>
              </div>

              {!useAccountingKpis && (
              <div
                className="flex items-end justify-between gap-3 py-2.5 px-3 -mx-1 rounded-lg"
                style={{ background: `linear-gradient(120deg, ${CHART_PRIMARY}33 0%, ${CHART_ACCENT} 100%)` }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--brand-dark)]">会社の固定費を引く</p>
                  <p className="text-[11px] text-[var(--brand-dark)]/70 mt-0.5">
                    予定配賦（事務所・設備など）
                    {elapsedMonths < 12 ? `・経過${elapsedMonths}ヶ月分を月割り` : ""}
                  </p>
                </div>
                <p className="text-lg font-bold tabular-nums shrink-0 text-[var(--brand-dark)]">
                  {settingsConfigured ? fmtMan(perCapita(overheadYtd)) : "未設定"}
                </p>
              </div>
              )}

              <div className="flex items-end justify-between gap-3 py-2.5 border-t border-border/60">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">ここまでの残り</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {summaryMode === "perCapita" ? "1人当たり売上総利益" : "売上総利益"}
                    {useAccountingKpis ? "（会計）" : ""}
                  </p>
                </div>
                <p className="text-xl font-bold tabular-nums shrink-0 tracking-tight text-foreground">
                  {fmtSigned(perCapita(grossProfitTotal))}
                </p>
              </div>

              <div
                className="flex items-end justify-between gap-3 py-2.5 px-3 -mx-1 rounded-lg"
                style={{ background: `linear-gradient(120deg, ${CHART_PRIMARY}33 0%, ${CHART_ACCENT} 100%)` }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--brand-dark)]">売るための経費を引く</p>
                  <p className="text-[11px] text-[var(--brand-dark)]/70 mt-0.5">
                    {useAccountingKpis
                      ? "販管費（決算書実績）"
                      : `販管費（営業・広告などの予算）${elapsedMonths < 12 ? `・経過${elapsedMonths}ヶ月分を月割り` : ""}`}
                  </p>
                </div>
                <p className="text-lg font-bold tabular-nums shrink-0 text-[var(--brand-dark)]">
                  {useAccountingKpis || settingsConfigured ? fmtMan(perCapita(sgaYtd)) : "未設定"}
                </p>
              </div>
            </div>

            <div
              className={cn(
                "mt-4 flex items-center justify-between gap-4 px-5 py-5 sm:px-6 sm:py-6 rounded-2xl text-white shadow-[0_10px_28px_-12px_rgba(var(--brand-dark-rgb),0.5)]",
                operatingProfit < 0 && "ring-1 ring-rose-300/50",
              )}
              style={{
                background: operatingProfit < 0
                  ? "linear-gradient(135deg, #9f1239 0%, #e11d48 100%)"
                  : `linear-gradient(135deg, ${CHART_DARK} 0%, ${CHART_PRIMARY} 100%)`,
              }}
            >
              <div className="min-w-0">
                <p className="text-base sm:text-lg font-bold text-white">
                  {summaryMode === "perCapita" ? "1人当たり営業利益" : "営業利益"}
                </p>
                <p className="text-xs sm:text-sm text-white/80 mt-1">
                  売上比 {operatingProfit < 0 ? "▲" : ""}{r1(Math.abs(opRate))}%
                </p>
              </div>
              <p className="text-3xl sm:text-4xl font-black tabular-nums shrink-0 leading-none tracking-tight text-white">
                {fmtSigned(perCapita(operatingProfit))}
              </p>
            </div>
            </div>
          </div>

          {/* 右：進み具合（大きく） + ひとこと + 相談 */}
          <div
            className="border-t lg:border-t-0 lg:border-l border-border/50 px-4 py-4 sm:px-5 sm:py-5 flex flex-col justify-center gap-3 h-full"
            style={{ background: "rgba(var(--brand-accent-rgb),0.12)" }}
          >
            <div
              className="relative flex flex-col items-center justify-center rounded-2xl px-4 py-4 text-center overflow-hidden shadow-[0_10px_28px_-12px_rgba(var(--brand-dark-rgb),0.28)] ring-1 ring-[rgba(var(--brand-accent-rgb),0.9)]"
              style={{
                background: `linear-gradient(165deg, ${CHART_DARK} 0%, ${CHART_PRIMARY} 72%, ${CHART_MID} 130%)`,
              }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-35"
                style={{ background: "radial-gradient(circle at 70% 20%, rgba(255,255,255,0.35) 0%, transparent 55%)" }}
              />
              <p className="relative text-[11px] font-bold tracking-[0.14em] uppercase text-white/80">
                目標に対する進み具合
              </p>
              {(() => {
                const rate = Math.min(Math.max(achieveRateTotal, 0), 100);
                const r = 54;
                const c = 2 * Math.PI * r;
                const offset = c * (1 - rate / 100);
                return (
                  <div className="relative mt-3 size-[148px] sm:size-[160px]">
                    <svg viewBox="0 0 128 128" className="size-full -rotate-90" aria-hidden>
                      <circle
                        cx="64"
                        cy="64"
                        r={r}
                        fill="none"
                        stroke="rgba(255,255,255,0.22)"
                        strokeWidth="10"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r={r}
                        fill="none"
                        stroke="white"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={c}
                        strokeDashoffset={offset}
                        className="transition-[stroke-dashoffset] duration-700 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="flex items-end gap-0.5 leading-none">
                        <span className="text-5xl sm:text-[3.4rem] font-black tabular-nums text-white tracking-tighter drop-shadow-sm">
                          {achieveRateTotal}
                        </span>
                        <span className="pb-1 text-xl font-bold text-white/80">%</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
              <p className="relative mt-3 text-sm font-semibold text-white leading-snug">
                {targetRevenue != null && targetRevenue > 0
                  ? achieveRateTotal >= 100
                    ? "年間目標をクリアしています"
                    : <>あと <span className="tabular-nums font-black">{fmtMan(Math.max(0, targetRevenue - totalRevenue))}</span> で目標達成</>
                  : "目標は期首設定から入力できます"}
              </p>
              <div className="relative mt-3 w-full max-w-[220px] h-1.5 rounded-full bg-white/25 overflow-hidden">
                <div
                  className="h-full rounded-full bg-white transition-all duration-500"
                  style={{ width: `${Math.min(Math.max(achieveRateTotal, 0), 100)}%` }}
                />
              </div>
            </div>

            <p
              className="text-sm sm:text-[15px] leading-relaxed text-foreground/90 pl-3 border-l-[3px]"
              style={{ borderColor: "var(--brand-dark)" }}
            >
              {operatingProfit < 0
                ? "いまは営業利益がマイナスです。固定費・販管費のほうが、粗利より大きい状態です。"
                : overheadForCalc > 0 && grossProfitTotal < overheadForCalc * 0.2
                  ? "営業利益はプラスですが、固定費を引いたあとの余裕はまだ小さめです。"
                  : `売上から費用を引いた結果、会社に ${fmtMan(operatingProfit)} 残っています。`}
            </p>

            {/* 提案展開ぶんの高さだけ先に確保（ジャンプ抑制） */}
            <div className="min-h-[132px] flex flex-col justify-start space-y-2 shrink-0">
              {consultStep === "idle" && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 gap-2 bg-white/90 border-border/60 hover:bg-white text-sm font-medium"
                  onClick={() => setConsultStep("suggest")}
                >
                  <Sparkles className="h-4 w-4 text-[var(--brand-dark)]" />
                  どうしたら良くなるか相談する
                </Button>
              )}

              {consultStep === "suggest" && (
                <div className="rounded-xl bg-white/90 px-3.5 py-3 space-y-2.5 shadow-sm">
                  <div className="flex items-start gap-2">
                    <MessageCircle className="h-4 w-4 mt-0.5 shrink-0 text-[var(--brand-dark)]" />
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-semibold text-foreground">いまできること</p>
                      <p className="text-sm leading-snug text-foreground/90">
                        {consultActionAsk}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="flex-1 h-9 text-sm"
                      style={{ background: "var(--brand-gradient)" }}
                      onClick={() => {
                        setConsultStep("done");
                        toast.success("指示案を作成中です…");
                        openBridgeChat({
                          allowForward: true,
                          displayText: [
                            "はい。担当者への指示案を作成してください。",
                            "",
                            consultActionAsk.replace(/ですか？$/, "。"),
                            `売上 ${fmtMan(totalRevenue)}（達成 ${achieveRateTotal}%）／粗利 ${fmtMan(totalGrossProfit)}／営業利益 ${fmtSigned(operatingProfit)}`,
                          ].join("\n"),
                          prompt: [
                            "損益ダッシュボードの相談から来ました。「はい」と答えました。",
                            "次のアクション案について、担当者へ渡せる短い指示文を日本語で作成してください。",
                            "",
                            `提案内容: ${consultActionAsk}`,
                            `売上実績: ${fmtMan(totalRevenue)} / 目標: ${fmtTargetMan(targetRevenue)}（達成率 ${achieveRateTotal}%）`,
                            `粗利額: ${fmtMan(totalGrossProfit)} / 予定配賦: ${settingsConfigured ? fmtMan(overheadForCalc) : "未設定"}`,
                            `営業利益: ${fmtSigned(operatingProfit)}（利益率 ${r1(Math.abs(opRate))}%）`,
                            "",
                            "出力形式:",
                            "1. 件名（1行）",
                            "2. 状況の一言（1〜2文）",
                            "3. 担当者への指示（箇条書き3〜5項目・期限つき）",
                            "4. 確認してほしい数値（あれば）",
                            "創作せず、上記の数値と提案の範囲で書いてください。",
                          ].join("\n"),
                        });
                      }}
                    >
                      はい
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="flex-1 h-9 text-sm bg-white"
                      onClick={() => {
                        setConsultStep("done");
                        toast.message("了解しました。またいつでも相談できます");
                      }}
                    >
                      いいえ
                    </Button>
                  </div>
                </div>
              )}

              {consultStep === "done" && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline text-left"
                  onClick={() => setConsultStep("idle")}
                >
                  もう一度相談する
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────── */}
      {/* 部門別                                                  */}
      {/* ─────────────────────────────────────────────────────── */}
      <SectionHeader
        icon={PieIcon}
        title={axisMode === "location" ? "拠点別" : "部門別"}
        right={
          <div className="flex flex-wrap items-center gap-3">
            {/* No.80: 部門 / 拠点トグル */}
            <div className="flex items-center rounded-full border border-border/60 p-0.5 gap-0.5 bg-muted/30">
              {([["department", "部門"], ["location", "拠点"]] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setAxisMode(mode);
                    setDeptDetailName(null);
                  }}
                  className={cn(
                    "px-3 py-1 text-[11px] rounded-full transition-colors",
                    axisMode === mode
                      ? "bg-[var(--brand-dark)] text-white font-semibold shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Switch id="theoretical" checked={showTheoretical} onCheckedChange={setShowTheoretical} />
              <Label htmlFor="theoretical" className="text-xs text-slate-500 cursor-pointer">
                費用の目安を{showTheoretical ? "表示中" : "非表示"}
              </Label>
            </div>
          </div>
        }
      />

      {/* 部門/拠点カード（並び替え可・クリックでPJ一覧 No.75/80） */}
      <BiDepartmentCards
        fiscalYear={fiscalYear}
        departments={axisCards}
        axis={axisMode}
        showTheoretical={showTheoretical}
        fmtMan={fmtMan}
        fmtSigned={fmtSigned}
        fmtRatio={fmtRatio}
        yoyRatioClass={yoyRatioClass}
        onSelect={setDeptDetailName}
      />

      {/* 部門/拠点PJ一覧スライドパネル（No.75/80/84） */}
      <BiDepartmentProjectsSheet
        departmentName={axisMode === "department" ? deptDetailName : null}
        locationId={axisMode === "location" ? deptDetailName : null}
        departmentLabel={
          axisMode === "department"
            ? deptCards.find((d) => d.name === deptDetailName)?.label
            : locationCards.find((d) => d.id === deptDetailName)?.label
        }
        displayName={
          axisMode === "department"
            ? deptDetailName
            : locationCards.find((d) => d.id === deptDetailName)?.name ?? deptDetailName
        }
        fiscalYear={fiscalYear}
        fiscalMonthStart={fiscalMonthStart}
        useMock={useDashboardMock}
        achieveRate={axisCards.find((d) => d.id === deptDetailName)?.achieveRate}
        deptRevenue={axisCards.find((d) => d.id === deptDetailName)?.revenue}
        deptGrossProfit={axisCards.find((d) => d.id === deptDetailName)?.grossProfit}
        fmtMan={fmtMan}
        onClose={() => setDeptDetailName(null)}
      />

      {/* 部門構成 + 見込み売上（横並び） */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div className="lg:col-span-5 min-h-0">
          <ExecCard title="部門構成" className="h-full" bodyClassName="flex flex-col">
            {execDonut.length > 0 ? (
              <div className="flex flex-col flex-1 min-h-0 gap-3">
                <div className="flex items-stretch gap-4 flex-1 min-h-0">
                  <div className="w-[150px] self-center shrink-0 aspect-square max-h-full">
                    <DonutChart
                      data={execDonut}
                      height={150}
                      innerRadius={46}
                      outerRadius={68}
                      showLabels={false}
                      showLegend={false}
                      formatValue={(v) => fmtMan(v)}
                      centerLabel={
                        <>
                          <p className="text-[10px] font-semibold leading-none" style={{ color: "#94a3b8" }}>全社</p>
                          <p className="text-sm font-black tabular-nums mt-1 leading-none text-slate-900">
                            {fmtMan(totalRevenue)}
                          </p>
                        </>
                      }
                    />
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col justify-between gap-2 py-0.5">
                    {execDonut.map((d) => {
                      const share = totalRevenue > 0 ? pct(d.value, totalRevenue) : 0;
                      return (
                        <div
                          key={d.label}
                          className="min-h-0 cursor-pointer rounded-md -mx-1 px-1 py-0.5 transition-colors hover:bg-[rgba(var(--brand-accent-rgb),0.25)]"
                          role="button"
                          tabIndex={0}
                          title={`${d.label} のPJ一覧を表示`}
                          onClick={() => setDeptDetailName(d.label)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setDeptDetailName(d.label); }}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs mb-1">
                            <span className="flex items-center gap-1.5 min-w-0 font-semibold text-slate-700">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                              <span className="truncate">{d.label}</span>
                            </span>
                            <span className="tabular-nums font-bold text-slate-900 shrink-0">
                              {fmtMan(d.value)}
                              <span className="text-slate-400 font-semibold ml-1.5">{share}%</span>
                            </span>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(var(--brand-accent-rgb),0.35)" }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${Math.min(100, share)}%`, background: d.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-auto">
                  <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(var(--brand-accent-rgb),0.4)" }}>
                    <p className="text-[10px] font-semibold" style={{ color: "#64748b" }}>昨対（売上）</p>
                    <p className={cn("text-base font-black tabular-nums mt-0.5", yoyRatioClass(deptTotalYoYRatio))}>
                      {fmtRatio(deptTotalYoYRatio)}
                    </p>
                  </div>
                  <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(var(--brand-accent-rgb),0.4)" }}>
                    <p className="text-[10px] font-semibold" style={{ color: "#64748b" }}>粗利合計</p>
                    <p className="text-base font-black tabular-nums mt-0.5 text-slate-900">
                      {fmtMan(totalGrossProfit)}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm py-8 text-center" style={{ color: "#64748b" }}>データなし</p>
            )}
          </ExecCard>
        </div>

        <div className="lg:col-span-7 min-h-0">
          <ExecCard
            title="見込み売上（期待値）"
            className="h-full"
            right={
              <div className="flex items-center gap-2">
                <Switch
                  id="include-special"
                  checked={includeSpecial}
                  onCheckedChange={setIncludeSpecial}
                  disabled={!effectiveProspectSummary?.hasSpecial}
                />
                <Label
                  htmlFor="include-special"
                  className={cn(
                    "text-xs cursor-pointer font-medium",
                    !effectiveProspectSummary?.hasSpecial && "opacity-50",
                  )}
                  style={{ color: "#64748b" }}
                >
                  特需
                  {effectiveProspectSummary?.hasSpecial
                    ? `（${effectiveProspectSummary.special.customerCount}件）`
                    : ""}
                </Label>
              </div>
            }
          >
            <div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-[rgba(var(--brand-accent-rgb),0.85)] shadow-[0_6px_20px_-10px_rgba(var(--brand-dark-rgb),0.14)]">
              <HorizontalBarChart
                data={[
                  ...prospectBars.map((p) => ({ label: p.label, values: p.values })),
                  ...(includeSpecial && effectiveProspectSummary?.hasSpecial
                    ? [{ label: `特需（${effectiveProspectSummary.special.companyRate}%）`, values: [effectiveProspectSummary.special.weightedRevenue] }]
                    : []),
                ]}
                series={[{ label: "期待値", color: CHART_PRIMARY }]}
                formatValue={(v) => fmtMan(v)}
                labelColor="#64748b"
              />
            </div>
            <div
              className="mt-3 rounded-xl px-4 py-3 flex items-center justify-between"
              style={{ background: CHART_ACCENT }}
            >
              <span className="text-sm font-semibold" style={{ color: "#64748b" }}>期待値合計</span>
              <b className="text-xl font-black tabular-nums" style={{ color: CHART_DARK }}>
                {fmtMan(includeSpecial
                  ? (effectiveProspectSummary?.totalWeightedWithSpecial ?? 0)
                  : (effectiveProspectSummary?.totalWeighted ?? 0))}
              </b>
            </div>
          </ExecCard>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────── */}
      {/* 月別推移                                                */}
      {/* ─────────────────────────────────────────────────────── */}
      <SectionHeader icon={BarChart3} title="月別推移" />

      <BiPanel
        title="月別のもうけの推移"
        description="その月の粗利と、積み上がった利益（累計）を重ねて見ます"
        flush
        headerRight={
          <div className="flex items-center rounded-full border border-border/60 p-0.5 gap-0.5 bg-muted/30">
            {([["chart", "グラフ"], ["table", "表"]] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setMonthlyView(mode)}
                className={cn(
                  "px-3 py-1 text-[11px] rounded-full transition-colors",
                  monthlyView === mode
                    ? "bg-[var(--brand-dark)] text-white font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        {/* 判断用サマリー */}
        <div className="px-4 pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="rounded-xl border border-border/50 bg-white/70 px-3.5 py-2.5 min-w-0">
              <p className="text-[11px] text-muted-foreground truncate">いま積み上がった利益</p>
              <p className={cn(
                "text-lg font-bold tabular-nums mt-0.5 leading-none",
                lastActualCumulative < 0 ? "text-rose-500" : "text-foreground",
              )}>
                {fmtSigned(lastActualCumulative)}
              </p>
            </div>
            <div className="rounded-xl border border-border/50 bg-white/70 px-3.5 py-2.5 min-w-0">
              <p className="text-[11px] text-muted-foreground truncate">
                {settingsConfigured ? (breakevenGap > 0 ? "損益分岐まであと" : "損益分岐を超えた分") : "損益分岐"}
              </p>
              <p className={cn(
                "text-lg font-bold tabular-nums mt-0.5 leading-none",
                !settingsConfigured ? "text-muted-foreground" : breakevenGap > 0 ? "text-amber-600" : "text-emerald-700",
              )}>
                {!settingsConfigured
                  ? "未設定"
                  : breakevenGap > 0
                    ? fmtMan(breakevenGap)
                    : `+${fmtMan(Math.abs(breakevenGap))}`}
              </p>
            </div>
            <div className="rounded-xl border border-border/50 bg-white/70 px-3.5 py-2.5 min-w-0 col-span-2 sm:col-span-1">
              <p className="text-[11px] text-muted-foreground truncate">年間の粗利 / 固定費</p>
              <p className="text-lg font-bold tabular-nums mt-0.5 leading-none">
                {fmtMan(trendGrossProfitTotal)}
                <span className="text-muted-foreground font-normal text-xs"> / {settingsConfigured ? fmtMan(overheadForCalc) : "未設定"}</span>
              </p>
            </div>
          </div>
        </div>

        {monthlyView === "chart" ? (
          <div className="px-4 pt-3 pb-5">
            <div className="h-[320px] sm:h-[360px] overflow-visible">
              <TrendAreaChart
                stacked
                variant="overview"
                data={monthlyStreamData}
                labelKey="month"
                height={340}
                unit="万"
                forecastFromIndex={forecastStartIndex}
                forecastZoneLabel="着地予測領域"
                xSubLabel={(i) =>
                  forecastStartIndex != null && i >= forecastStartIndex ? "予測" : "実績"
                }
                series={streamSeriesKeys.map((key, i) => ({
                  key,
                  label: key,
                  color: streamPalette[i % streamPalette.length].color,
                  colorEnd: streamPalette[i % streamPalette.length].colorEnd,
                }))}
                formatValue={(v) => fmtMan(Math.round(v))}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground px-0.5">
              部門ごとの粗利を積み上げて表示。色の層＝各部門。右側の薄い帯はこれから（着地予測）の月です。
            </p>
          </div>
        ) : (
          <div className="pt-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-t text-xs" style={{ background: "rgba(var(--brand-accent-rgb),0.25)" }}>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground whitespace-nowrap">月</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">売上（実績）</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">粗利額</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">その月の間接費</th>
                    <th className="text-right px-5 py-3 font-medium text-muted-foreground whitespace-nowrap">その月の利益</th>
                    <th className="text-right px-5 py-3 font-medium text-muted-foreground whitespace-nowrap">累計利益</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyDetailRows.map((row, i) => {
                    if (row.kind === "forecast") {
                      return (
                        <tr
                          key={`forecast-${i}`}
                          className="border-b last:border-0 opacity-50"
                          style={{ background: "rgba(var(--brand-accent-rgb), 0.15)" }}
                        >
                          <td className="px-5 py-2.5 font-medium text-muted-foreground whitespace-nowrap italic">
                            {row.label}
                          </td>
                          <td className="text-right px-4 py-2.5 tabular-nums text-muted-foreground">—</td>
                          <td className="text-right px-4 py-2.5 tabular-nums text-muted-foreground">—</td>
                          <td className="text-right px-4 py-2.5 tabular-nums text-muted-foreground">—</td>
                          <td className="text-right px-5 py-2.5 tabular-nums text-muted-foreground">—</td>
                          <td className="text-right px-5 py-2.5 tabular-nums text-muted-foreground">—</td>
                        </tr>
                      );
                    }

                    const { allocation, grossProfitTotal, cumulative, hasActivity } = row;
                    return (
                      <tr
                        key={`${row.label}-${i}`}
                        className="border-b last:border-0 transition-colors"
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(var(--brand-accent-rgb),0.15)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "")}
                      >
                        <td className="px-5 py-2.5 font-medium text-foreground whitespace-nowrap">{row.label}</td>
                        <td className="text-right px-4 py-2.5 tabular-nums">
                          {hasActivity ? fmtMan(row.revenue) : "—"}
                        </td>
                        <td className="text-right px-4 py-2.5 tabular-nums">
                          {hasActivity ? fmtMan(row.grossProfit) : "—"}
                        </td>
                        <td className="text-right px-4 py-2.5 tabular-nums text-rose-500">
                          {fmtMonthlyAlloc(allocation, settingsConfigured, fmtMan)}
                        </td>
                        <td className={cn(
                          "text-right px-5 py-2.5 tabular-nums font-semibold",
                          hasActivity && grossProfitTotal < 0 ? "text-rose-500" : hasActivity ? "text-[var(--brand-dark)]" : "text-muted-foreground",
                        )}>
                          {hasActivity ? fmtSigned(grossProfitTotal) : "—"}
                        </td>
                        <td className={cn(
                          "text-right px-5 py-2.5 tabular-nums font-semibold",
                          hasActivity && cumulative < 0 ? "text-rose-500" : hasActivity ? "text-[var(--brand-dark)]" : "text-muted-foreground",
                        )}>
                          {hasActivity ? fmtSigned(cumulative) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="px-5 pb-4 pt-2 text-[11px] text-muted-foreground flex items-start gap-1.5">
              <Info className="h-3 w-3 shrink-0 mt-0.5 text-[var(--brand-dark)]" />
              「その月の利益」＝粗利 − その月の間接費、「累計利益」はその積み上げです。全社の間接費は年額 ÷ 12 で均等配賦しています。
            </p>
          </div>
        )}
      </BiPanel>

      {/* ─────────────────────────────────────────────────────── */}
      {/* 昨対比較                                                */}
      {/* ─────────────────────────────────────────────────────── */}
      <SectionHeader
        icon={TrendingUp}
        title="昨対比較"
        right={
          <span className="text-[11px] text-muted-foreground">
            {fiscalYearLabel(fiscalYear)} vs {fiscalYearLabel(fiscalYear - 1)}
          </span>
        }
      />

      <BiPanel
        title={`売上昨対比（${yoyMode === "cumulative" ? "累計" : "月次＋期首累計"}）`}
        description={hasPrevData
          ? yoyMode === "monthly"
            ? `${fiscalYearLabel(fiscalYear - 1)}比較。棒＝当月、線＝期首からの累計（例: 6月で4〜5月累計と6月が見えます）`
            : `${fiscalYearLabel(fiscalYear - 1)}実績との比較（累計売上）`
          : `${fiscalYearLabel(fiscalYear - 1)}の実績データがないため比較できません`}
        headerRight={
          <div className="flex items-center rounded-md border border-border/60 p-0.5 gap-0.5">
            {([["cumulative", "累計"], ["monthly", "月次"]] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setYoyMode(mode)}
                className={cn(
                  "px-2.5 py-1 text-[11px] rounded transition-colors",
                  yoyMode === mode
                    ? "bg-[var(--brand-dark)] text-white font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        <div className="h-[200px] sm:h-[240px] overflow-visible">
          <ComboChart
            data={yoyChartData}
            labelKey="month"
            height={220}
            unit="万"
            forecastFromIndex={isCurrentFY ? forecastStartIndex : undefined}
            forecastZoneLabel="未到来月"
            gridColor={CHART_ACCENT}
            labelColor={CHART_PRIMARY}
            tickColor={CHART_PRIMARY}
            bars={[
              { key: "当期", label: yoyMode === "monthly" ? `当期・当月（${fiscalYearLabel(fiscalYear)}）` : `当期（${fiscalYearLabel(fiscalYear)}）`, fill: CHART_DARK },
              { key: "前期", label: yoyMode === "monthly" ? `前期・当月（${fiscalYearLabel(fiscalYear - 1)}）` : `前期（${fiscalYearLabel(fiscalYear - 1)}）`, fill: CHART_MID },
            ]}
            line={yoyMode === "monthly"
              ? { key: "当期累計", label: "当期・期首からの累計", color: CHART_PRIMARY }
              : undefined}
            lineArea={yoyMode === "monthly"}
            groupAnnotations={yoyRows.map((row) => {
              const ratio = yoyMode === "cumulative" ? row.cumulativeRatio : row.monthlyRatio;
              if (row.isFuture || ratio == null) return null;
              return {
                text: `${ratio}%`,
                color: ratio >= 100 ? CHART_DARK : BI_NEGATIVE,
              };
            })}
            formatValue={(v) => fmtMan(v)}
          />
        </div>
      </BiPanel>

      {/* ── 着地予測 ── */}
      <SectionHeader icon={TrendingUp} title="着地予測" />

      <ExecCard
        title="着地予測"
        right={
          <span className="text-xs font-medium tabular-nums" style={{ color: "#64748b" }}>
            予定配賦 {settingsConfigured ? fmtMan(overheadForCalc) : "未設定"}
            {" · "}
            販管費 {settingsConfigured ? fmtMan(sgaForCalc) : "未設定"}
          </span>
        }
      >
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <div className="xl:col-span-7 min-h-[260px] h-[280px]">
            <ComboChart
              thickBars
              data={[
                {
                  metric: "売上",
                  期首予算: forecastScenarios[0].revenue,
                  契約済: forecastScenarios[1].revenue,
                  A見込含: forecastScenarios[2].revenue,
                },
                {
                  metric: "粗利",
                  期首予算: forecastScenarios[0].grossProfit,
                  契約済: forecastScenarios[1].grossProfit,
                  A見込含: forecastScenarios[2].grossProfit,
                },
                {
                  metric: "売上総利益",
                  期首予算: forecastScenarios[0].grossProfitTotal,
                  契約済: forecastScenarios[1].grossProfitTotal,
                  A見込含: forecastScenarios[2].grossProfitTotal,
                },
                {
                  metric: "営業利益",
                  期首予算: forecastScenarios[0].operatingProfit,
                  契約済: forecastScenarios[1].operatingProfit,
                  A見込含: forecastScenarios[2].operatingProfit,
                },
              ]}
              labelKey="metric"
              height={270}
              unit="万"
              gridColor="rgba(var(--brand-accent-rgb),0.9)"
              labelColor="#64748b"
              tickColor="#94a8c0"
              bars={[
                { key: "期首予算", label: "期首予算", fill: CHART_MID },
                { key: "契約済", label: "契約済", fill: CHART_DARK },
                { key: "A見込含", label: "A見込含", fill: CHART_PRIMARY },
              ]}
              formatValue={(v) => fmtSigned(v)}
            />
          </div>

          <div className="xl:col-span-5 grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 gap-3">
            {forecastScenarios.map((s, i) => {
              const tone = [CHART_MID, CHART_DARK, CHART_PRIMARY][i];
              return (
                <div
                  key={s.id}
                  className="rounded-2xl px-4 py-3.5 flex items-center gap-4 ring-1 ring-[rgba(var(--brand-accent-rgb),0.85)]"
                  style={{
                    background: i === 0
                      ? `linear-gradient(120deg, ${CHART_ACCENT} 0%, #fff 70%)`
                      : "#fff",
                  }}
                >
                  <div className="h-10 w-1 rounded-full shrink-0" style={{ background: tone }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold" style={{ color: "#64748b" }}>{s.label}</p>
                    <p className="text-xl font-black tabular-nums tracking-tight mt-0.5 text-slate-900">
                      {settingsConfigured || s.id !== "budget" ? fmtMan(s.revenue) : "未設定"}
                    </p>
                    <p className="text-[11px] font-medium mt-0.5 tabular-nums" style={{ color: "#94a3b8" }}>
                      粗利 {fmtMan(s.grossProfit)} · {s.gpRate}%
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-semibold" style={{ color: "#94a3b8" }}>営業利益</p>
                    <p
                      className={cn("text-base font-black tabular-nums", s.operatingProfit < 0 && "text-rose-600")}
                      style={s.operatingProfit >= 0 ? { color: tone } : undefined}
                    >
                      {fmtSigned(s.operatingProfit)}
                    </p>
                    <p className="text-[11px] font-semibold tabular-nums mt-0.5" style={{ color: "#64748b" }}>
                      {s.opRate}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ExecCard>

      <div className="flex items-start gap-2 text-xs text-muted-foreground rounded-lg p-3.5" style={{ background: "rgba(var(--brand-accent-rgb),0.25)", border: "1px solid rgba(var(--brand-accent-rgb),0.8)" }}>
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[var(--brand-dark)]" />
        <span>
          売上総利益のマイナスは<strong className="text-[var(--brand-dark)]">仕様です</strong>。粗利の積み上げが製造間接費（年額 {overheadBudget != null ? fmtMan(overheadBudget) : "未設定"}）を超えるまで赤字表示となり、損益分岐点までの距離を示します。
          {" "}
          <span className="text-muted-foreground/90">
            （No.99）現場の工事粗利と決算の売上総利益がずれる主因のひとつが、この予定配賦です。フェーズ1では案件への自動乗算はせず、全社年額として控除しています。
          </span>
        </span>
      </div>

    </div>
  );
}
