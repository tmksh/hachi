"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  LayoutDashboard,
  PieChart as PieIcon,
  Info,
  Settings2,
  TrendingUp,
  BarChart3,
  ArrowUpRight,
  Briefcase,
} from "lucide-react";
import { BarChart } from "@/components/charts/bar-chart";
import { GroupedBarChart } from "@/components/charts/grouped-bar-chart";
import { AreaChart } from "@/components/charts/area-chart";
import { getBiSettings, getBiActuals } from "@/lib/actions/bi";
import type { BiAnnualSettings, BiActuals } from "@/lib/bi-types";
import { getCurrentFiscalYear, fiscalYearLabel, DEFAULT_DEPARTMENTS } from "@/lib/bi-utils";
import { aggregateChartPeriods, type PeriodGranularity } from "@/lib/bi-config";
import { BiSettingsDialog } from "@/components/bi/bi-settings-dialog";
import { KpiRow } from "@/components/shared/kpi-row";
import { cn } from "@/lib/utils";
import {
  TEAL,
  TEAL_CARD,
  TEAL_MUTED,
  TEAL_TITLE,
  TEAL_WON_GRADIENT,
} from "@/lib/teal-theme";

const BI_NEGATIVE = "#e11d48";
const DEPT_CHART_COLORS = [TEAL[700], TEAL[500], TEAL[300], TEAL[100]];

// データ未登録時のフォールバック
const FALLBACK_DEPT_ACTUALS = [
  { name: "一般住宅",  label: "A部門", revenue: 0, grossProfit: 0 },
  { name: "新築",      label: "B部門", revenue: 0, grossProfit: 0 },
  { name: "公共工事",  label: "C部門", revenue: 0, grossProfit: 0 },
  { name: "リフォーム", label: "D部門", revenue: 0, grossProfit: 0 },
];

const FALLBACK_MONTHLY = [
  "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月",
].map((month) => ({ month, revenue: 0, grossProfit: 0 }));

const FALLBACK_FORECAST_TIERS = [
  { id: "contracted", label: "着地（契約済）", revenue: 0, grossProfit: 0 },
  { id: "prospective", label: "着地（A見込含）", revenue: 0, grossProfit: 0 },
];

// ── 円形プログレス ────────────────────────────────────────────────────
function CircularProgress({
  value,        // 0-100
  size = 120,
  strokeWidth = 10,
  color,
  label,
  actual,
  target,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  label: string;
  actual: string;
  target: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const capped = Math.min(value, 100);
  const offset = circ - (capped / 100) * circ;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <defs>
            <linearGradient id={`cg-${label}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={1} />
            </linearGradient>
          </defs>
          {/* 背景トラック */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/50"
          />
          {/* プログレス */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={`url(#cg-${label})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        {/* 中央テキスト */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold tabular-nums leading-none" style={{ color }}>
            {Math.round(capped)}%
          </span>
          <span className="text-[10px] text-muted-foreground mt-0.5">達成</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm font-bold tabular-nums">{actual}</p>
        <p className="text-[10px] text-muted-foreground">目標 {target}</p>
      </div>
    </div>
  );
}

// ── パネル（ダッシュボードと同系統） ────────────────────────────────────
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
    <div className={cn(TEAL_CARD, "flex flex-col", flush ? "gap-0" : "p-4 gap-3", className)}>
      <div className={cn(
        "flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100 shrink-0",
        flush && "px-4 pt-4",
      )}>
        <div className="min-w-0">
          <span className={cn("text-xs font-bold", TEAL_TITLE)}>{title}</span>
          {description ? <p className="text-[11px] text-slate-400 mt-0.5">{description}</p> : null}
        </div>
        {headerRight}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// ── ユーティリティ ────────────────────────────────────────────────────
function r1(v: number) { return Math.round(v * 10) / 10; }
function pct(part: number, whole: number) { return whole > 0 ? r1((part / whole) * 100) : 0; }
function fmtMan(v: number) { return `¥${Math.abs(v).toLocaleString()}万`; }
function fmtSigned(v: number) { return v < 0 ? `▲${fmtMan(v)}` : fmtMan(v); }

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
  const [chartPeriod, setChartPeriod] = useState<PeriodGranularity>("month");
  const fiscalYear = getCurrentFiscalYear();

  useEffect(() => {
    if (searchParams.get("settings") === "1") {
      setSettingsOpen(true);
      window.history.replaceState(null, "", "/bi");
    }
  }, [searchParams]);

  const loadBiData = useCallback(() => {
    return Promise.all([getBiSettings(fiscalYear), getBiActuals(fiscalYear)])
      .then(([s, a]) => { setSettings(s); setActuals(a); setSettingsLoaded(true); })
      .catch(() => setSettingsLoaded(true));
  }, [fiscalYear]);

  const deptActuals = actuals?.deptActuals ?? FALLBACK_DEPT_ACTUALS;
  const monthlyActuals = actuals?.monthly ?? FALLBACK_MONTHLY;
  const monthlyOverheadAllocations = actuals?.monthlyOverheadAllocations ?? Array(12).fill(Math.round((settings?.overhead_budget ?? 1200) / 12));
  const monthlyByDept = actuals?.monthlyByDept ?? [];
  const forecastTiers = actuals?.forecastTiers ?? FALLBACK_FORECAST_TIERS;
  const hasRealData = actuals?.hasData ?? false;

  // ── 設定値 ──
  const targetRevenue  = settings?.target_revenue       ?? 10000;
  const overheadBudget = settings?.overhead_budget      ?? 1200;
  const sgaBudget      = settings?.sga_budget           ?? 600;
  const targetGp       = settings?.target_gross_profit  ?? Math.round(targetRevenue * 0.29);

  const deptTargetMap: Record<string, number> = {};
  if (settings?.department_targets?.length) {
    settings.department_targets.forEach((d) => { deptTargetMap[d.department_name] = d.target_revenue; });
  } else {
    [4000, 3000, 2000, 1000].forEach((t, i) => { deptTargetMap[DEFAULT_DEPARTMENTS[i]] = t; });
  }

  // ── 全社集計（§3.2） ──
  const totalRevenue     = deptActuals.reduce((s, d) => s + d.revenue, 0);
  const totalGrossProfit = deptActuals.reduce((s, d) => s + d.grossProfit, 0);
  const grossProfitRate  = pct(totalGrossProfit, totalRevenue);
  const achieveRateTotal = pct(totalRevenue, targetRevenue);
  const grossProfitTotal = totalGrossProfit - overheadBudget;
  const gptRate          = pct(grossProfitTotal, totalRevenue);
  const operatingProfit  = grossProfitTotal - sgaBudget;
  const opRate           = pct(operatingProfit, totalRevenue);

  const hasDbSettings = settingsLoaded && settings !== null;

  const chartData = aggregateChartPeriods(monthlyActuals, chartPeriod, monthlyOverheadAllocations);

  // ── P&L ウォーターフォールデータ ──
  const plData = [
    { name: "売上",       value: totalRevenue,     fill: TEAL[700] },
    { name: "粗利額",     value: totalGrossProfit, fill: TEAL[500] },
    { name: "製造間接費", value: -overheadBudget,  fill: BI_NEGATIVE },
    { name: "売上総利益", value: grossProfitTotal, fill: grossProfitTotal >= 0 ? TEAL[500] : BI_NEGATIVE },
    { name: "販管費",     value: -sgaBudget,       fill: BI_NEGATIVE },
    { name: "営業利益",   value: operatingProfit,  fill: operatingProfit >= 0 ? TEAL[700] : BI_NEGATIVE },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4 min-h-screen">

      {/* ページヘッダー（ダッシュボードと同系統） */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-semibold tracking-tight ${TEAL_TITLE}`}>BIダッシュボード</h1>
          <p className={`text-sm mt-1 ${TEAL_MUTED}`}>{fiscalYearLabel(fiscalYear)} ・ 経営指標の可視化</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs border-slate-200 text-slate-600">{hasRealData ? "実績データ" : "実績未登録"}</Badge>
          {hasDbSettings && <Badge className="text-xs bg-[#D8EDE4] text-[#0F5132] border-0">設定済</Badge>}
          <Button variant="outline" size="sm" className="gap-1.5 border-slate-200" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="h-3.5 w-3.5" />期首設定
          </Button>
        </div>
      </div>

      <BiSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSaved={loadBiData}
      />

      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList>
          <TabsTrigger value="summary" className="gap-1.5">
            <LayoutDashboard className="h-3.5 w-3.5" />全社サマリー
          </TabsTrigger>
          <TabsTrigger value="dept" className="gap-1.5">
            <PieIcon className="h-3.5 w-3.5" />部門別
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4 mt-0">

          <KpiRow
            loading={!settingsLoaded}
            items={[
              { label: "売上実績", value: fmtMan(totalRevenue), sub: `目標 ${fmtMan(targetRevenue)}`, icon: TrendingUp },
              { label: "粗利率", value: `${grossProfitRate}%`, sub: fmtMan(totalGrossProfit), icon: BarChart3 },
              {
                label: "売上総利益",
                value: fmtSigned(grossProfitTotal),
                sub: `売上比 ${r1(Math.abs(gptRate))}%`,
                icon: ArrowUpRight,
                valueClassName: grossProfitTotal < 0 ? "text-rose-500" : undefined,
              },
              {
                label: "営業利益",
                value: fmtSigned(operatingProfit),
                sub: `売上比 ${r1(Math.abs(opRate))}%`,
                icon: Briefcase,
                valueClassName: operatingProfit < 0 ? "text-rose-500" : undefined,
              },
            ]}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">

            <BiPanel
              title="損益フロー（P&L）"
              description="売上 → 粗利 → 売上総利益 → 営業利益"
              className="lg:col-span-2"
            >
              <div className="min-h-[260px]">
                <BarChart
                  data={plData.map((entry) => ({
                    label: entry.name,
                    value: entry.value,
                    color: entry.fill,
                  }))}
                  height={260}
                  allowNegative
                  showValueLabels
                  unit="万"
                  gridColor={TEAL[50]}
                  labelColor={TEAL[700]}
                  tickColor={TEAL[500]}
                  formatValue={(v) => `${v < 0 ? "▲" : ""}${Math.abs(v).toLocaleString()}`}
                />
              </div>
            </BiPanel>

            <BiPanel title="目標 vs 実績" description="期首予算との対比">
              <div className="flex items-center justify-around py-3">
                <CircularProgress
                  value={pct(totalRevenue, targetRevenue)}
                  size={130}
                  strokeWidth={11}
                  color={TEAL[500]}
                  label="売上"
                  actual={`¥${totalRevenue.toLocaleString()}万`}
                  target={`¥${targetRevenue.toLocaleString()}万`}
                />
                <CircularProgress
                  value={pct(totalGrossProfit, targetGp)}
                  size={130}
                  strokeWidth={11}
                  color={TEAL[700]}
                  label="粗利額"
                  actual={`¥${totalGrossProfit.toLocaleString()}万`}
                  target={`¥${targetGp.toLocaleString()}万`}
                />
              </div>

              <div className="mt-3 rounded-xl bg-[#D8EDE4]/40 p-3 space-y-2.5">
                <p className="text-[10px] font-semibold text-[#2A8055] uppercase tracking-wider">固定費控除</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-400 shrink-0" />
                    <span className="text-xs text-slate-500">製造間接費</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-rose-500">▲¥{overheadBudget.toLocaleString()}万</span>
                    <span className="text-[10px] text-slate-400 ml-1.5">/ 月{Math.round(overheadBudget / 12).toLocaleString()}万</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-300 shrink-0" />
                    <span className="text-xs text-slate-500">販管費予算</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-rose-500">▲¥{sgaBudget.toLocaleString()}万</span>
                    <span className="text-[10px] text-slate-400 ml-1.5">/ 月{Math.round(sgaBudget / 12).toLocaleString()}万</span>
                  </div>
                </div>
                <div className="pt-1.5 border-t border-[#A8D4BC]/40">
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>売上達成率</span>
                    <span className="font-bold text-[#0F5132]">{pct(totalRevenue, targetRevenue)}%</span>
                  </div>
                  <div className="h-1.5 bg-[#D8EDE4] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(pct(totalRevenue, targetRevenue), 100)}%`, background: TEAL_WON_GRADIENT }}
                    />
                  </div>
                </div>
              </div>
            </BiPanel>
          </div>

          <BiPanel
            title="月別推移"
            description="売上 / 粗利 / 売上総利益（按分後）の推移"
            headerRight={
              <div className="segmented-control shrink-0 text-[11px]">
                {(["month", "quarter", "year"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setChartPeriod(p)}
                    className={cn(
                      "segmented-control-btn",
                      chartPeriod === p && "segmented-control-btn-active",
                    )}
                  >
                    {p === "month" ? "月次" : p === "quarter" ? "四半期" : "年次"}
                  </button>
                ))}
              </div>
            }
          >
            <div className="h-[280px]">
              <AreaChart
                data={chartData.map((m) => ({
                  month: m.label,
                  売上: m.revenue,
                  粗利: m.grossProfit,
                  売上総利益: m.grossProfitTotal,
                }))}
                labelKey="month"
                height={280}
                gridColor={TEAL[50]}
                labelColor={TEAL[500]}
                tickColor={TEAL[500]}
                unit="万"
                series={[
                  { key: "売上", label: "売上", color: TEAL[700] },
                  { key: "粗利", label: "粗利", color: TEAL[500] },
                  { key: "売上総利益", label: "売上総利益", color: TEAL[300] },
                ]}
                formatValue={(v) => `${v < 0 ? "▲" : ""}¥${Math.abs(v).toLocaleString()}万`}
              />
            </div>
          </BiPanel>

          <BiPanel
            title="着地予測（期末見込み）"
            description="期首予算と、分析設定で定義した着地パターンを比較"
            flush
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-[#D8EDE4]/30 text-xs">
                    <th className="text-left px-5 py-3 font-medium text-slate-500 whitespace-nowrap">指標</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500 whitespace-nowrap">期首予算</th>
                    {forecastTiers.map((tier) => (
                      <th key={tier.id} className="text-right px-4 py-3 font-medium text-slate-500 whitespace-nowrap last:px-5">
                        {tier.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const rows = [
                      { label: "全社売上", budget: targetRevenue, showRate: false, pick: (t: typeof forecastTiers[0]) => t.revenue },
                      { label: "粗利額", budget: targetGp, showRate: true, pick: (t: typeof forecastTiers[0]) => t.grossProfit, baseBudget: targetRevenue, basePick: (t: typeof forecastTiers[0]) => t.revenue },
                      { label: "売上総利益", budget: targetGp - overheadBudget, showRate: true, pick: (t: typeof forecastTiers[0]) => t.grossProfit - overheadBudget, baseBudget: targetRevenue, basePick: (t: typeof forecastTiers[0]) => t.revenue },
                      { label: "営業利益", budget: targetGp - overheadBudget - sgaBudget, showRate: true, pick: (t: typeof forecastTiers[0]) => t.grossProfit - overheadBudget - sgaBudget, baseBudget: targetRevenue, basePick: (t: typeof forecastTiers[0]) => t.revenue },
                    ];
                    return rows.map((row, idx) => {
                      const cell = (val: number, rate?: number) => (
                        <div>
                          <span
                            className={cn(
                              "text-sm font-semibold tabular-nums",
                              val < 0 ? "text-rose-500" : "text-slate-900",
                            )}
                          >{fmtSigned(val)}</span>
                          {rate !== undefined && (
                            <span className="text-[11px] text-slate-400 ml-1.5">
                              (<span className={val >= 0 ? "text-[#0F5132]" : "text-rose-500"}>{r1(Math.abs(rate))}%</span>)
                            </span>
                          )}
                        </div>
                      );
                      return (
                        <tr key={idx} className="border-b last:border-0 hover:bg-[#D8EDE4]/20">
                          <td className="px-5 py-3 font-medium">{row.label}</td>
                          <td className="text-right px-4 py-3">{cell(row.budget, row.showRate && row.baseBudget ? pct(row.budget, row.baseBudget) : undefined)}</td>
                          {forecastTiers.map((tier) => {
                            const val = row.pick(tier);
                            const base = row.basePick?.(tier);
                            return (
                              <td key={tier.id} className="text-right px-4 py-3 last:px-5">
                                {cell(val, row.showRate && base ? pct(val, base) : undefined)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    });
                  })()}
                  <tr className="bg-[#D8EDE4]/40 border-t-2">
                    <td className="px-5 py-3 text-xs font-medium text-slate-500">売上達成率</td>
                    <td className="text-right px-4 py-3 text-sm font-bold text-[#0F5132]">100%</td>
                    {forecastTiers.map((tier) => (
                      <td key={tier.id} className="text-right px-4 py-3 text-sm font-bold text-[#0F5132] last:px-5">
                        {pct(tier.revenue, targetRevenue)}%
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </BiPanel>

          <div className="flex items-start gap-2 text-xs text-slate-500 bg-[#D8EDE4]/30 border border-[#A8D4BC]/40 rounded-xl p-3.5">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#2A8055]" />
            <span>
              売上総利益のマイナスは<strong className="text-[#0F5132]">仕様です</strong>。粗利の積み上げが製造間接費（年額 ¥{overheadBudget.toLocaleString()}万）を超えるまで赤字表示となり、損益分岐点までの距離を示します。
            </span>
          </div>
        </TabsContent>

        <TabsContent value="dept" className="space-y-4 mt-0">

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {deptActuals.map((d, i) => {
              const target = deptTargetMap[d.name] ?? 1000;
              const rate   = pct(d.revenue, target);
              const gpRate = pct(d.grossProfit, d.revenue);
              const deptSga = totalRevenue > 0 ? Math.round(sgaBudget * (d.revenue / totalRevenue)) : 0;
              const deptOp  = d.grossProfit - deptSga;
              return (
                <div key={d.name} className={cn(TEAL_CARD, "p-4 flex flex-col gap-2")}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] text-slate-400">{d.label}</p>
                      <p className={cn("text-sm font-semibold", TEAL_TITLE)}>{d.name}</p>
                    </div>
                    <span
                      className={cn(
                        "text-[11px] font-bold px-2 py-0.5 rounded-md",
                        rate >= 30
                          ? "bg-[#D8EDE4] text-[#0F5132]"
                          : "bg-amber-50 text-amber-700",
                      )}
                    >
                      {rate}%
                    </span>
                  </div>
                  <p className="text-xl font-black tabular-nums tracking-tight text-slate-900">¥{d.revenue.toLocaleString()}万</p>
                  <p className="text-[11px] text-slate-400">目標 ¥{target.toLocaleString()}万</p>
                  <div className="h-1.5 bg-[#D8EDE4] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(rate, 100)}%`, background: TEAL_WON_GRADIENT }}
                    />
                  </div>
                  <div className="space-y-1.5 pt-1 border-t border-slate-100">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">粗利率</span>
                      <span className="font-semibold text-slate-700">{gpRate}%</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">粗利額</span>
                      <span className="font-semibold text-slate-700">¥{d.grossProfit.toLocaleString()}万</span>
                    </div>
                    {showTheoretical && (
                      <div className="flex justify-between text-[11px] pt-1 border-t border-slate-100">
                        <span className="text-slate-400">営業利益(理論)</span>
                        <span className={cn("font-semibold", deptOp < 0 ? "text-rose-500" : "text-[#0F5132]")}>
                          {fmtSigned(deptOp)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {monthlyByDept.length > 0 && (
            <BiPanel
              title="部門別 月次推移"
              description="製造間接費は当月の売上構成比で部門按分（§3.3）"
            >
              <div className="h-[280px]">
                <AreaChart
                  data={monthlyActuals.map((m, i) => {
                    const row: Record<string, string | number> = { month: m.month };
                    for (const dept of monthlyByDept) {
                      row[dept.name] = dept.months[i]?.grossProfitTotal ?? 0;
                    }
                    return row;
                  })}
                  labelKey="month"
                  height={280}
                  gridColor={TEAL[50]}
                  labelColor={TEAL[500]}
                  tickColor={TEAL[500]}
                  unit="万"
                  series={monthlyByDept.map((dept, i) => ({
                    key: dept.name,
                    label: dept.name,
                    color: DEPT_CHART_COLORS[i % DEPT_CHART_COLORS.length],
                  }))}
                  formatValue={(v) => `${v < 0 ? "▲" : ""}¥${Math.abs(v).toLocaleString()}万`}
                />
              </div>
            </BiPanel>
          )}

          <BiPanel title="部門別 売上・粗利比較" description="目標と実績の対比">
            <div className="h-[260px]">
              <GroupedBarChart
                data={deptActuals.map((d) => ({
                  name: d.name,
                  目標: deptTargetMap[d.name] ?? 1000,
                  売上: d.revenue,
                  粗利: d.grossProfit,
                }))}
                labelKey="name"
                idPrefix="bi-dept-compare"
                height={260}
                gridColor={TEAL[50]}
                labelColor={TEAL[500]}
                tickColor={TEAL[500]}
                series={[
                  { key: "目標", label: "目標", fill: TEAL[50] },
                  { key: "売上", label: "売上", fill: TEAL[700] },
                  { key: "粗利", label: "粗利", fill: TEAL[500] },
                ]}
                formatValue={(v) => `¥${v.toLocaleString()}万`}
              />
            </div>
          </BiPanel>

          <BiPanel
            title="部門別詳細"
            description="部門ごとの達成率・粗利率・営業利益（理論値）"
            headerRight={
              <div className="flex items-center gap-2">
                <Switch id="theoretical" checked={showTheoretical} onCheckedChange={setShowTheoretical} />
                <Label htmlFor="theoretical" className="text-xs text-slate-500 cursor-pointer">理論値を表示</Label>
              </div>
            }
            flush
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-[#D8EDE4]/30">
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 whitespace-nowrap">部門</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 whitespace-nowrap">売上 / 目標</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 whitespace-nowrap">達成率</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 whitespace-nowrap">粗利率</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 whitespace-nowrap">粗利額</th>
                    {showTheoretical && <>
                      <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 whitespace-nowrap">販管費 <span className="opacity-50">理論</span></th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 whitespace-nowrap">営業利益 <span className="opacity-50">理論</span></th>
                    </>}
                  </tr>
                </thead>
                <tbody>
                  {deptActuals.map((d, i) => {
                    const target  = deptTargetMap[d.name] ?? 1000;
                    const rate    = pct(d.revenue, target);
                    const gpRate  = pct(d.grossProfit, d.revenue);
                    const deptSga = totalRevenue > 0 ? Math.round(sgaBudget * (d.revenue / totalRevenue)) : 0;
                    const deptOp  = d.grossProfit - deptSga;
                    return (
                      <tr key={i} className="border-b last:border-0 hover:bg-[#D8EDE4]/20 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: DEPT_CHART_COLORS[i % DEPT_CHART_COLORS.length] }} />
                            <div>
                              <div className="font-medium text-slate-800">{d.name}</div>
                              <div className="text-[11px] text-slate-400">{d.label}</div>
                            </div>
                          </div>
                        </td>
                        <td className="text-right px-4 py-3.5 tabular-nums">
                          <span className="font-semibold">¥{d.revenue.toLocaleString()}万</span>
                          <span className="text-slate-400 text-xs"> / ¥{target.toLocaleString()}万</span>
                        </td>
                        <td className="text-right px-4 py-3.5">
                          <div className="inline-flex flex-col items-end gap-1">
                            <span className={cn("font-semibold", rate >= 30 ? "text-[#0F5132]" : "text-amber-600")}>{rate}%</span>
                            <div className="h-1 w-14 rounded-full bg-[#D8EDE4] overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${Math.min(rate, 100)}%`, background: TEAL_WON_GRADIENT }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="text-right px-4 py-3.5 tabular-nums text-slate-500">{gpRate}%</td>
                        <td className="text-right px-4 py-3.5 tabular-nums font-semibold">¥{d.grossProfit.toLocaleString()}万</td>
                        {showTheoretical && <>
                          <td className="text-right px-4 py-3.5 tabular-nums text-rose-500 text-xs">▲¥{deptSga.toLocaleString()}万</td>
                          <td className={cn("text-right px-5 py-3.5 tabular-nums font-semibold", deptOp < 0 ? "text-rose-500" : "text-[#0F5132]")}>
                            {fmtSigned(deptOp)}
                          </td>
                        </>}
                      </tr>
                    );
                  })}
                  <tr className="bg-[#D8EDE4]/40 border-t-2 font-semibold">
                    <td className="px-5 py-3">全社合計</td>
                    <td className="text-right px-4 py-3 tabular-nums">
                      ¥{totalRevenue.toLocaleString()}万
                      <span className="text-slate-400 font-normal text-xs"> / ¥{targetRevenue.toLocaleString()}万</span>
                    </td>
                    <td className="text-right px-4 py-3 text-[#0F5132]">{achieveRateTotal}%</td>
                    <td className="text-right px-4 py-3 tabular-nums text-slate-500">{grossProfitRate}%</td>
                    <td className="text-right px-4 py-3 tabular-nums">¥{totalGrossProfit.toLocaleString()}万</td>
                    {showTheoretical && <>
                      <td className="text-right px-4 py-3 tabular-nums text-rose-500">▲¥{sgaBudget.toLocaleString()}万</td>
                      <td className={cn("text-right px-5 py-3 tabular-nums font-semibold", operatingProfit < 0 ? "text-rose-500" : "text-[#0F5132]")}>
                        {fmtSigned(operatingProfit)}
                      </td>
                    </>}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="px-5 pb-4 pt-3 text-[11px] text-slate-400 flex items-start gap-1.5">
              <Info className="h-3 w-3 shrink-0 mt-0.5 text-[#2A8055]" />
              販管費・営業利益は売上構成比による按分で算出した理論値です（§3.1）。製造間接費は全社レベルで一括控除します。
            </p>
          </BiPanel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

