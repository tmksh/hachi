"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LayoutDashboard,
  PieChart as PieIcon,
  Info,
  Settings2,
  TrendingUp,
  BarChart3,
  ArrowUpRight,
  Briefcase,
  Target,
  ChevronRight,
  ShieldCheck,
  Eye,
  EyeOff,
  RotateCcw,
} from "lucide-react";
import { ComboChart } from "@/components/charts/combo-chart";
import { TrendAreaChart } from "@/components/charts/trend-area-chart";
import { getBiSettings, getBiActuals, getBiProspectSummary, releaseReserve, type BiProspectSummary } from "@/lib/actions/bi";
import { useAuth } from "@/components/providers/auth-provider";
import { useCompanyPermissions } from "@/hooks/use-company-permissions";
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
  buildBiDashboardMonthlyCombo,
} from "@/lib/bi-mock-data";
import { BiSettingsDialog } from "@/components/bi/bi-settings-dialog";
import { BiDepartmentCards } from "@/components/bi/bi-department-cards";
import { KpiRow } from "@/components/shared/kpi-row";
import { cn } from "@/lib/utils";
import { useBrandColor } from "@/hooks/use-brand-color";
import { computeBrandFromHex } from "@/lib/brand-color";

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
function fmtMan(v: number) { return `¥${Math.abs(v).toLocaleString()}万`; }
function fmtSigned(v: number) { return v < 0 ? `▲${fmtMan(v)}` : fmtMan(v); }
function fmtTargetMan(v: number | null | undefined) {
  if (v == null) return "未設定";
  return fmtMan(v);
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

function fmtMonthlyAlloc(allocation: number, settingsConfigured: boolean) {
  if (!settingsConfigured || allocation <= 0) return "—";
  return `▲¥${allocation.toLocaleString()}万`;
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

// ────────────────────────────────────────────────────────────────────
// メイン
// ────────────────────────────────────────────────────────────────────
export function BiClient({
  initialSettings,
  initialActuals,
}: {
  initialSettings: BiAnnualSettings | null;
  initialActuals: BiActuals | null;
}) {
  const searchParams = useSearchParams();
  const { role } = useAuth();
  const { canAccess } = useCompanyPermissions();
  // 予備費の実値確認・決算戻しの操作可否は権限マトリクス（reserve_fee）で制御
  const canManageReserve = role ? canAccess("reserve_fee", [role]) : false;
  const [showTheoretical, setShowTheoretical] = useState(false);
  const [showActualReserve, setShowActualReserve] = useState(false);
  const [releasingReserve, setReleasingReserve] = useState(false);
  const [settings, setSettings] = useState<BiAnnualSettings | null>(initialSettings);
  const [actuals, setActuals] = useState<BiActuals | null>(initialActuals);
  const [prevActuals, setPrevActuals] = useState<BiActuals | null>(null);
  const [prospectSummary, setProspectSummary] = useState<BiProspectSummary | null>(null);
  const [yoyMode, setYoyMode] = useState<"cumulative" | "monthly">("cumulative");
  const [monthlyView, setMonthlyView] = useState<"chart" | "table">("chart");
  const [includeSpecial, setIncludeSpecial] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fiscalYear, setFiscalYear] = useState(getCurrentFiscalYear());
  const fiscalYearOptions = listFiscalYears(5);

  const { hex: brandHex } = useBrandColor();
  const brand = computeBrandFromHex(brandHex);
  const CHART_PRIMARY = brandHex;
  const CHART_DARK    = brand.dark;
  const CHART_MID     = brand.mid;
  const CHART_ACCENT  = brand.accent;
  const DEPT_CHART_COLORS = [brand.dark, brandHex, brand.mid, brand.accent];

  useEffect(() => {
    if (searchParams.get("settings") === "1") {
      setSettingsOpen(true);
      window.history.replaceState(null, "", "/bi");
    }
  }, [searchParams]);

  const loadBiData = useCallback((silent = false, includePrevYear = true) => {
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
        if (p !== undefined) setPrevActuals(p);
        setProspectSummary(ps);
      })
      .finally(() => setSettingsLoaded(true));
  }, [fiscalYear]);

  // 初回マウントは SSR の初期データを使い、不足分（前年実績・見込みサマリ）のみ取得。
  // 年度変更時はローディング表示付きで全体を再取得。
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      Promise.all([getBiActuals(fiscalYear - 1), getBiProspectSummary()])
        .then(([p, ps]) => { setPrevActuals(p); setProspectSummary(ps); });
      return;
    }
    loadBiData(false);
  }, [fiscalYear, loadBiData]);

  // 案件データ更新を反映（フォーカス復帰 + 2分ポーリング）。スケルトンを出さず静かに更新
  useEffect(() => {
    const onFocus = () => loadBiData(true, false);
    window.addEventListener("focus", onFocus);
    const interval = setInterval(() => { if (document.visibilityState === "visible") loadBiData(true, false); }, 120000);
    return () => { window.removeEventListener("focus", onFocus); clearInterval(interval); };
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
  const effectiveProspectSummary  = dashboardMock?.prospectSummary ?? prospectSummary;

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

  const totalRevenue          = deptActuals.reduce((s, d) => s + d.revenue, 0);
  const totalGrossProfitActual = deptActuals.reduce((s, d) => s + d.grossProfit, 0);

  // ── 予備費（非表示%）──────────────────────────────────────────────
  // 会社指定の予備費率で売上から控除額を算出。通常時は利益から控除して保守表示し、
  // 決算で戻す（reserve_released=true）と実値に戻る。管理者は実値トグルで一時的に確認可。
  const reserveRate     = effectiveSettings?.reserve_fee_rate ?? 0;
  const reserveReleased = effectiveSettings?.reserve_released ?? false;
  const reserveAmount   = Math.round(totalRevenue * reserveRate);
  // 控除中か（率>0 かつ 未決算 かつ 実値トグルOFF）
  const reserveActive   = reserveRate > 0 && !reserveReleased && !showActualReserve;
  const totalGrossProfit = totalGrossProfitActual - (reserveActive ? reserveAmount : 0);

  const grossProfitRate  = pct(totalGrossProfit, totalRevenue);
  const achieveRateTotal = pct(totalRevenue, targetRevenueForCalc);
  const grossProfitTotal = totalGrossProfit - overheadForCalc;
  const gptRate          = pct(grossProfitTotal, totalRevenue);
  const operatingProfit  = grossProfitTotal - sgaForCalc;
  const opRate           = pct(operatingProfit, totalRevenue);

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

  const curAnnualRevenue = yoyRows.length > 0 ? yoyRows[yoyActualEndIdx - 1]?.currentCum ?? 0 : 0;
  const prevAnnualRevenue = prevMonthly.reduce((s, m) => s + m.revenue, 0);
  const annualYoYRatio = prevAnnualRevenue > 0 ? r1((curAnnualRevenue / prevAnnualRevenue) * 100) : null;

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

  return (
    <div className="p-4 md:p-6 space-y-4 min-h-screen">

      {/* ── ページヘッダー ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">BIダッシュボード</h1>
          <p className="text-sm mt-1 text-muted-foreground">{fiscalYearLabel(fiscalYear)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

      {/* ── 最上部 KPI ストリップ（5列・円アイコン） ── */}
      <KpiRow
        loading={!settingsLoaded}
        columns={5}
        stacked
        items={[
          {
            label: "売上（実績/目標）",
            value: fmtMan(totalRevenue),
            sub: `目標 ${fmtTargetMan(targetRevenue)}`,
            icon: TrendingUp,
          },
          {
            label: "達成率",
            value: `${achieveRateTotal}%`,
            sub: "対年間目標",
            icon: Target,
          },
          {
            label: "粗利率",
            value: `${grossProfitRate}%`,
            sub: deltaLabel(grossProfitRateDelta) ?? "完工工事の平均",
            icon: BarChart3,
          },
          {
            label: "粗利額",
            value: fmtMan(totalGrossProfit),
            sub: "部門粗利の合計",
            icon: ArrowUpRight,
          },
          {
            label: "営業利益 / 利益率",
            value: fmtSigned(operatingProfit),
            sub: `営業利益率 ${r1(Math.abs(opRate))}%`,
            icon: Briefcase,
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
      {/* 全社サマリー：レシート型（上から引いていけば最終もうけ） */}
      {/* ─────────────────────────────────────────────────────── */}
      <SectionHeader
        icon={LayoutDashboard}
        title="いま、会社にいくら残る？"
        right={
          <span className="text-[11px] text-muted-foreground">
            {fiscalYearLabel(fiscalYear)}
          </span>
        }
      />

      <div className="frost-card rounded-xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(280px,360px)]">
          {/* 左：計算の流れ（レシート） */}
          <div className="p-4 sm:p-5 space-y-0">
            <p className="text-xs text-muted-foreground mb-3">
              上から順に引いていくと、いちばん下の「最終のもうけ」になります
            </p>

            {/* 売上 */}
            <div className="flex items-end justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">入ってきた売上</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  年間目標 {fmtTargetMan(targetRevenue)} の {achieveRateTotal}%
                </p>
              </div>
              <p className="text-lg font-bold tabular-nums shrink-0">{fmtMan(totalRevenue)}</p>
            </div>

            {/* 粗利 */}
            <div className="flex items-end justify-between gap-3 py-2.5 border-t border-dashed border-border/70">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">そのうちのもうけ（粗利）</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  売上の {grossProfitRate}% が残っています
                </p>
              </div>
              <p className="text-lg font-bold tabular-nums shrink-0">{fmtMan(totalGrossProfit)}</p>
            </div>

            {/* マイナス：固定費 */}
            <div className="flex items-end justify-between gap-3 py-2.5 rounded-lg px-2.5 -mx-0.5 bg-rose-50/70">
              <div className="min-w-0">
                <p className="text-sm font-medium text-rose-800">会社の固定費を引く</p>
                <p className="text-[11px] text-rose-700/80 mt-0.5">
                  製造間接費（事務所・設備など）
                </p>
              </div>
              <p className="text-lg font-bold tabular-nums shrink-0 text-rose-600">
                {settingsConfigured ? `−${fmtMan(overheadForCalc)}` : "未設定"}
              </p>
            </div>

            {/* 小計 */}
            <div className="flex items-end justify-between gap-3 py-2.5 border-t border-border">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">ここまでの残り</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">売上総利益</p>
              </div>
              <p className={cn(
                "text-lg font-bold tabular-nums shrink-0",
                grossProfitTotal < 0 ? "text-rose-600" : "text-foreground",
              )}>
                {fmtSigned(grossProfitTotal)}
              </p>
            </div>

            {/* マイナス：販管費 */}
            <div className="flex items-end justify-between gap-3 py-2.5 rounded-lg px-2.5 -mx-0.5 bg-rose-50/70">
              <div className="min-w-0">
                <p className="text-sm font-medium text-rose-800">売るための経費を引く</p>
                <p className="text-[11px] text-rose-700/80 mt-0.5">
                  販管費（営業・広告などの予算）
                </p>
              </div>
              <p className="text-lg font-bold tabular-nums shrink-0 text-rose-600">
                {settingsConfigured ? `−${fmtMan(sgaForCalc)}` : "未設定"}
              </p>
            </div>

            {/* 最終 */}
            <div
              className="flex items-center justify-between gap-3 mt-2 px-3.5 py-3.5 rounded-xl border"
              style={{
                background: operatingProfit < 0
                  ? "rgba(225, 29, 72, 0.06)"
                  : "rgba(var(--brand-accent-rgb),0.35)",
                borderColor: operatingProfit < 0
                  ? "rgba(225, 29, 72, 0.25)"
                  : "rgba(var(--brand-accent-rgb),0.9)",
              }}
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">最終のもうけ</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  営業利益 · 売上に対して {operatingProfit < 0 ? "▲" : ""}{r1(Math.abs(opRate))}%
                </p>
              </div>
              <p className={cn(
                "text-2xl sm:text-3xl font-bold tabular-nums shrink-0 leading-none",
                operatingProfit < 0 ? "text-rose-600" : "text-[var(--brand-dark)]",
              )}>
                {fmtSigned(operatingProfit)}
              </p>
            </div>
          </div>

          {/* 右：ひとこと判定 */}
          <div
            className="border-t lg:border-t-0 lg:border-l border-border/60 p-4 sm:p-5 flex flex-col justify-center gap-4"
            style={{ background: "rgba(var(--brand-accent-rgb),0.10)" }}
          >
            <div>
              <p className="text-xs text-muted-foreground">目標に対する進み具合</p>
              <p className="text-3xl font-bold tabular-nums mt-1 text-[var(--brand-dark)]">
                {achieveRateTotal}%
              </p>
              <div className="mt-2.5 h-2.5 w-full rounded-full bg-white/80 overflow-hidden border border-border/40">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(achieveRateTotal, 100)}%`,
                    background: "var(--brand-gradient)",
                  }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                {targetRevenue != null && targetRevenue > 0
                  ? achieveRateTotal >= 100
                    ? "年間目標をクリアしています"
                    : `あと ${fmtMan(Math.max(0, targetRevenue - totalRevenue))} で目標達成`
                  : "目標は期首設定から入力できます"}
              </p>
            </div>

            <div className="rounded-lg bg-white/70 border border-border/50 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              {operatingProfit < 0 ? (
                <span>
                  いまは最終のもうけがマイナスです。固定費・販管費のほうが、粗利より大きい状態です。
                </span>
              ) : overheadForCalc > 0 && grossProfitTotal < overheadForCalc * 0.2 ? (
                <span>
                  最終のもうけはプラスですが、固定費を引いたあとの余裕はまだ小さめです。
                </span>
              ) : (
                <span>
                  売上から費用を引いた結果、会社に {fmtMan(operatingProfit)} 残っています。
                </span>
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
        title="部門別"
        right={
          <div className="flex items-center gap-2">
            <Switch id="theoretical" checked={showTheoretical} onCheckedChange={setShowTheoretical} />
            <Label htmlFor="theoretical" className="text-xs text-slate-500 cursor-pointer">
              費用の目安を{showTheoretical ? "表示中" : "非表示"}
            </Label>
          </div>
        }
      />

      {/* 部門カード（並び替え可）— ファーストビューで完結するデフォルト */}
      <BiDepartmentCards
        fiscalYear={fiscalYear}
        departments={deptCards}
        showTheoretical={showTheoretical}
        fmtMan={fmtMan}
        fmtSigned={fmtSigned}
        fmtRatio={fmtRatio}
        yoyRatioClass={yoyRatioClass}
      />

      {/* 全社合計バー */}
      <div
        className="frost-card rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm"
        style={{ background: "rgba(var(--brand-accent-rgb),0.18)" }}
      >
        <span className="font-semibold">全社合計</span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums">
          <span>
            売上 <b className="text-sm">{fmtMan(totalRevenue)}</b>
            <span className="text-muted-foreground"> / {fmtTargetMan(targetRevenue)}</span>
          </span>
          <span>
            達成率 <b className="text-sm text-[var(--brand-dark)]">{achieveRateTotal}%</b>
          </span>
          <span>
            昨対比{" "}
            <b className={cn("text-sm", yoyRatioClass(deptTotalYoYRatio))}>{fmtRatio(deptTotalYoYRatio)}</b>
          </span>
          <span>
            粗利 <b className="text-sm">{fmtMan(totalGrossProfit)}</b>
            <span className="text-muted-foreground">（{grossProfitRate}%）</span>
          </span>
          {showTheoretical && (
            <span>
              営業利益{" "}
              <b className={cn("text-sm", operatingProfit < 0 ? "text-rose-500" : "text-[var(--brand-dark)]")}>
                {fmtSigned(operatingProfit)}
              </b>
            </span>
          )}
        </div>
      </div>

      {/* 部門別 詳細テーブル（折りたたみ） */}
      <BiPanel
        title="部門別詳細（表）"
        description="数字の詳細確認用。通常はカード表示で十分です"
        flush
        collapsible
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ background: "rgba(var(--brand-accent-rgb),0.25)" }}>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">部門</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">売上 / 目標</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">達成率</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">昨対比</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">粗利率</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">粗利額</th>
                {showTheoretical && <>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">販管費 <span className="opacity-50">理論</span></th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">営業利益 <span className="opacity-50">理論</span></th>
                </>}
              </tr>
            </thead>
            <tbody>
              {deptCards.map((d) => (
                <tr key={d.id} className="border-b last:border-0 transition-colors"
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(var(--brand-accent-rgb),0.15)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <div>
                        <div className="font-medium text-foreground">{d.name}</div>
                        <div className="text-[11px] text-muted-foreground">{d.label}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-right px-4 py-3.5 tabular-nums">
                    <span className="font-semibold">{fmtMan(d.revenue)}</span>
                    <span className="text-muted-foreground text-xs"> / {d.target != null ? fmtMan(d.target) : "未設定"}</span>
                  </td>
                  <td className="text-right px-4 py-3.5">
                    <span className={cn("font-semibold", d.target != null && d.achieveRate >= 30 ? "text-[var(--brand-dark)]" : "text-amber-600")}>
                      {d.target != null ? `${d.achieveRate}%` : "—"}
                    </span>
                  </td>
                  <td className="text-right px-4 py-3.5 tabular-nums">
                    <span className={cn("font-semibold", yoyRatioClass(d.yoyRatio))}>{fmtRatio(d.yoyRatio)}</span>
                  </td>
                  <td className="text-right px-4 py-3.5 tabular-nums text-muted-foreground">{d.gpRate}%</td>
                  <td className="text-right px-4 py-3.5 tabular-nums font-semibold">{fmtMan(d.grossProfit)}</td>
                  {showTheoretical && <>
                    <td className="text-right px-4 py-3.5 tabular-nums text-rose-500 text-xs">▲¥{d.deptSga.toLocaleString()}万</td>
                    <td className={cn("text-right px-5 py-3.5 tabular-nums font-semibold", d.deptOp < 0 ? "text-rose-500" : "text-[var(--brand-dark)]")}>
                      {fmtSigned(d.deptOp)}
                    </td>
                  </>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-5 pb-4 pt-3 text-[11px] text-muted-foreground flex items-start gap-1.5">
          <Info className="h-3 w-3 shrink-0 mt-0.5 text-[var(--brand-dark)]" />
          販管費・営業利益は売上構成比による按分で算出した理論値です。製造間接費は全社レベルで一括控除します。
        </p>
      </BiPanel>

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
            <div className="h-[280px] sm:h-[320px] overflow-visible">
              <TrendAreaChart
                variant="overview"
                data={monthlyComboData.map((row) => ({
                  ...row,
                  // 間接費は絶対値で重ねて見せる（控除のイメージ）
                  間接費: Math.abs(Number(row.月次予定配賦 ?? 0)),
                }))}
                labelKey="month"
                height={300}
                unit="万"
                forecastFromIndex={forecastStartIndex}
                forecastZoneLabel="これから（着地予測）"
                xSubLabel={(i) =>
                  forecastStartIndex != null && i >= forecastStartIndex ? "予測" : "実績"
                }
                series={[
                  {
                    key: "粗利額",
                    label: "その月の粗利",
                    color: "#06b6d4",
                    colorEnd: "#2563eb",
                  },
                  {
                    key: "累計",
                    label: "積み上がった利益（累計）",
                    color: "#a855f7",
                    colorEnd: "#6366f1",
                    highlight: true,
                    showPills: true,
                  },
                  {
                    key: "間接費",
                    label: "その月の固定費",
                    color: "#f59e0b",
                    colorEnd: "#ea580c",
                    area: true,
                  },
                ]}
                formatValue={(v) => `${v < 0 ? "▲" : ""}¥${Math.abs(Math.round(v)).toLocaleString()}万`}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground px-0.5">
              水色＝その月の粗利（繁忙月は山・閑散月は谷）。紫＝積み上がった利益。閑散月は固定費の方が大きく、累計が下がります。
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
                          {fmtMonthlyAlloc(allocation, settingsConfigured)}
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
            formatValue={(v) => `¥${Math.abs(v).toLocaleString()}万`}
          />
        </div>
      </BiPanel>

      <BiPanel title="昨対比 月次明細" description="月別売上と累計の昨対比。年度合計は最下行（数字で確認）" flush collapsible>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs" style={{ background: "rgba(var(--brand-accent-rgb),0.25)" }}>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground whitespace-nowrap">月</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">当期売上</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">前期売上</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">昨対比（月次）</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">当期累計</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">前期累計</th>
                <th className="text-right px-5 py-3 font-medium text-muted-foreground whitespace-nowrap">累計昨対比</th>
              </tr>
            </thead>
            <tbody>
              {yoyRows.map((row, i) => (
                <tr
                  key={`${row.month}-${i}`}
                  className={cn("border-b last:border-0 transition-colors", row.isFuture && "opacity-45")}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(var(--brand-accent-rgb),0.15)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}
                >
                  <td className="px-5 py-2.5 font-medium text-foreground whitespace-nowrap">{row.month}</td>
                  <td className="text-right px-4 py-2.5 tabular-nums">
                    {row.isFuture ? "—" : fmtMan(row.current)}
                  </td>
                  <td className="text-right px-4 py-2.5 tabular-nums text-muted-foreground">{fmtMan(row.prev)}</td>
                  <td className={cn("text-right px-4 py-2.5 tabular-nums font-semibold", yoyRatioClass(row.monthlyRatio))}>
                    {row.isFuture ? "—" : fmtRatio(row.monthlyRatio)}
                  </td>
                  <td className="text-right px-4 py-2.5 tabular-nums">
                    {row.isFuture ? "—" : fmtMan(row.currentCum)}
                  </td>
                  <td className="text-right px-4 py-2.5 tabular-nums text-muted-foreground">{fmtMan(row.prevCum)}</td>
                  <td className={cn("text-right px-5 py-2.5 tabular-nums font-semibold", yoyRatioClass(row.cumulativeRatio))}>
                    {row.isFuture ? "—" : fmtRatio(row.cumulativeRatio)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 font-semibold" style={{ background: "rgba(var(--brand-accent-rgb),0.25)" }}>
                <td className="px-5 py-3">年度合計</td>
                <td className="text-right px-4 py-3 tabular-nums">{fmtMan(curAnnualRevenue)}</td>
                <td className="text-right px-4 py-3 tabular-nums text-muted-foreground">{fmtMan(prevAnnualRevenue)}</td>
                <td className="text-right px-4 py-3 text-muted-foreground text-xs">—</td>
                <td className="text-right px-4 py-3 tabular-nums">{fmtMan(curAnnualRevenue)}</td>
                <td className="text-right px-4 py-3 tabular-nums text-muted-foreground">{fmtMan(prevAnnualRevenue)}</td>
                <td className={cn("text-right px-5 py-3 tabular-nums font-bold", yoyRatioClass(annualYoYRatio))}>
                  {fmtRatio(annualYoYRatio)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="px-5 pb-4 pt-2 text-[11px] text-muted-foreground flex items-start gap-1.5">
          <Info className="h-3 w-3 shrink-0 mt-0.5 text-[var(--brand-dark)]" />
          累計昨対比＝当期の月次累計 ÷ 前期の同月までの累計。当年度の未到来月は「—」表示。前期実績が0の月は比較不能のため「—」となります。
        </p>
      </BiPanel>

      {/* ── 着地予測 ── */}
      <BiPanel title="着地予測（期末見込み）" description="期首予算と着地パターンの比較" flush>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs" style={{ background: "rgba(var(--brand-accent-rgb),0.25)" }}>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground whitespace-nowrap">指標</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">期首予算</th>
                {forecastTiers.map((tier) => (
                  <th key={tier.id} className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap last:px-5">
                    {tier.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const rows = [
                  { label: "全社売上", budget: targetRevenueForCalc, budgetUnset: !settingsConfigured, showRate: false, pick: (t: typeof forecastTiers[0]) => t.revenue },
                  { label: "粗利額",   budget: targetGpForCalc, budgetUnset: !settingsConfigured, showRate: true, pick: (t: typeof forecastTiers[0]) => t.grossProfit, baseBudget: targetRevenueForCalc, basePick: (t: typeof forecastTiers[0]) => t.revenue },
                  { label: "予定配賦", budget: -overheadForCalc, budgetUnset: !settingsConfigured, showRate: false, pick: () => -overheadForCalc },
                  { label: "売上総利益", budget: targetGpForCalc - overheadForCalc, budgetUnset: !settingsConfigured, showRate: true, pick: (t: typeof forecastTiers[0]) => t.grossProfit - overheadForCalc, baseBudget: targetRevenueForCalc, basePick: (t: typeof forecastTiers[0]) => t.revenue },
                  { label: "販管費",   budget: -sgaForCalc, budgetUnset: !settingsConfigured, showRate: false, pick: () => -sgaForCalc },
                  { label: "営業利益", budget: targetGpForCalc - overheadForCalc - sgaForCalc, budgetUnset: !settingsConfigured, showRate: true, pick: (t: typeof forecastTiers[0]) => t.grossProfit - overheadForCalc - sgaForCalc, baseBudget: targetRevenueForCalc, basePick: (t: typeof forecastTiers[0]) => t.revenue },
                ];
                const cell = (val: number, rate?: number) => (
                  <div>
                    <span className={cn("text-sm font-semibold tabular-nums", val < 0 ? "text-rose-500" : "text-foreground")}>
                      {fmtSigned(val)}
                    </span>
                    {rate !== undefined && (
                      <span className="text-[11px] text-muted-foreground ml-1.5">
                        (<span className={val >= 0 ? "text-[var(--brand-dark)]" : "text-rose-500"}>{r1(Math.abs(rate))}%</span>)
                      </span>
                    )}
                  </div>
                );
                return rows.map((row, idx) => (
                  <tr key={idx} className="border-b last:border-0 transition-colors"
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(var(--brand-accent-rgb),0.15)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}>
                    <td className="px-5 py-3 font-medium">{row.label}</td>
                    <td className="text-right px-4 py-3">
                      {row.budgetUnset
                        ? <span className="text-sm text-muted-foreground">未設定</span>
                        : cell(row.budget, row.showRate && row.baseBudget ? pct(row.budget, row.baseBudget) : undefined)
                      }
                    </td>
                    {forecastTiers.map((tier) => {
                      const val = row.pick(tier);
                      const base = (row as { basePick?: (t: typeof tier) => number }).basePick?.(tier);
                      return (
                        <td key={tier.id} className="text-right px-4 py-3 last:px-5">
                          {cell(val, row.showRate && base ? pct(val, base) : undefined)}
                        </td>
                      );
                    })}
                  </tr>
                ));
              })()}
              <tr className="border-t-2" style={{ background: "rgba(var(--brand-accent-rgb),0.25)" }}>
                <td className="px-5 py-3 text-xs font-medium text-muted-foreground">売上達成率</td>
                <td className="text-right px-4 py-3 text-sm font-bold text-[var(--brand-dark)]">100%</td>
                {forecastTiers.map((tier) => (
                  <td key={tier.id} className="text-right px-4 py-3 last:px-5 text-sm font-bold text-[var(--brand-dark)]">
                    {pct(tier.revenue, targetRevenueForCalc)}%
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </BiPanel>

      {/* ── 見込度別 見込み売上 ── */}
      <BiPanel
        title="見込み売上（見込度別）"
        description="通常見込はA/B/Cの会社確度%。「特需を含める」ONで専用行が追加されます"
        flush
        headerRight={
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
                "text-xs cursor-pointer",
                effectiveProspectSummary?.hasSpecial ? "text-slate-600" : "text-muted-foreground",
              )}
            >
              特需を含める
              {effectiveProspectSummary?.hasSpecial
                ? `（${effectiveProspectSummary.special.customerCount}件）`
                : "（なし）"}
            </Label>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20 text-xs">
                <th className="text-left px-5 py-3 font-medium text-muted-foreground whitespace-nowrap">見込度</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">顧客数</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">見込み金額</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">確度</th>
                <th className="text-right px-5 py-3 font-medium text-muted-foreground whitespace-nowrap">期待値（確度加重）</th>
              </tr>
            </thead>
            <tbody>
              {(effectiveProspectSummary?.rows ?? []).map((row) => (
                <tr key={row.grade} className="border-b transition-colors"
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(var(--brand-accent-rgb),0.15)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <td className="px-5 py-3 font-medium">見込 {row.grade}</td>
                  <td className="text-right px-4 py-3 tabular-nums">{row.customerCount}件</td>
                  <td className="text-right px-4 py-3 tabular-nums">¥{row.baseRevenue.toLocaleString()}万</td>
                  <td className="text-right px-4 py-3 tabular-nums text-muted-foreground">{row.rate}%</td>
                  <td className="text-right px-5 py-3 tabular-nums font-semibold">¥{row.weightedRevenue.toLocaleString()}万</td>
                </tr>
              ))}
              {includeSpecial && effectiveProspectSummary?.hasSpecial && (
                <tr className="border-b transition-colors bg-amber-50/40"
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(var(--brand-accent-rgb),0.15)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <td className="px-5 py-3 font-medium">
                    特需（大型）
                    <span className="block text-[10px] font-normal text-muted-foreground">
                      案件%優先／未設定時は会社設定 {effectiveProspectSummary.special.companyRate}%
                    </span>
                  </td>
                  <td className="text-right px-4 py-3 tabular-nums">{effectiveProspectSummary.special.customerCount}件</td>
                  <td className="text-right px-4 py-3 tabular-nums">¥{effectiveProspectSummary.special.baseRevenue.toLocaleString()}万</td>
                  <td className="text-right px-4 py-3 tabular-nums text-muted-foreground">個別</td>
                  <td className="text-right px-5 py-3 tabular-nums font-semibold">
                    ¥{effectiveProspectSummary.special.weightedRevenue.toLocaleString()}万
                  </td>
                </tr>
              )}
              <tr className="border-t-2 font-semibold" style={{ background: "rgba(var(--brand-accent-rgb),0.25)" }}>
                <td className="px-5 py-3">合計{includeSpecial && effectiveProspectSummary?.hasSpecial ? "（特需込み）" : ""}</td>
                <td className="text-right px-4 py-3 tabular-nums">
                  {(effectiveProspectSummary?.rows ?? []).reduce((s, r) => s + r.customerCount, 0)
                    + (includeSpecial ? (effectiveProspectSummary?.special.customerCount ?? 0) : 0)}件
                </td>
                <td className="text-right px-4 py-3 tabular-nums">
                  ¥{(includeSpecial
                    ? (effectiveProspectSummary?.totalBaseWithSpecial ?? 0)
                    : (effectiveProspectSummary?.totalBase ?? 0)
                  ).toLocaleString()}万
                </td>
                <td className="text-right px-4 py-3" />
                <td className="text-right px-5 py-3 tabular-nums text-[var(--brand-dark)]">
                  ¥{(includeSpecial
                    ? (effectiveProspectSummary?.totalWeightedWithSpecial ?? 0)
                    : (effectiveProspectSummary?.totalWeighted ?? 0)
                  ).toLocaleString()}万
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="px-5 pb-4 pt-3 text-[11px] text-muted-foreground flex items-start gap-1.5">
          <Info className="h-3 w-3 shrink-0 mt-0.5 text-[var(--brand-dark)]" />
          見込み金額は進行中商談（受注・失注を除く）の合計、商談がない顧客は予算上限を使用します。特需は1件の成否で全体が大きく動くため、含め/除外を切替できます。特需契約率の会社デフォルトは期首設定（BI機種設定）で変更できます。
        </p>
      </BiPanel>

      <div className="flex items-start gap-2 text-xs text-muted-foreground rounded-lg p-3.5" style={{ background: "rgba(var(--brand-accent-rgb),0.25)", border: "1px solid rgba(var(--brand-accent-rgb),0.8)" }}>
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[var(--brand-dark)]" />
        <span>
          売上総利益のマイナスは<strong className="text-[var(--brand-dark)]">仕様です</strong>。粗利の積み上げが製造間接費（年額 {overheadBudget != null ? `¥${overheadBudget.toLocaleString()}万` : "未設定"}）を超えるまで赤字表示となり、損益分岐点までの距離を示します。
        </span>
      </div>

    </div>
  );
}
