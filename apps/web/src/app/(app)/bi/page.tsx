"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  PieChart as PieIcon,
  Info,
  Settings2,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
} from "lucide-react";
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  BarChart,
  LabelList,
  ReferenceLine,
  AreaChart,
  Area,
} from "recharts";
import { getBiSettings, getBiActuals } from "@/lib/actions/bi";
import type { BiAnnualSettings, BiActuals } from "@/lib/bi-types";
import { getCurrentFiscalYear, fiscalYearLabel, DEFAULT_DEPARTMENTS } from "@/lib/bi-utils";
import { aggregateChartPeriods, type PeriodGranularity } from "@/lib/bi-config";
import { BiSettingsDialog } from "@/components/bi/bi-settings-dialog";

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

// ── アクセントカラー選択肢 ────────────────────────────────────────────
const ACCENT_COLORS = [
  { key: "emerald", color: "#10b981", label: "グリーン" },
  { key: "blue",    color: "#3b82f6", label: "ブルー"   },
  { key: "sky",     color: "#0ea5e9", label: "スカイ"   },
  { key: "teal",    color: "#14b8a6", label: "ティール" },
  { key: "violet",  color: "#8b5cf6", label: "バイオレット" },
  { key: "rose",    color: "#f43f5e", label: "ローズ"   },
  { key: "amber",   color: "#f59e0b", label: "アンバー" },
  { key: "black",   color: "#18181b", label: "ブラック" },
];

// ── ユーティリティ ────────────────────────────────────────────────────
function r1(v: number) { return Math.round(v * 10) / 10; }
function pct(part: number, whole: number) { return whole > 0 ? r1((part / whole) * 100) : 0; }
function fmtMan(v: number) { return `¥${Math.abs(v).toLocaleString()}万`; }
function fmtSigned(v: number) { return v < 0 ? `▲${fmtMan(v)}` : fmtMan(v); }

// ── カラーパレット ────────────────────────────────────────────────────
function KpiColorBar({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="hidden sm:flex items-center gap-1.5 bg-background/60 border border-border/50 rounded-lg px-2 py-1">
      {ACCENT_COLORS.map(({ key, color, label }) => (
        <button
          key={key}
          title={label}
          onClick={() => onChange(color)}
          className="w-4 h-4 rounded-full border-2 transition-transform hover:scale-110"
          style={{
            backgroundColor: color,
            borderColor: value === color ? "#fff" : "transparent",
            boxShadow: value === color ? `0 0 0 2px ${color}` : "none",
          }}
        />
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// KPIカード（大）
// ────────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, delta, deltaPositive, negative, sparkData, accentColor }: {
  label: string;
  value: string;
  sub?: string;
  delta?: string;
  deltaPositive?: boolean;
  negative?: boolean;
  sparkData?: number[];
  accentColor: string;
}) {
  const data = (sparkData ?? []).map((v, i) => ({ i, v }));
  const positiveColor = accentColor;
  const negativeColor = "#8b5cf6";
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {delta && (
            <span
              className="inline-flex items-center gap-0.5 text-[11px] font-semibold"
              style={{ color: deltaPositive ? positiveColor : negativeColor }}
            >
              {deltaPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {delta}
            </span>
          )}
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p
              className="text-2xl font-bold tabular-nums tracking-tight leading-none"
              style={{ color: negative ? negativeColor : "var(--foreground)" }}
            >
              {value}
            </p>
            {sub && <p className="text-[11px] text-muted-foreground mt-1.5">{sub}</p>}
          </div>
          {data.length > 0 && (
            <div className="w-20 h-10 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id={`g-${label}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={negative ? negativeColor : positiveColor} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={negative ? negativeColor : positiveColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke={negative ? negativeColor : positiveColor} strokeWidth={1.5} fill={`url(#g-${label})`} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────
// メイン
// ────────────────────────────────────────────────────────────────────
export default function BiDashboardPage() {
  const searchParams = useSearchParams();
  const [showTheoretical, setShowTheoretical] = useState(true);
  const [settings, setSettings] = useState<BiAnnualSettings | null>(null);
  const [actuals, setActuals] = useState<BiActuals | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accentColor, setAccentColor] = useState("#10b981");
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

  useEffect(() => {
    loadBiData();
  }, [loadBiData]);

  const deptActuals = actuals?.deptActuals ?? FALLBACK_DEPT_ACTUALS;
  const monthlyActuals = actuals?.monthly ?? FALLBACK_MONTHLY;
  const monthlyOverheadAllocations = actuals?.monthlyOverheadAllocations ?? Array(12).fill(Math.round((settings?.overhead_budget ?? 1200) / 12));
  const monthlyByDept = actuals?.monthlyByDept ?? [];
  const forecastTiers = actuals?.forecastTiers ?? FALLBACK_FORECAST_TIERS;
  const sparklines = actuals?.sparklines;
  const deltas = actuals?.deltas;
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
  const gpRateDelta = deltas?.grossProfitRatePt;
  const gpRateDeltaLabel = gpRateDelta != null
    ? `${gpRateDelta >= 0 ? "+" : ""}${gpRateDelta}pt`
    : undefined;

  // ── P&L ウォーターフォールデータ ──
  const plData = [
    { name: "売上",       value: totalRevenue,     fill: "#18181b" },
    { name: "粗利額",     value: totalGrossProfit, fill: "#71717a" },
    { name: "製造間接費", value: -overheadBudget,  fill: "#8b5cf6" },
    { name: "売上総利益", value: grossProfitTotal, fill: grossProfitTotal >= 0 ? "#18181b" : "#8b5cf6" },
    { name: "販管費",     value: -sgaBudget,       fill: "#8b5cf6" },
    { name: "営業利益",   value: operatingProfit,  fill: operatingProfit >= 0 ? "#18181b" : "#8b5cf6" },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto">

      {/* ────────── ページヘッダー ────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">BIダッシュボード</h1>
          <p className="text-sm text-muted-foreground mt-1">{fiscalYearLabel(fiscalYear)} ・ 経営指標の可視化</p>
        </div>
        <div className="flex items-center gap-2">
          <KpiColorBar value={accentColor} onChange={setAccentColor} />
          <Badge variant="outline" className="text-xs">{hasRealData ? "実績データ" : "実績未登録"}</Badge>
          {hasDbSettings && <Badge variant="secondary" className="text-xs">設定済</Badge>}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="h-3.5 w-3.5" />期首設定
          </Button>
        </div>
      </div>

      <BiSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSaved={loadBiData}
      />

      <Tabs defaultValue="summary" className="space-y-6">
        <TabsList>
          <TabsTrigger value="summary" className="gap-1.5">
            <LayoutDashboard className="h-3.5 w-3.5" />全社サマリー
          </TabsTrigger>
          <TabsTrigger value="dept" className="gap-1.5">
            <PieIcon className="h-3.5 w-3.5" />部門別
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════
            全社サマリー（§6.2）
        ══════════════════════════════════════════════ */}
        <TabsContent value="summary" className="space-y-6 mt-0">

          {/* ──── 1段目：KPI 4枚 ──── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="売上実績"
              value={fmtMan(totalRevenue)}
              sub={`目標 ${fmtMan(targetRevenue)} ・ 達成率 ${achieveRateTotal}%`}
              delta={`${achieveRateTotal}%`}
              deltaPositive={achieveRateTotal >= 50}
              sparkData={hasRealData ? sparklines?.revenue : undefined}
              accentColor={accentColor}
            />
            <KpiCard
              label="粗利率"
              value={`${grossProfitRate}%`}
              sub={`粗利額 ${fmtMan(totalGrossProfit)}`}
              delta={gpRateDeltaLabel}
              deltaPositive={gpRateDelta == null || gpRateDelta >= 0}
              sparkData={hasRealData ? sparklines?.grossProfitRate : undefined}
              accentColor={accentColor}
            />
            <KpiCard
              label="売上総利益"
              value={fmtSigned(grossProfitTotal)}
              sub={`売上比 ${r1(Math.abs(gptRate))}% ・ 期首予算控除後`}
              delta={`${r1(Math.abs(gptRate))}%`}
              deltaPositive={grossProfitTotal >= 0}
              negative={grossProfitTotal < 0}
              sparkData={hasRealData ? sparklines?.grossProfitTotal : undefined}
              accentColor={accentColor}
            />
            <KpiCard
              label="営業利益"
              value={fmtSigned(operatingProfit)}
              sub={`売上比 ${r1(Math.abs(opRate))}% ・ 販管費控除後`}
              delta={`${r1(Math.abs(opRate))}%`}
              deltaPositive={operatingProfit >= 0}
              negative={operatingProfit < 0}
              sparkData={hasRealData ? sparklines?.operatingProfit : undefined}
              accentColor={accentColor}
            />
          </div>

          {/* ──── 2段目：P&Lフロー / 目標vs実績 ──── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">

            {/* P&L ウォーターフォール */}
            <Card className="lg:col-span-2 flex flex-col">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div>
                  <CardTitle className="text-base font-semibold">損益フロー（P&L）</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">売上 → 粗利 → 売上総利益 → 営業利益</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 -mr-1 -mt-1">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="pb-4 flex-1 flex flex-col">
                <ResponsiveContainer width="100%" height="100%" minHeight={260}>
                  <BarChart data={plData} margin={{ top: 24, right: 12, bottom: 4, left: 0 }} barSize={44}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} unit="万" axisLine={false} tickLine={false} width={50} />
                    <RTooltip
                      formatter={(v) => [`${Number(v) < 0 ? "▲" : ""}¥${Math.abs(Number(v)).toLocaleString()}万`, ""]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                    />
                    <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {plData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      <LabelList
                        dataKey="value"
                        position="top"
                        style={{ fontSize: 10, fontWeight: 600, fill: "#475569" }}
                        formatter={(v: unknown) => { const n = Number(v); return `${n < 0 ? "▲" : ""}${Math.abs(n).toLocaleString()}`; }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 目標 vs 実績（円グラフ） */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">目標 vs 実績</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">期首予算との対比</p>
              </CardHeader>
              <CardContent className="pb-5">
                {/* 円グラフ 2つ並べる */}
                <div className="flex items-center justify-around py-3">
                  <CircularProgress
                    value={pct(totalRevenue, targetRevenue)}
                    size={130}
                    strokeWidth={11}
                    color={accentColor}
                    label="売上"
                    actual={`¥${totalRevenue.toLocaleString()}万`}
                    target={`¥${targetRevenue.toLocaleString()}万`}
                  />
                  <CircularProgress
                    value={pct(totalGrossProfit, targetGp)}
                    size={130}
                    strokeWidth={11}
                    color={accentColor}
                    label="粗利額"
                    actual={`¥${totalGrossProfit.toLocaleString()}万`}
                    target={`¥${targetGp.toLocaleString()}万`}
                  />
                </div>

                {/* 固定費サマリー */}
                <div className="mt-3 rounded-xl bg-muted/40 p-3 space-y-2.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">固定費控除</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-violet-400 shrink-0" />
                      <span className="text-xs text-muted-foreground">製造間接費</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-violet-500">▲¥{overheadBudget.toLocaleString()}万</span>
                      <span className="text-[10px] text-muted-foreground ml-1.5">/ 月{Math.round(overheadBudget/12).toLocaleString()}万</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-violet-300 shrink-0" />
                      <span className="text-xs text-muted-foreground">販管費予算</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-violet-500">▲¥{sgaBudget.toLocaleString()}万</span>
                      <span className="text-[10px] text-muted-foreground ml-1.5">/ 月{Math.round(sgaBudget/12).toLocaleString()}万</span>
                    </div>
                  </div>
                  {/* 達成率まとめバー */}
                  <div className="pt-1.5 border-t border-border/40">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>売上達成率</span>
                      <span style={{ color: accentColor }} className="font-bold">{pct(totalRevenue, targetRevenue)}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(pct(totalRevenue, targetRevenue), 100)}%`, background: accentColor }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ──── 3段目：月別推移（§6.3） ──── */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-base font-semibold">月別推移</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">売上 / 粗利 / 売上総利益（按分後）の推移</p>
              </div>
              <div className="inline-flex items-center rounded-md border border-border bg-background p-0.5 text-[11px]">
                {(["month", "quarter", "year"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setChartPeriod(p)}
                    className={`px-2.5 py-1 rounded-sm transition ${
                      chartPeriod === p
                        ? "bg-foreground text-background font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p === "month" ? "月次" : p === "quarter" ? "四半期" : "年次"}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="pb-5">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart
                  data={chartData.map((m) => ({
                    month: m.label,
                    売上: m.revenue,
                    粗利: m.grossProfit,
                    売上総利益: m.grossProfitTotal,
                  }))}
                  margin={{ top: 12, right: 16, bottom: 0, left: 0 }}
                >
                  <defs>
                    <linearGradient id="grad-revenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#8b5cf6" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="grad-gp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#a78bfa" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="grad-gpt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#c4b5fd" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#c4b5fd" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} padding={{ left: 8, right: 8 }} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} unit="万" axisLine={false} tickLine={false} width={50} />
                  <RTooltip
                    formatter={(v, n) => [`${Number(v) < 0 ? "▲" : ""}¥${Math.abs(Number(v)).toLocaleString()}万`, n]}
                    contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}
                    cursor={{ stroke: "#cbd5e1", strokeWidth: 1, strokeDasharray: "3 3" }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                    iconType="circle"
                    iconSize={8}
                    formatter={(v) => <span className="text-muted-foreground ml-1 mr-3">{v}</span>}
                  />
                  <Area type="monotone" dataKey="売上"       stroke="#8b5cf6" strokeWidth={2}   fill="url(#grad-revenue)" />
                  <Area type="monotone" dataKey="粗利"       stroke="#a78bfa" strokeWidth={1.8} fill="url(#grad-gp)" />
                  <Area type="monotone" dataKey="売上総利益" stroke="#c4b5fd" strokeWidth={1.8} fill="url(#grad-gpt)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* ──── 4段目：着地予測（§6.4） ──── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">着地予測（期末見込み）</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">期首予算と、分析設定で定義した着地パターンを比較</p>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-xs">
                      <th className="text-left  px-5 py-3 font-medium text-muted-foreground whitespace-nowrap">指標</th>
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
                        { label: "全社売上", budget: targetRevenue, showRate: false, pick: (t: typeof forecastTiers[0]) => t.revenue },
                        { label: "粗利額", budget: targetGp, showRate: true, pick: (t: typeof forecastTiers[0]) => t.grossProfit, baseBudget: targetRevenue, basePick: (t: typeof forecastTiers[0]) => t.revenue },
                        { label: "売上総利益", budget: targetGp - overheadBudget, showRate: true, pick: (t: typeof forecastTiers[0]) => t.grossProfit - overheadBudget, baseBudget: targetRevenue, basePick: (t: typeof forecastTiers[0]) => t.revenue },
                        { label: "営業利益", budget: targetGp - overheadBudget - sgaBudget, showRate: true, pick: (t: typeof forecastTiers[0]) => t.grossProfit - overheadBudget - sgaBudget, baseBudget: targetRevenue, basePick: (t: typeof forecastTiers[0]) => t.revenue },
                      ];
                      return rows.map((row, idx) => {
                        const cell = (val: number, rate?: number) => (
                          <div>
                            <span
                              className="text-sm font-semibold tabular-nums"
                              style={{ color: val < 0 ? "#8b5cf6" : "var(--foreground)" }}
                            >{fmtSigned(val)}</span>
                            {rate !== undefined && (
                              <span className="text-[11px] text-muted-foreground ml-1.5">
                                (<span style={{ color: val >= 0 ? accentColor : "#8b5cf6" }}>{r1(Math.abs(rate))}%</span>)
                              </span>
                            )}
                          </div>
                        );
                        return (
                          <tr key={idx} className="border-b last:border-0 hover:bg-muted/20">
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
                    <tr className="bg-muted/40 border-t-2">
                      <td className="px-5 py-3 text-xs font-medium text-muted-foreground">売上達成率</td>
                      <td className="text-right px-4 py-3 text-sm font-bold">100%</td>
                      {forecastTiers.map((tier) => (
                        <td key={tier.id} className="text-right px-4 py-3 text-sm font-bold last:px-5">
                          {pct(tier.revenue, targetRevenue)}%
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 注記 */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 border border-border/50 rounded-lg p-3.5">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              売上総利益のマイナスは<strong className="text-foreground">仕様です</strong>。粗利の積み上げが製造間接費（年額 ¥{overheadBudget.toLocaleString()}万）を超えるまで赤字表示となり、損益分岐点までの距離を示します。
            </span>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════
            部門別（§6.1）
        ══════════════════════════════════════════════ */}
        <TabsContent value="dept" className="space-y-6 mt-0">

          {/* 部門 KPI カード */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {deptActuals.map((d, i) => {
              const target = deptTargetMap[d.name] ?? 1000;
              const rate   = pct(d.revenue, target);
              const gpRate = pct(d.grossProfit, d.revenue);
              const deptSga = totalRevenue > 0 ? Math.round(sgaBudget * (d.revenue / totalRevenue)) : 0;
              const deptOp  = d.grossProfit - deptSga;
              return (
                <Card key={d.name}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-[11px] text-muted-foreground">{d.label}</p>
                        <p className="text-sm font-semibold">{d.name}</p>
                      </div>
                      <span
                        className="text-[11px] font-bold px-2 py-0.5 rounded-md"
                        style={rate >= 30
                          ? { backgroundColor: accentColor, color: "#fff" }
                          : { backgroundColor: "#f5f3ff", color: "#7c3aed" }
                        }
                      >
                        {rate}%
                      </span>
                    </div>
                    <p className="text-2xl font-bold tabular-nums tracking-tight">¥{d.revenue.toLocaleString()}万</p>
                    <p className="text-[11px] text-muted-foreground mt-1 mb-3">目標 ¥{target.toLocaleString()}万</p>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(rate, 100)}%`, backgroundColor: accentColor }} />
                    </div>
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">粗利率</span>
                        <span className="font-semibold">{gpRate}%</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">粗利額</span>
                        <span className="font-semibold">¥{d.grossProfit.toLocaleString()}万</span>
                      </div>
                      {showTheoretical && (
                        <div className="flex justify-between text-[11px] pt-1 border-t border-border/40">
                          <span className="text-muted-foreground">営業利益(理論)</span>
                          <span
                            className="font-semibold"
                            style={{ color: deptOp < 0 ? "#8b5cf6" : accentColor }}
                          >{fmtSigned(deptOp)}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* 部門別月次推移（§3.3 売上構成比按分） */}
          {monthlyByDept.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">部門別 月次推移</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">製造間接費は当月の売上構成比で部門按分（§3.3）</p>
              </CardHeader>
              <CardContent className="pb-5">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart
                    data={monthlyActuals.map((m, i) => {
                      const row: Record<string, string | number> = { month: m.month };
                      for (const dept of monthlyByDept) {
                        row[dept.name] = dept.months[i]?.grossProfitTotal ?? 0;
                      }
                      return row;
                    })}
                    margin={{ top: 12, right: 16, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} unit="万" axisLine={false} tickLine={false} width={50} />
                    <RTooltip
                      formatter={(v, n) => [`${Number(v) < 0 ? "▲" : ""}¥${Math.abs(Number(v)).toLocaleString()}万`, n]}
                      contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e2e8f0" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} iconType="circle" iconSize={8} />
                    {monthlyByDept.map((dept, i) => (
                      <Area
                        key={dept.name}
                        type="monotone"
                        dataKey={dept.name}
                        stroke={["#8b5cf6", "#6366f1", "#0ea5e9", "#10b981"][i % 4]}
                        fill={["#8b5cf6", "#6366f1", "#0ea5e9", "#10b981"][i % 4]}
                        fillOpacity={0.15}
                        strokeWidth={1.8}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* 部門比較グラフ */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">部門別 売上・粗利比較</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">目標と実績の対比</p>
            </CardHeader>
            <CardContent className="pb-5">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={deptActuals.map((d) => ({
                    name: d.name,
                    目標: deptTargetMap[d.name] ?? 1000,
                    売上: d.revenue,
                    粗利: d.grossProfit,
                  }))}
                  margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                  barCategoryGap="25%"
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} unit="万" axisLine={false} tickLine={false} width={50} />
                  <RTooltip formatter={(v) => [`¥${Number(v).toLocaleString()}万`]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" iconSize={8} />
                  <Bar dataKey="目標" fill="#e5e7eb" radius={[3,3,0,0]} />
                  <Bar dataKey="売上" fill="#18181b" radius={[3,3,0,0]} />
                  <Bar dataKey="粗利" fill="#a1a1aa" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 部門別詳細テーブル */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base font-semibold">部門別詳細</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">部門ごとの達成率・粗利率・営業利益（理論値）</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="theoretical" checked={showTheoretical} onCheckedChange={setShowTheoretical} />
                  <Label htmlFor="theoretical" className="text-xs text-muted-foreground cursor-pointer">理論値を表示</Label>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left  px-5 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">部門</th>
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
                      const target  = deptTargetMap[d.name] ?? 1000;
                      const rate    = pct(d.revenue, target);
                      const gpRate  = pct(d.grossProfit, d.revenue);
                      const deptSga = totalRevenue > 0 ? Math.round(sgaBudget * (d.revenue / totalRevenue)) : 0;
                      const deptOp  = d.grossProfit - deptSga;
                      return (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-2 h-2 rounded-full bg-foreground" style={{ opacity: 1 - i * 0.18 }} />
                              <div>
                                <div className="font-medium">{d.name}</div>
                                <div className="text-[11px] text-muted-foreground">{d.label}</div>
                              </div>
                            </div>
                          </td>
                          <td className="text-right px-4 py-3.5 tabular-nums">
                            <span className="font-semibold">¥{d.revenue.toLocaleString()}万</span>
                            <span className="text-muted-foreground text-xs"> / ¥{target.toLocaleString()}万</span>
                          </td>
                          <td className="text-right px-4 py-3.5">
                            <div className="inline-flex flex-col items-end gap-1">
                              <span className="font-semibold" style={{ color: rate >= 30 ? accentColor : "#d97706" }}>{rate}%</span>
                              <div className="h-1 w-14 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(rate,100)}%`, backgroundColor: accentColor }} />
                              </div>
                            </div>
                          </td>
                          <td className="text-right px-4 py-3.5 tabular-nums text-muted-foreground">{gpRate}%</td>
                          <td className="text-right px-4 py-3.5 tabular-nums font-semibold">¥{d.grossProfit.toLocaleString()}万</td>
                          {showTheoretical && <>
                            <td className="text-right px-4 py-3.5 tabular-nums text-violet-500 text-xs">▲¥{deptSga.toLocaleString()}万</td>
                            <td className="text-right px-5 py-3.5 tabular-nums font-semibold" style={{ color: deptOp < 0 ? "#8b5cf6" : accentColor }}>{fmtSigned(deptOp)}</td>
                          </>}
                        </tr>
                      );
                    })}
                    <tr className="bg-muted/40 border-t-2 font-semibold">
                      <td className="px-5 py-3">全社合計</td>
                      <td className="text-right px-4 py-3 tabular-nums">
                        ¥{totalRevenue.toLocaleString()}万
                        <span className="text-muted-foreground font-normal text-xs"> / ¥{targetRevenue.toLocaleString()}万</span>
                      </td>
                      <td className="text-right px-4 py-3">{achieveRateTotal}%</td>
                      <td className="text-right px-4 py-3 tabular-nums text-muted-foreground">{grossProfitRate}%</td>
                      <td className="text-right px-4 py-3 tabular-nums">¥{totalGrossProfit.toLocaleString()}万</td>
                      {showTheoretical && <>
                        <td className="text-right px-4 py-3 tabular-nums text-violet-500">▲¥{sgaBudget.toLocaleString()}万</td>
                        <td className="text-right px-5 py-3 tabular-nums font-semibold" style={{ color: operatingProfit < 0 ? "#8b5cf6" : accentColor }}>{fmtSigned(operatingProfit)}</td>
                      </>}
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="px-5 pb-4 pt-3 text-[11px] text-muted-foreground flex items-start gap-1.5">
                <Info className="h-3 w-3 shrink-0 mt-0.5" />
                販管費・営業利益は売上構成比による按分で算出した理論値です（§3.1）。製造間接費は全社レベルで一括控除します。
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
