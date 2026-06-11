"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart } from "@/components/charts/bar-chart";
import { getDeals } from "@/lib/actions/deals";
import type { Deal } from "@/lib/database.types";

const STAGE_LABELS: Record<string, string> = { inquiry:"問い合わせ", first_meeting:"初回面談", materials_sent:"資料送付", quote_submitted:"見積提出", negotiation:"交渉中", closing:"クロージング", won:"受注", lost:"失注" };

export default function MarketingRoiPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getDeals().then(d => setDeals(d as Deal[])).catch(()=>{}).finally(()=>setLoading(false)); }, []);

  const stageData = useMemo(() => {
    const counts: Record<string, number> = {};
    deals.forEach(d => { counts[d.stage] = (counts[d.stage]||0)+1; });
    return Object.entries(counts).map(([stage, count]) => ({ stage: STAGE_LABELS[stage]||stage, 件数: count }));
  }, [deals]);

  const wonValue = useMemo(() => deals.filter(d => d.stage === "won").reduce((s, d) => s + (d.value || 0), 0), [deals]);
  const totalDeals = deals.length;
  const wonCount = deals.filter(d => d.stage === "won").length;
  const convRate = totalDeals > 0 ? ((wonCount / totalDeals) * 100).toFixed(1) : "0";

  if (loading) return <div className="p-4 md:p-6 space-y-4"><Skeleton className="h-8 w-48" /><div className="grid grid-cols-3 gap-3">{Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-24" />)}</div></div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="ROI分析" description="投資対効果の分析" />
      <div className="grid grid-cols-3 gap-3">
        <Card className="py-0"><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">受注金額</p><p className="text-2xl font-semibold tabular-nums">¥{Math.round(wonValue/10000).toLocaleString()}万</p></CardContent></Card>
        <Card className="py-0"><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">総商談数</p><p className="text-2xl font-semibold">{totalDeals}</p></CardContent></Card>
        <Card className="py-0"><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">受注率</p><p className="text-2xl font-semibold">{convRate}%</p></CardContent></Card>
      </div>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">ステージ別商談数</CardTitle></CardHeader>
        <CardContent>{stageData.length > 0 ? (
          <div className="h-[300px]">
            <BarChart
              data={stageData.map((d) => ({ label: d.stage, value: d.件数 }))}
              height={300}
              formatValue={(v) => `${v}件`}
            />
          </div>
        ) : <p className="text-center py-8 text-muted-foreground">データなし</p>}</CardContent>
      </Card>
    </div>
  );
}
