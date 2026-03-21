"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Users, ShoppingCart, DollarSign, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
import { getDeals } from "@/lib/actions/deals";
import { getConstructions } from "@/lib/actions/constructions";
import type { Deal } from "@/lib/database.types";

const PIE_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
const MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
const STAGE_LABELS: Record<string, string> = { inquiry:"問い合わせ", first_meeting:"初回面談", materials_sent:"資料送付", quote_submitted:"見積提出", negotiation:"交渉中", closing:"クロージング", won:"受注", lost:"失注" };
const CST_LABELS: Record<string, string> = { preparing:"着工前", in_progress:"施工中", completed:"完工", suspended:"中断", delayed:"遅延" };

export default function BiDashboardPage() {
  const [deals, setDeals] = useState<(Deal & { customer: unknown; assignee: unknown })[]>([]);
  const [constructions, setConstructions] = useState<{ status: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDeals(), getConstructions()])
      .then(([d, c]) => { setDeals(d as typeof deals); setConstructions(c as typeof constructions); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const wonDeals = useMemo(() => deals.filter(d => d.stage === "won"), [deals]);
  const totalRevenue = useMemo(() => wonDeals.reduce((s, d) => s + (d.value || 0), 0), [wonDeals]);
  const pipelineValue = useMemo(() => deals.filter(d => d.stage !== "won" && d.stage !== "lost").reduce((s, d) => s + (d.value || 0), 0), [deals]);

  const monthlyRevenue = useMemo(() => {
    const m: Record<number, number> = {};
    wonDeals.forEach(d => { const mo = new Date(d.expected_close_date || d.created_at).getMonth(); m[mo] = (m[mo]||0) + (d.value||0); });
    return MONTHS.map((label, i) => ({ month: label, 売上: Math.round((m[i]||0)/10000) }));
  }, [wonDeals]);

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

  if (loading) return <div className="p-4 md:p-6 space-y-6"><Skeleton className="h-8 w-48" /><div className="grid grid-cols-4 gap-3">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-24" />)}</div></div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="BIダッシュボード" description="経営指標の可視化と分析" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "売上（受注）", val: `¥${Math.round(totalRevenue/10000).toLocaleString()}万`, icon: DollarSign },
          { label: "パイプライン", val: `¥${Math.round(pipelineValue/10000).toLocaleString()}万`, icon: TrendingUp },
          { label: "商談数", val: `${deals.length}件`, icon: ShoppingCart },
          { label: "顧客数", val: `${new Set(deals.map(d=>d.customer_id)).size}`, icon: Users },
        ].map((k, i) => (
          <Card key={i}><CardContent className="pt-4 pb-3"><div className="flex items-center justify-between mb-2"><span className="text-xs text-muted-foreground">{k.label}</span><k.icon className="h-4 w-4 text-muted-foreground" /></div><p className="text-xl font-semibold tabular-nums">{k.val}</p></CardContent></Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />月別売上推移</CardTitle></CardHeader>
          <CardContent><ResponsiveContainer width="100%" height={280}><BarChart data={monthlyRevenue}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tick={{fontSize:12}} /><YAxis tick={{fontSize:12}} unit="万" /><RTooltip formatter={(v)=>[`¥${v}万`,"売上"]} /><Bar dataKey="売上" fill="#2563eb" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">商談ステージ内訳</CardTitle></CardHeader>
          <CardContent><ResponsiveContainer width="100%" height={280}><PieChart><Pie data={dealStageData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" label={({name,percent})=>`${name} ${((percent??0)*100).toFixed(0)}%`}>{dealStageData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />)}</Pie><RTooltip /><Legend wrapperStyle={{fontSize:12}} /></PieChart></ResponsiveContainer></CardContent>
        </Card>
      </div>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">工事ステータス内訳</CardTitle></CardHeader>
        <CardContent><ResponsiveContainer width="100%" height={280}><PieChart><Pie data={cstStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" label={({name,value})=>`${name}: ${value}件`}>{cstStatusData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />)}</Pie><RTooltip /><Legend wrapperStyle={{fontSize:12}} /></PieChart></ResponsiveContainer></CardContent>
      </Card>
    </div>
  );
}
