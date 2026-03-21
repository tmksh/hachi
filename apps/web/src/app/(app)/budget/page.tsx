"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getBudgets } from "@/lib/actions/budgets";

type BudgetRow = Awaited<ReturnType<typeof getBudgets>>[number];

export default function BudgetPage() {
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getBudgets().then(setBudgets).catch(() => {}).finally(() => setLoading(false)); }, []);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="予算管理" description="年度予算の策定と管理" />
      {loading ? <div className="space-y-3">{Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-32" />)}</div> : budgets.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground">予算データなし</CardContent></Card> : (
        <div className="space-y-6">
          {budgets.map(b => (
            <Card key={b.id}>
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <CardTitle className="text-base">{b.fiscal_year}年度 {b.branch && `(${b.branch})`}</CardTitle>
                <Badge variant={b.status === "approved" ? "default" : "secondary"}>{b.status === "approved" ? "承認済" : "下書き"}</Badge>
              </CardHeader>
              <CardContent>
                <div className="mb-3"><span className="text-sm text-muted-foreground">目標売上: </span><span className="font-semibold tabular-nums">¥{(b.target_revenue ?? 0).toLocaleString()}</span></div>
                {(b.items ?? []).length > 0 && (
                  <Table><TableHeader><TableRow><TableHead>カテゴリ</TableHead><TableHead>項目</TableHead><TableHead className="text-right">金額</TableHead></TableRow></TableHeader>
                    <TableBody>{(b.items ?? []).map((item: { id: string; category: string | null; name: string; amount: number }) => (
                      <TableRow key={item.id}><TableCell className="text-sm"><Badge variant="outline" className="text-xs">{item.category === "revenue" ? "収入" : item.category === "direct_cost" ? "直接費" : "間接費"}</Badge></TableCell><TableCell className="text-sm">{item.name}</TableCell><TableCell className="text-right tabular-nums">¥{item.amount.toLocaleString()}</TableCell></TableRow>
                    ))}</TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
