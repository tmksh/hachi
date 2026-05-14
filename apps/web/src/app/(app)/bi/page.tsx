"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  LayoutDashboard,
  PieChart,
  BarChart3,
  Info,
  ArrowRight,
} from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  RadialBarChart,
  RadialBar,
} from "recharts";

// ── サンプルデータ（PDF UIイメージ準拠） ──────────────────────────────
const COMPANY_SUMMARY = {
  fiscalYear: "R8年度",
  targetRevenue: 10000,
  actualRevenue: 2850,
  grossProfit: 826,
  grossProfitRate: 29.0,
  overheadBudget: -1200,
  grossProfitTotal: -374,
  grossProfitTotalRate: -13.1,
  sgaBudget: -600,
  operatingProfit: -974,
  operatingProfitRate: -34.2,
};

const DEPARTMENTS = [
  { name: "一般住宅", label: "A部門", revenue: 1200, target: 4000, grossProfitRate: 22.2, grossProfit: 267, sga: -253, operatingProfit: 14 },
  { name: "新築",     label: "B部門", revenue: 800,  target: 3000, grossProfitRate: 38.3, grossProfit: 306, sga: -168, operatingProfit: 138 },
  { name: "公共工事", label: "C部門", revenue: 550,  target: 2000, grossProfitRate: 14.7, grossProfit: 81,  sga: -116, operatingProfit: -35 },
  { name: "リフォーム",label:"D部門", revenue: 300,  target: 1000, grossProfitRate: 30.5, grossProfit: 92,  sga: -63,  operatingProfit: 28 },
];

const MONTHLY_DATA = [
  { month: "4月",  revenue: 420, grossProfit: 122, overhead: -100, grossProfitTotal: 22,  cumulative: 22  },
  { month: "5月",  revenue: 380, grossProfit: 110, overhead: -100, grossProfitTotal: 10,  cumulative: 32  },
  { month: "6月",  revenue: 250, grossProfit: 72,  overhead: -100, grossProfitTotal: -28, cumulative: 4   },
  { month: "7月",  revenue: 600, grossProfit: 174, overhead: -100, grossProfitTotal: 74,  cumulative: 78  },
  { month: "8月",  revenue: 520, grossProfit: 151, overhead: -100, grossProfitTotal: 51,  cumulative: 129 },
  { month: "9月",  revenue: 680, grossProfit: 197, overhead: -100, grossProfitTotal: 97,  cumulative: 226 },
  { month: "10月", revenue: null, grossProfit: null, overhead: null, grossProfitTotal: null, cumulative: null, forecast: true },
  { month: "11月", revenue: null, grossProfit: null, overhead: null, grossProfitTotal: null, cumulative: null, forecast: true },
  { month: "12月", revenue: null, grossProfit: null, overhead: null, grossProfitTotal: null, cumulative: null, forecast: true },
  { month: "1月",  revenue: null, grossProfit: null, overhead: null, grossProfitTotal: null, cumulative: null, forecast: true },
  { month: "2月",  revenue: null, grossProfit: null, overhead: null, grossProfitTotal: null, cumulative: null, forecast: true },
  { month: "3月",  revenue: null, grossProfit: null, overhead: null, grossProfitTotal: null, cumulative: null, forecast: true },
];

const DEPT_COLORS: Record<string, string> = {
  "一般住宅": "#0F5132",
  "新築":     "#1A7A52",
  "公共工事": "#4DB88A",
  "リフォーム":"#7DCFAA",
};

// ── ユーティリティ ──────────────────────────────────────────────────
function achievementRate(actual: number, target: number) {
  return Math.round((actual / target) * 1000) / 10;
}

function TrendIcon({ val }: { val: number }) {
  if (val > 0) return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  if (val < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function ValueBadge({ val }: { val: number }) {
  const isNeg = val < 0;
  return (
    <span className={isNeg ? "text-red-500" : "text-foreground"}>
      {isNeg ? `▲¥${Math.abs(val).toLocaleString()}万` : `¥${val.toLocaleString()}万`}
    </span>
  );
}

// ── P&L フロー行 ───────────────────────────────────────────────────
function PlRow({ label, value, isDeduction, isBold, indent }: {
  label: string; value: number; isDeduction?: boolean; isBold?: boolean; indent?: boolean;
}) {
  const isNeg = value < 0;
  return (
    <div className={`flex items-center justify-between py-2 border-b border-border/40 last:border-0 ${isBold ? "font-semibold" : ""}`}>
      <span className={`text-sm ${indent ? "pl-4 text-muted-foreground" : ""}`}>
        {isDeduction && <span className="text-muted-foreground mr-1.5">−</span>}
        {label}
      </span>
      <span className={`text-sm tabular-nums ${isNeg ? "text-red-500" : ""}`}>
        {isNeg ? `▲¥${Math.abs(value).toLocaleString()}万` : `¥${value.toLocaleString()}万`}
      </span>
    </div>
  );
}

// ── 達成率ゲージ（ラジアルバー） ────────────────────────────────────
function AchievementGauge({ rate }: { rate: number }) {
  const data = [{ value: Math.min(rate, 100), fill: rate >= 50 ? "#0F5132" : rate >= 30 ? "#f59e0b" : "#ef4444" }];
  return (
    <div className="relative flex items-center justify-center">
      <RadialBarChart
        width={120}
        height={120}
        cx={60}
        cy={60}
        innerRadius={40}
        outerRadius={55}
        startAngle={90}
        endAngle={-270}
        data={data}
      >
        <RadialBar dataKey="value" background={{ fill: "#f3f4f6" }} cornerRadius={6} />
      </RadialBarChart>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums">{rate}%</span>
        <span className="text-[10px] text-muted-foreground">達成率</span>
      </div>
    </div>
  );
}

// ── KPIミニカード ──────────────────────────────────────────────────
function MiniKpi({ label, main, sub, color }: {
  label: string; main: React.ReactNode; sub?: string; color?: string;
}) {
  return (
    <div className={`rounded-xl border bg-card px-3 py-2 flex flex-col gap-0 border-l-4`} style={{ borderLeftColor: color ?? "#e5e7eb" }}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tabular-nums tracking-tight">{main}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── メインコンポーネント ────────────────────────────────────────────
export default function BiDashboardPage() {
  const [showTheoretical, setShowTheoretical] = useState(true);
  const [selectedDept, setSelectedDept] = useState("全社");

  const s = COMPANY_SUMMARY;
  const achieveRate = achievementRate(s.actualRevenue, s.targetRevenue);

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-start justify-between">
        <PageHeader
          title="BIダッシュボード"
          description={`${s.fiscalYear} — 経営指標の可視化（期首予算 ¥${s.targetRevenue.toLocaleString()}万）`}
        />
        <Badge variant="outline" className="text-xs mt-1 shrink-0">サンプルデータ</Badge>
      </div>

      <Tabs defaultValue="summary">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="summary" className="gap-1.5">
            <LayoutDashboard className="h-3.5 w-3.5" />
            全社サマリー
          </TabsTrigger>
          <TabsTrigger value="dept" className="gap-1.5">
            <PieChart className="h-3.5 w-3.5" />
            部門別
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            月別推移
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════
            タブ1：全社サマリー
        ══════════════════════════════════════════════ */}
        <TabsContent value="summary" className="space-y-4 mt-4">

          {/* 達成率ゲージ + KPI 横並び */}
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4">
            {/* 左：ゲージ + 売上 */}
            <Card className="flex items-center gap-5 px-6 py-4">
              <AchievementGauge rate={achieveRate} />
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">売上実績 / 年間目標</p>
                <p className="text-3xl font-bold tabular-nums">
                  ¥{s.actualRevenue.toLocaleString()}万
                </p>
                <p className="text-sm text-muted-foreground">
                  / ¥{s.targetRevenue.toLocaleString()}万
                </p>
                <div className="mt-2 h-2 w-48 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.min(achieveRate, 100)}%` }}
                  />
                </div>
              </div>
            </Card>

            {/* 右：KPIミニカード */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <MiniKpi
                label="粗利率"
                main={`${s.grossProfitRate.toFixed(1)}%`}
                sub="完了工事平均"
                color="#0F5132"
              />
              <MiniKpi
                label="粗利額"
                main={`¥${s.grossProfit.toLocaleString()}万`}
                sub="部門粗利の合計"
                color="#1A7A52"
              />
              <MiniKpi
                label="売上総利益"
                main={<ValueBadge val={s.grossProfitTotal} />}
                sub={`率 ${s.grossProfitTotalRate}%`}
                color={s.grossProfitTotal < 0 ? "#ef4444" : "#0F5132"}
              />
              <MiniKpi
                label="販管費予算"
                main={`▲¥${Math.abs(s.sgaBudget).toLocaleString()}万`}
                sub="期首固定値"
                color="#e5e7eb"
              />
              <MiniKpi
                label="営業利益"
                main={<ValueBadge val={s.operatingProfit} />}
                sub={`率 ${s.operatingProfitRate}%`}
                color={s.operatingProfit < 0 ? "#ef4444" : "#0F5132"}
              />
              <MiniKpi
                label="製造間接費"
                main={`▲¥${Math.abs(s.overheadBudget).toLocaleString()}万`}
                sub="期首固定値"
                color="#e5e7eb"
              />
            </div>
          </div>

          {/* P&L フロー */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                損益フロー
                <span className="text-xs font-normal text-muted-foreground">（{s.fiscalYear} 期首予算 ¥{s.targetRevenue.toLocaleString()}万）</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                {/* フロー */}
                <div className="flex-1 min-w-0">
                  <PlRow label="全社売上（実績）" value={s.actualRevenue} isBold />
                  <PlRow label="全社粗利額" value={s.grossProfit} indent />
                  <PlRow label="予算配賦（製造間接費）" value={s.overheadBudget} isDeduction indent />
                  <PlRow label="売上総利益" value={s.grossProfitTotal} isBold />
                  <PlRow label="販管費予算" value={s.sgaBudget} isDeduction indent />
                  <PlRow label="営業利益" value={s.operatingProfit} isBold />
                </div>
                {/* ビジュアルバー */}
                <div className="shrink-0 space-y-2 w-full sm:w-56">
                  {[
                    { label: "売上", val: s.actualRevenue, max: s.targetRevenue, color: "#0F5132" },
                    { label: "粗利", val: s.grossProfit,   max: s.targetRevenue, color: "#1A7A52" },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-[11px] text-muted-foreground mb-0.5">
                        <span>{item.label}</span>
                        <span>¥{item.val.toLocaleString()}万</span>
                      </div>
                      <div className="h-3 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min((item.val / item.max) * 100, 100)}%`,
                            background: item.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground pt-1">対年間目標比較</p>
                </div>
              </div>

              <div className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                期中の売上総利益がマイナスになるのは<strong>仕様です</strong>。粗利の積み上げが製造間接費に達するまで赤字表示となり、損益分岐点までの距離を可視化します。
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════
            タブ2：部門別
        ══════════════════════════════════════════════ */}
        <TabsContent value="dept" className="space-y-4 mt-4">

          {/* 部門別KPIカード */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {DEPARTMENTS.map((d) => {
              const rate = achievementRate(d.revenue, d.target);
              return (
                <Card key={d.name}>
                  <CardContent className="pt-3 pb-3 px-4">
                    <div className="mb-2">
                      <p className="text-xs text-muted-foreground">{d.label}</p>
                      <p className="font-semibold text-sm">{d.name}</p>
                    </div>
                    <p className="text-xl font-bold tabular-nums">¥{d.revenue.toLocaleString()}万</p>
                    <p className="text-[11px] text-muted-foreground">目標 ¥{d.target.toLocaleString()}万</p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(rate, 100)}%`,
                          background: DEPT_COLORS[d.name],
                        }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-[11px]">
                      <span className="text-muted-foreground">粗利率</span>
                      <span className="font-medium">{d.grossProfitRate.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">粗利額</span>
                      <span className="font-medium">¥{d.grossProfit.toLocaleString()}万</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* 部門比較バーグラフ */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">部門別 売上・粗利比較</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart
                  data={DEPARTMENTS.map(d => ({
                    name: d.name,
                    売上: d.revenue,
                    粗利: d.grossProfit,
                    目標: d.target,
                  }))}
                  margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="万" />
                  <RTooltip formatter={(v) => [`¥${Number(v).toLocaleString()}万`]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="目標" fill="#e5e7eb" radius={[3, 3, 0, 0]} name="目標" />
                  <Bar dataKey="売上" fill="#0F5132" radius={[3, 3, 0, 0]} name="売上" />
                  <Bar dataKey="粗利" fill="#4DB88A" radius={[3, 3, 0, 0]} name="粗利" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 部門別テーブル（詳細） */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm font-semibold">部門別詳細テーブル</CardTitle>
                <div className="flex items-center gap-2">
                  <Switch id="theoretical" checked={showTheoretical} onCheckedChange={setShowTheoretical} />
                  <Label htmlFor="theoretical" className="text-xs text-muted-foreground cursor-pointer">
                    理論値（販管費・営業利益）を表示
                  </Label>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">部門</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">売上 / 目標</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">達成率</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">粗利率</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">粗利額</th>
                      {showTheoretical && <>
                        <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
                          販管費 <span className="opacity-60 text-[10px]">理論値</span>
                        </th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
                          営業利益 <span className="opacity-60 text-[10px]">理論値</span>
                        </th>
                      </>}
                    </tr>
                  </thead>
                  <tbody>
                    {DEPARTMENTS.map((d, i) => {
                      const rate = achievementRate(d.revenue, d.target);
                      return (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DEPT_COLORS[d.name] }} />
                              <div>
                                <div className="font-medium">{d.name}</div>
                                <div className="text-xs text-muted-foreground">{d.label}</div>
                              </div>
                            </div>
                          </td>
                          <td className="text-right px-3 py-3 tabular-nums">
                            <span className="font-semibold">¥{d.revenue.toLocaleString()}万</span>
                            <span className="text-muted-foreground text-xs"> / ¥{d.target.toLocaleString()}万</span>
                          </td>
                          <td className="text-right px-3 py-3">
                            <div className={`font-medium ${rate >= 30 ? "text-emerald-600" : "text-amber-600"}`}>{rate}%</div>
                            <div className="mt-1 h-1.5 w-14 ml-auto rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(rate,100)}%`, background: rate>=30?"#10b981":"#f59e0b" }} />
                            </div>
                          </td>
                          <td className="text-right px-3 py-3 tabular-nums text-muted-foreground">{d.grossProfitRate.toFixed(1)}%</td>
                          <td className="text-right px-3 py-3 tabular-nums font-semibold">¥{d.grossProfit.toLocaleString()}万</td>
                          {showTheoretical && <>
                            <td className="text-right px-3 py-3 tabular-nums text-red-500 text-xs">▲¥{Math.abs(d.sga).toLocaleString()}万</td>
                            <td className={`text-right px-4 py-3 tabular-nums font-semibold ${d.operatingProfit<0?"text-red-500":"text-emerald-600"}`}>
                              {d.operatingProfit<0?`▲¥${Math.abs(d.operatingProfit).toLocaleString()}万`:`¥${d.operatingProfit.toLocaleString()}万`}
                            </td>
                          </>}
                        </tr>
                      );
                    })}
                    <tr className="bg-muted/30 border-t-2 font-semibold">
                      <td className="px-4 py-2.5 text-sm">合計</td>
                      <td className="text-right px-3 py-2.5 tabular-nums text-sm">
                        ¥{s.actualRevenue.toLocaleString()}万
                        <span className="text-muted-foreground font-normal text-xs"> / ¥{s.targetRevenue.toLocaleString()}万</span>
                      </td>
                      <td className="text-right px-3 py-2.5 text-sm text-amber-600">{achieveRate}%</td>
                      <td className="text-right px-3 py-2.5 tabular-nums text-sm text-muted-foreground">{s.grossProfitRate.toFixed(1)}%</td>
                      <td className="text-right px-3 py-2.5 tabular-nums text-sm">¥{s.grossProfit.toLocaleString()}万</td>
                      {showTheoretical && <>
                        <td className="text-right px-3 py-2.5 tabular-nums text-sm text-red-500">▲¥{Math.abs(s.sgaBudget).toLocaleString()}万</td>
                        <td className="text-right px-4 py-2.5 tabular-nums text-sm text-emerald-600">
                          ¥{DEPARTMENTS.reduce((sum,d)=>sum+d.operatingProfit,0).toLocaleString()}万
                        </td>
                      </>}
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="px-4 pb-3 pt-2 text-[11px] text-muted-foreground flex items-start gap-1.5">
                <Info className="h-3 w-3 shrink-0 mt-0.5" />
                販管費・営業利益は売上構成比による按分で算出した理論値です。製造間接費は全社レベルで一括控除します。
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════
            タブ3：月別推移
        ══════════════════════════════════════════════ */}
        <TabsContent value="monthly" className="space-y-4 mt-4">

          {/* 部門切り替え */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground shrink-0">表示：</span>
            {["全社", ...DEPARTMENTS.map(d => d.name)].map(name => (
              <button
                key={name}
                onClick={() => setSelectedDept(name)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  selectedDept === name
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          {/* 月別サマリー（実績6ヶ月） */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {MONTHLY_DATA.filter(m => m.revenue != null).map((m, i) => (
              <div key={i} className="shrink-0 flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5">
                <span className="text-xs font-medium text-muted-foreground w-8">{m.month}</span>
                <span className="text-sm font-bold tabular-nums">¥{m.revenue}万</span>
                <span className={`text-xs tabular-nums ${m.grossProfitTotal! < 0 ? "text-red-500" : "text-emerald-600"}`}>
                  {m.grossProfitTotal! < 0 ? `▲${Math.abs(m.grossProfitTotal!)}万` : `+${m.grossProfitTotal!}万`}
                </span>
              </div>
            ))}
          </div>

          {/* グラフ */}
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                月別推移（{selectedDept}）
                <span className="ml-auto text-[11px] text-muted-foreground font-normal flex items-center gap-1">
                  10月以降
                  <ArrowRight className="h-3 w-3" />
                  着地予測エリア
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={MONTHLY_DATA} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  {/* 着地予測エリア（薄いグレー背景） */}
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="万" />
                  <RTooltip
                    formatter={(value, name) =>
                      value == null ? ["―", name] : [`¥${Number(value).toLocaleString()}万`, name]
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="#d1d5db" strokeWidth={1.5} />
                  <Bar dataKey="revenue" name="売上" fill="#0F5132" radius={[3,3,0,0]} opacity={0.85} />
                  <Bar dataKey="grossProfit" name="粗利額" fill="#4DB88A" radius={[3,3,0,0]} opacity={0.85} />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    name="売上総利益（累計）"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#f59e0b", strokeWidth: 0 }}
                    connectNulls={false}
                    strokeDasharray="5 3"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 月別テーブル */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">月別明細</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">月</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">売上（実績）</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">粗利額</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">月別予算配賦</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">売上総利益</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">累計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MONTHLY_DATA.map((row, i) => {
                      const isForecast = row.forecast;
                      return (
                        <tr key={i} className={`border-b last:border-0 transition-colors ${isForecast ? "bg-muted/10 text-muted-foreground" : "hover:bg-muted/20"}`}>
                          <td className="px-4 py-2.5 font-medium">
                            {row.month}
                            {isForecast && (
                              <span className="ml-1.5 text-[10px] bg-muted px-1.5 py-0.5 rounded-full">予測</span>
                            )}
                          </td>
                          <td className="text-right px-3 py-2.5 tabular-nums">
                            {row.revenue != null ? `¥${row.revenue.toLocaleString()}万` : "―"}
                          </td>
                          <td className="text-right px-3 py-2.5 tabular-nums">
                            {row.grossProfit != null ? `¥${row.grossProfit.toLocaleString()}万` : "―"}
                          </td>
                          <td className="text-right px-3 py-2.5 tabular-nums text-red-500 text-xs">
                            {row.overhead != null ? `▲¥${Math.abs(row.overhead).toLocaleString()}万` : "―"}
                          </td>
                          <td className={`text-right px-3 py-2.5 tabular-nums font-medium ${row.grossProfitTotal != null && row.grossProfitTotal < 0 ? "text-red-500" : ""}`}>
                            {row.grossProfitTotal != null
                              ? row.grossProfitTotal < 0
                                ? `▲¥${Math.abs(row.grossProfitTotal).toLocaleString()}万`
                                : `¥${row.grossProfitTotal.toLocaleString()}万`
                              : "―"}
                          </td>
                          <td className={`text-right px-4 py-2.5 tabular-nums font-semibold ${row.cumulative != null && row.cumulative < 0 ? "text-red-500" : row.cumulative != null ? "text-emerald-600" : ""}`}>
                            {row.cumulative != null
                              ? row.cumulative < 0
                                ? `▲¥${Math.abs(row.cumulative).toLocaleString()}万`
                                : `¥${row.cumulative.toLocaleString()}万`
                              : "―"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="px-4 pb-3 pt-2 text-[11px] text-muted-foreground flex items-start gap-1.5">
                <Info className="h-3 w-3 shrink-0 mt-0.5" />
                全社の月別予算配賦は年額 ÷ 12で均等按分。部門ビュー切替時は当月売上構成比による動的按分に切り替わります。
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
