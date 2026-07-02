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
} from "lucide-react";
import { ComboChart } from "@/components/charts/combo-chart";
import { getBiSettings, getBiActuals } from "@/lib/actions/bi";
import type { BiAnnualSettings, BiActuals } from "@/lib/bi-types";
import {
  getCurrentFiscalYear,
  fiscalYearLabel,
  listFiscalYears,
  buildFiscalMonthLabels,
  getForecastStartIndex,
  DEFAULT_FISCAL_MONTH_START,
} from "@/lib/bi-utils";
import { BiSettingsDialog } from "@/components/bi/bi-settings-dialog";
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

// ── 全社サマリー：メトリクスセル ─────────────────────────────────────
function Metric({
  label,
  value,
  sub,
  negative,
  subNegative,
}: {
  label: string;
  value: string;
  sub?: string;
  negative?: boolean;
  subNegative?: boolean;
}) {
  return (
    <div className="px-4 py-3 min-w-0">
      <p className="text-[11px] text-muted-foreground truncate">{label}</p>
      <p className={cn("text-lg font-bold tabular-nums mt-1 leading-none", negative ? "text-rose-500" : "text-foreground")}>
        {value}
      </p>
      {sub ? (
        <p className={cn("text-[11px] mt-1.5", subNegative ? "text-rose-500" : "text-muted-foreground")}>{sub}</p>
      ) : null}
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
}: {
  title: string;
  description?: string;
  children: ReactNode;
  headerRight?: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <div className={cn("frost-card rounded-lg flex flex-col", flush ? "gap-0" : "p-4 gap-3", className)}>
      <div className={cn(
        "flex items-start justify-between gap-2 pb-2.5 border-b border-border/60 shrink-0",
        flush && "px-4 pt-4",
      )}>
        <div className="min-w-0">
          <span className="text-xs font-bold text-foreground">{title}</span>
          {description ? <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p> : null}
        </div>
        {headerRight}
      </div>
      <div className="min-w-0">{children}</div>
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
  const [showTheoretical, setShowTheoretical] = useState(true);
  const [settings, setSettings] = useState<BiAnnualSettings | null>(initialSettings);
  const [actuals, setActuals] = useState<BiActuals | null>(initialActuals);
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

  const loadBiData = useCallback((silent = false) => {
    if (!silent) setSettingsLoaded(false);
    return Promise.all([getBiSettings(fiscalYear), getBiActuals(fiscalYear)])
      .then(([s, a]) => { setSettings(s); setActuals(a); })
      .finally(() => setSettingsLoaded(true));
  }, [fiscalYear]);

  // 初回マウントは SSR の初期データがあるので静かに再取得、年度変更時のみローディング表示
  const didMount = useRef(false);
  useEffect(() => {
    loadBiData(!didMount.current);
    didMount.current = true;
  }, [loadBiData]);

  // 案件データ更新を反映（フォーカス復帰 + 30秒ポーリング）。スケルトンを出さず静かに更新
  useEffect(() => {
    const onFocus = () => loadBiData(true);
    window.addEventListener("focus", onFocus);
    const interval = setInterval(() => { if (document.visibilityState === "visible") loadBiData(true); }, 30000);
    return () => { window.removeEventListener("focus", onFocus); clearInterval(interval); };
  }, [loadBiData]);

  const settingsConfigured = settings !== null;
  const targetRevenue  = settingsConfigured ? (settings.target_revenue ?? 0)        : null;
  const overheadBudget = settingsConfigured ? (settings.overhead_budget ?? 0)       : null;
  const sgaBudget      = settingsConfigured ? (settings.sga_budget ?? 0)            : null;
  const targetGp       = settingsConfigured ? (settings.target_gross_profit ?? 0)   : null;

  const overheadForCalc      = overheadBudget ?? 0;
  const sgaForCalc           = sgaBudget ?? 0;
  const targetRevenueForCalc = targetRevenue ?? 0;
  const targetGpForCalc      = targetGp ?? 0;

  const fiscalMonthStart          = actuals?.fiscalMonthStart          ?? DEFAULT_FISCAL_MONTH_START;
  const forecastStartIndex        = getForecastStartIndex(fiscalMonthStart);

  const deptActuals               = actuals?.deptActuals               ?? FALLBACK_DEPT_ACTUALS;
  const monthlyActuals            = actuals?.monthly                   ?? makeFallbackMonthly(fiscalMonthStart);
  const monthlyOverheadAllocations = actuals?.monthlyOverheadAllocations ?? Array(12).fill(0);
  const monthlySgaAllocations     = actuals?.monthlySgaAllocations     ?? Array(12).fill(0);
  const forecastTiers             = actuals?.forecastTiers             ?? FALLBACK_FORECAST_TIERS;
  const sparklines                = actuals?.sparklines;
  const grossProfitRateDelta      = actuals?.deltas.grossProfitRatePt;

  const deptTargetMap:   Record<string, number> = {};
  const deptGpTargetMap: Record<string, number> = {};
  if (settings?.department_targets?.length) {
    settings.department_targets.forEach((d) => {
      deptTargetMap[d.department_name]   = d.target_revenue;
      deptGpTargetMap[d.department_name] = d.target_gross_profit;
    });
  }

  const totalRevenue     = deptActuals.reduce((s, d) => s + d.revenue, 0);
  const totalGrossProfit = deptActuals.reduce((s, d) => s + d.grossProfit, 0);
  const grossProfitRate  = pct(totalGrossProfit, totalRevenue);
  const achieveRateTotal = pct(totalRevenue, targetRevenueForCalc);
  const grossProfitTotal = totalGrossProfit - overheadForCalc;
  const gptRate          = pct(grossProfitTotal, totalRevenue);
  const operatingProfit  = grossProfitTotal - sgaForCalc;
  const opRate           = pct(operatingProfit, totalRevenue);

  const monthlyComboData = (() => {
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

  const monthlyDetailRows = buildMonthlyDetailRows(
    monthlyActuals,
    monthlyOverheadAllocations,
    settingsConfigured,
    overheadForCalc,
    forecastStartIndex,
  );

  return (
    <div className="p-4 md:p-6 space-y-4 min-h-screen">

      {/* ── ページヘッダー ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">BIダッシュボード</h1>
          <p className="text-sm mt-1 text-muted-foreground">{fiscalYearLabel(fiscalYear)} ・ 経営指標の可視化</p>
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

      {/* ─────────────────────────────────────────────────────── */}
      {/* 全社サマリー                                            */}
      {/* ─────────────────────────────────────────────────────── */}
      <SectionHeader
        icon={LayoutDashboard}
        title="全社サマリー"
        right={
          <span className="text-[11px] text-muted-foreground">
            {fiscalYearLabel(fiscalYear)}
            {settingsConfigured && targetRevenue != null && `（固定予算 ¥${targetRevenue.toLocaleString()}万）`}
          </span>
        }
      />

      <div className="frost-card rounded-lg divide-y divide-border/60">
        {/* 1段目 */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border/60">
          <Metric
            label="売上（実績/目標）"
            value={fmtMan(totalRevenue)}
            sub={`/ ${fmtTargetMan(targetRevenue)}`}
          />
          <Metric label="達成率" value={`${achieveRateTotal}%`} sub="対年間目標" />
          <Metric label="粗利率" value={`${grossProfitRate}%`} sub="完工工事の平均" />
          <Metric label="粗利額" value={fmtMan(totalGrossProfit)} sub="部門粗利の合計" />
        </div>
        {/* 2段目 */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border/60">
          <Metric
            label="予算配賦（製造間接費）"
            value={settingsConfigured ? fmtSigned(grossProfitTotal) : "未設定"}
            sub={settingsConfigured ? `製造間接費 ▲¥${overheadForCalc.toLocaleString()}万` : "期首設定が必要"}
            negative={settingsConfigured && grossProfitTotal < 0}
          />
          <Metric
            label="売上総利益 / 総利益率"
            value={fmtSigned(grossProfitTotal)}
            sub={`売上総利益率 ${grossProfitTotal < 0 ? "▲" : ""}${r1(Math.abs(gptRate))}%`}
            negative={grossProfitTotal < 0}
            subNegative={grossProfitTotal < 0}
          />
          <Metric
            label="営業費予算"
            value={settingsConfigured ? `▲${fmtMan(sgaForCalc)}` : "未設定"}
            sub={settingsConfigured ? "販管費予算" : "期首設定が必要"}
            negative={settingsConfigured}
          />
          <Metric
            label="営業利益 / 営業利益率"
            value={fmtSigned(operatingProfit)}
            sub={`営業利益率 ${operatingProfit < 0 ? "▲" : ""}${r1(Math.abs(opRate))}%`}
            negative={operatingProfit < 0}
            subNegative={operatingProfit < 0}
          />
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
              販管費・営業利益（理論値）は{showTheoretical ? "表示中" : "非表示"}
            </Label>
          </div>
        }
      />

      {/* 部門別 詳細テーブル */}
      <BiPanel
        title="部門別詳細"
        description="部門ごとの達成率・粗利率・営業利益（理論値）"
        flush
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ background: "rgba(var(--brand-accent-rgb),0.25)" }}>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">部門</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">売上 / 目標</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">達成率</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">粗利率</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">粗利額</th>
                {showTheoretical && <>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">販管費 <span className="opacity-50">理論</span></th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">営業利益 <span className="opacity-50">理論</span></th>
                </>}
              </tr>
            </thead>
            <tbody>
              {deptActuals.map((d, i) => {
                const target    = deptTargetMap[d.name];
                const gpTarget  = deptGpTargetMap[d.name];
                const rate      = target != null && target > 0 ? pct(d.revenue, target) : 0;
                const gpRate    = pct(d.grossProfit, d.revenue);
                const deptSga   = totalRevenue > 0 ? Math.round(sgaForCalc * (d.revenue / totalRevenue)) : 0;
                const deptOp    = d.grossProfit - deptSga;
                return (
                  <tr key={i} className="border-b last:border-0 transition-colors"
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(var(--brand-accent-rgb),0.15)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: DEPT_CHART_COLORS[i % DEPT_CHART_COLORS.length] }} />
                        <div>
                          <div className="font-medium text-foreground">{d.name}</div>
                          <div className="text-[11px] text-muted-foreground">{d.label}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right px-4 py-3.5 tabular-nums">
                      <span className="font-semibold">¥{d.revenue.toLocaleString()}万</span>
                      <span className="text-muted-foreground text-xs"> / {target != null ? `¥${target.toLocaleString()}万` : "未設定"}</span>
                    </td>
                    <td className="text-right px-4 py-3.5">
                      <div className="inline-flex flex-col items-end gap-1">
                        <span className={cn("font-semibold", target != null && rate >= 30 ? "text-[var(--brand-dark)]" : "text-amber-600")}>
                          {target != null ? `${rate}%` : "—"}
                        </span>
                        <div className="h-1 w-14 rounded-full overflow-hidden" style={{ background: "rgba(var(--brand-accent-rgb),0.6)" }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(rate, 100)}%`, background: "var(--brand-gradient)" }} />
                        </div>
                      </div>
                    </td>
                    <td className="text-right px-4 py-3.5 tabular-nums text-muted-foreground">{gpRate}%</td>
                    <td className="text-right px-4 py-3.5 tabular-nums font-semibold">
                      ¥{d.grossProfit.toLocaleString()}万
                      {gpTarget != null && gpTarget > 0 && (
                        <div className="text-[10px] text-muted-foreground font-normal">
                          目標 ¥{gpTarget.toLocaleString()}万
                        </div>
                      )}
                    </td>
                    {showTheoretical && <>
                      <td className="text-right px-4 py-3.5 tabular-nums text-rose-500 text-xs">▲¥{deptSga.toLocaleString()}万</td>
                      <td className={cn("text-right px-5 py-3.5 tabular-nums font-semibold", deptOp < 0 ? "text-rose-500" : "text-[var(--brand-dark)]")}>
                        {fmtSigned(deptOp)}
                      </td>
                    </>}
                  </tr>
                );
              })}
              <tr className="border-t-2 font-semibold" style={{ background: "rgba(var(--brand-accent-rgb),0.25)" }}>
                <td className="px-5 py-3">全社合計</td>
                <td className="text-right px-4 py-3 tabular-nums">
                  ¥{totalRevenue.toLocaleString()}万
                  <span className="text-muted-foreground font-normal text-xs"> / {fmtTargetMan(targetRevenue)}</span>
                </td>
                <td className="text-right px-4 py-3 text-[var(--brand-dark)]">{achieveRateTotal}%</td>
                <td className="text-right px-4 py-3 tabular-nums text-muted-foreground">{grossProfitRate}%</td>
                <td className="text-right px-4 py-3 tabular-nums">
                  ¥{totalGrossProfit.toLocaleString()}万
                  {targetGp != null && <div className="text-[10px] text-muted-foreground font-normal">目標 ¥{targetGpForCalc.toLocaleString()}万</div>}
                </td>
                {showTheoretical && <>
                  <td className="text-right px-4 py-3 tabular-nums text-rose-500">
                    {sgaBudget != null ? `▲¥${sgaForCalc.toLocaleString()}万` : "未設定"}
                  </td>
                  <td className={cn("text-right px-5 py-3 tabular-nums font-semibold", operatingProfit < 0 ? "text-rose-500" : "text-[var(--brand-dark)]")}>
                    {fmtSigned(operatingProfit)}
                  </td>
                </>}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="px-5 pb-4 pt-3 text-[11px] text-muted-foreground flex items-start gap-1.5">
          <Info className="h-3 w-3 shrink-0 mt-0.5 text-[var(--brand-dark)]" />
          販管費・営業利益は売上構成比による按分で算出した理論値です（§3.1）。製造間接費は全社レベルで一括控除します。
        </p>
      </BiPanel>

      {/* ─────────────────────────────────────────────────────── */}
      {/* 月別推移                                                */}
      {/* ─────────────────────────────────────────────────────── */}
      <SectionHeader icon={BarChart3} title="月別推移" />

      <BiPanel
        title="月別推移（全社）"
        description="粗利額・月次予定配賦（控除）と売上総利益（累計）の推移"
        headerRight={
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            表示対象: <span className="font-medium text-foreground">全社</span>
          </span>
        }
      >
        <div className="h-[220px] sm:h-[280px] overflow-visible">
          <ComboChart
            data={monthlyComboData}
            labelKey="month"
            height={240}
            unit="万"
            centered
            lineArea
            forecastFromIndex={forecastStartIndex}
            gridColor={CHART_ACCENT}
            labelColor={CHART_PRIMARY}
            tickColor={CHART_PRIMARY}
            bars={[
              { key: "粗利額", label: "粗利額（積上）", fill: CHART_DARK },
              {
                key: "月次予定配賦",
                label: "月次予定配賦",
                fill: "#b45309",
                forecastFill: "rgba(180, 83, 9, 0.35)",
              },
            ]}
            line={{ key: "累計", label: "売上総利益（累計）", color: CHART_PRIMARY }}
            formatValue={(v) => `${v < 0 ? "▲" : ""}¥${Math.abs(v).toLocaleString()}万`}
          />
        </div>
      </BiPanel>

      <BiPanel title="月次明細" description="月別の売上・粗利・月次予定配賦・売上総利益" flush>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs" style={{ background: "rgba(var(--brand-accent-rgb),0.25)" }}>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground whitespace-nowrap">月</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">売上（実績）</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">粗利額</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">月次予定配賦</th>
                <th className="text-right px-5 py-3 font-medium text-muted-foreground whitespace-nowrap">売上総利益</th>
                <th className="text-right px-5 py-3 font-medium text-muted-foreground whitespace-nowrap">累計</th>
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
          全社の月次予定配賦は年額 ÷ 12 で均等配賦しています。部門ビューの配賦は当月の売上構成比による按分です。
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

      <div className="flex items-start gap-2 text-xs text-muted-foreground rounded-lg p-3.5" style={{ background: "rgba(var(--brand-accent-rgb),0.25)", border: "1px solid rgba(var(--brand-accent-rgb),0.8)" }}>
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[var(--brand-dark)]" />
        <span>
          売上総利益のマイナスは<strong className="text-[var(--brand-dark)]">仕様です</strong>。粗利の積み上げが製造間接費（年額 {overheadBudget != null ? `¥${overheadBudget.toLocaleString()}万` : "未設定"}）を超えるまで赤字表示となり、損益分岐点までの距離を示します。
        </span>
      </div>

    </div>
  );
}
