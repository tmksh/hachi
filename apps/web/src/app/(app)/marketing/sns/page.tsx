"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { getCustomers } from "@/lib/actions/customers";

const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function MarketingSnsPage() {
  const [customers, setCustomers] = useState<{ source: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getCustomers().then(c => setCustomers(c.map(x => ({ source: x.source })))).catch(()=>{}).finally(()=>setLoading(false)); }, []);

  const sourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    customers.forEach(c => { const s = c.source || "不明"; counts[s] = (counts[s]||0)+1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [customers]);

  if (loading) return <div className="p-4 md:p-6 space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="SNS・チャネル分析" description="顧客獲得チャネルの分析" />
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">総顧客数</p><p className="text-2xl font-semibold">{customers.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">チャネル数</p><p className="text-2xl font-semibold">{sourceData.length}</p></CardContent></Card>
      </div>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">顧客獲得チャネル内訳</CardTitle></CardHeader>
        <CardContent>{sourceData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}><PieChart><Pie data={sourceData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" label={({name,percent})=>`${name} ${((percent??0)*100).toFixed(0)}%`}>{sourceData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>
        ) : <p className="text-center py-8 text-muted-foreground">データなし</p>}</CardContent>
      </Card>
    </div>
  );
}
