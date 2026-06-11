"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { DonutChart } from "@/components/charts/donut-chart";
import { getCustomers } from "@/lib/actions/customers";

const COLORS = ["#0F5132", "#1A7A52", "#2D9E6B", "#4DB88A", "#7DCFAA", "#A8DFC5"];

type Customer = Awaited<ReturnType<typeof getCustomers>>["customers"][number];

type MarketingSnsClientProps = {
  initialCustomers: Customer[];
};

export function MarketingSnsClient({ initialCustomers }: MarketingSnsClientProps) {
  const customers = initialCustomers;

  const sourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    customers.forEach(c => { const s = c.source || "不明"; counts[s] = (counts[s]||0)+1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [customers]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="SNS・チャネル分析" description="顧客獲得チャネルの分析" />
      <div className="grid grid-cols-2 gap-3">
        <Card className="py-0"><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">総顧客数</p><p className="text-2xl font-semibold">{customers.length}</p></CardContent></Card>
        <Card className="py-0"><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">チャネル数</p><p className="text-2xl font-semibold">{sourceData.length}</p></CardContent></Card>
      </div>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">顧客獲得チャネル内訳</CardTitle></CardHeader>
        <CardContent>{sourceData.length > 0 ? (
          <DonutChart
            data={sourceData.map((item, i) => ({
              label: item.name,
              value: item.value,
              color: COLORS[i % COLORS.length],
            }))}
            formatValue={(v) => `${v}件`}
          />
        ) : <p className="text-center py-8 text-muted-foreground">データなし</p>}</CardContent>
      </Card>
    </div>
  );
}
