"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Users, ShoppingCart, DollarSign, BarChart3, Percent } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend,
  ComposedChart,
} from "recharts";
import { getDeals } from "@/lib/actions/deals";
import { getConstructions } from "@/lib/actions/constructions";
import type { Deal } from "@/lib/database.types";

const PIE_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
const MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
const STAGE_LABELS: Record<string, string> = { inquiry:"問い合わせ", first_meeting:"初回面談", materials_sent:"資料送付", quote_submitted:"見積提出", negotiation:"交渉中", closing:"クロージング", won:"受注", lost:"失注" };
const CST_LABELS: Record<string, string> = { preparing:"着工前", in_progress:"施工中", completed:"完工", suspended:"中断", delayed:"遅延" };

type Construction = Awaited<ReturnType<typeof getConstructions>>[number];

export default function BiDashboardPage() {
  const [deals, setDeals] = useState<(Deal & { customer: unknown; assignee: unknown })[]>([]);
  const [constructions, setConstructions] = useState<Construction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDeals(), getConstructions()])
      .then(([d, c]) => { setDeals(d as typeof deals); setConstructions(c as Construction[]); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const wonDeals = useMemo(() => deals.filter(d => d.stage === "won"), [deals]);
  const totalRevenue = useMemo(() => wonDeals.reduce((s, d) => s + (d.value || 0), 0), [wonDeals]);
  const pipelineValue = useMemo(() => deals.filter(d => d.stage !== "won" && d.stage !== "lost").reduce((s, d) => s + (d.value || 0), 0), [deals]);

  // 完了工事の平均粗利率
  const completedConstructions = useMemo(() => constructions.filter(c => c.status === "completed"), [constructions]);
  const avgGrossRate = useMemo(() => {
    const valid = completedConstructions.filter(c => (c.order_amount ?? 0) > 0);
    if (!valid.length) return 0;
    const sum = valid.reduce((s, c) => {
      const gross = (c.order_amount ?? 0) - (c.actual_cost ?? c.budget_cost ?? 0);
      return s + (gross / (c.order_amount ?? 1)) * 100;
    }, 0);
    return sum / valid.length;
  }, [completedConstructions]);

  const monthlyRevenue = useMemo(() => {
    const m: Record<number, number> = {};
    wonDeals.forEach(d => { const mo = new Date(d.expected_close_date || d.created_at).getMonth(); m[mo] = (m[mo]||0) + (d.value||0); });
    return MONTHS.map((label, i) => ({ month: label, 売上: Math.round((m[i]||0)/10000) }));
  }, [wonDeals]);

  // 月別粗利率（完了工事ベース）
  const monthlyGrossRate = useMemo(() => {
    const data: Record<number, { revenue: number; cost: number }> = {};
    completedConstructions.forEach(c => {
      const mo = new Date(c.updated_at).getMonth();
      if (!data[mo]) data[mo] = { revenue: 0, cost: 0 };
      data[mo].revenue += c.order_amount ?? 0;
      data[mo].cost += c.actual_cost ?? c.budget_cost ?? 0;
    });
    return MONTHS.map((label, i) => {
      const d = data[i];
      const rate = d && d.revenue > 0 ? Math.round(((d.revenue - d.cost) / d.revenue) * 100) : null;
      return { month: label, 粗利率: rate };
    });
  }, [completedConstructions]);

  const dealStageData = useMemo(() => {
    const c: Record<string, number> = {};
    deals.forEach(d => { c[d.stage] = (c[d.stage]||0) + 1; });
    return Object.entries(c).map(([k, v]) => ({ name: STAGE_LABELS[k]||k, value: v })).filter(d => d.value > 0);
  }, [deals]);

  const cstStatusData = useMemo(() => {
    const c: Record<string, number> = {};
    constructions.forEach(x => { c[x.status] = (c[x.status]||0) + 1; });
    return Object.entries(c).map(([k, v]) => ({ name: CST_LABELS[k]||k, value: v })).filter(d => d.value > 0);
  }, [constructions]);

  if (loading) return (
    <div className="p-4 md:p-6 space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-4 gap-3">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-24" />)}</div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="BIダッシュボード" description="経営指標の可視化と分析" />

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "売上（受注）", val: `¥${Math.round(totalRevenue/10000).toLocaleString()}万`, icon: DollarSign },
          { label: "パイプライン", val: `¥${Math.round(pipelineValue/10000).toLocaleString()}万`, icon: TrendingUp },
          { label: "商談数", val: `${deals.length}件`, icon: ShoppingCart },
          { label: "平均粗利率", val: `${avgGrossRate.toFixed(1)}%`, icon: Percent },
        ].map((k, i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{k.label}</span>
                <k.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xl font-semibold tabular-nums">{k.val}</p>
              {i === 3 && completedConstructions.length > 0 && (
                <p className="text-[10px] text-muted-foreground mt-0.5">完了工事 {completedConstructions.length}件の平均</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 月別売上 ＋ 粗利率推移 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />月別売上推移</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{fontSize:12}} />
                <YAxis tick={{fontSize:12}} unit="万" />
                <RTooltip formatter={(v)=>[`¥${v}万`,"売上"]} />
                <Bar dataKey="売上" fill="#2563eb" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Percent className="h-4 w-4 text-emerald-600" />月別粗利率推移（完了工事）</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={monthlyGrossRate}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{fontSize:12}} />
                <YAxis tick={{fontSize:12}} unit="%" domain={[0, 100]} />
                <RTooltip formatter={(v) => [v != null ? `${v}%` : "データなし", "粗利率"]} />
                <Line type="monotone" dataKey="粗利率" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 商談ステージ ＋ 工事ステータス */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">商談ステージ内訳</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={dealStageData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" label={({name,percent})=>`${name} ${((percent??0)*100).toFixed(0)}%`}>
                  {dealStageData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />)}
                </Pie>
                <RTooltip /><Legend wrapperStyle={{fontSize:12}} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">工事ステータス内訳</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={cstStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" label={({name,value})=>`${name}: ${value}件`}>
                  {cstStatusData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />)}
                </Pie>
                <RTooltip /><Legend wrapperStyle={{fontSize:12}} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 顧客数（商談から集計） */}
      <Card>
        <CardContent className="pt-4 pb-3 flex items-center gap-3">
          <Users className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">商談に紐づく顧客数</p>
            <p className="text-xl font-semibold">{new Set(deals.map(d=>d.customer_id)).size}社</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
