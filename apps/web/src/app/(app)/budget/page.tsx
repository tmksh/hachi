"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getBudgets } from "@/lib/actions/budgets";
import { cn } from "@/lib/utils";

type BudgetRow = Awaited<ReturnType<typeof getBudgets>>[number];

function fmt(n: number) { return `¥${n.toLocaleString()}`; }
function pct(n: number) { return `${n.toFixed(1)}%`; }

export default function BudgetPage() {
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getBudgets().then(setBudgets).catch(() => {}).finally(() => setLoading(false)); }, []);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="予算管理" description="年度予算の策定と実績管理" />
      {loading ? (
        <div className="space-y-3">{Array.from({length:2}).map((_,i)=><Skeleton key={i} className="h-64" />)}</div>
      ) : budgets.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">予算データなし</CardContent></Card>
      ) : (
        <div className="space-y-8">
          {budgets.map(b => {
            const act = b.actuals;
            const planRevenue = (b.items ?? []).filter(i => i.category === "revenue").reduce((s, i) => s + i.amount, 0);
            const planCost    = (b.items ?? []).filter(i => i.category === "direct_cost").reduce((s, i) => s + i.amount, 0);
            const planGross   = planRevenue - planCost;
            const achieveRate = planRevenue > 0 ? Math.min((act.revenue / planRevenue) * 100, 100) : 0;

            return (
              <Card key={b.id}>
                <CardHeader className="pb-3 flex-row items-center justify-between">
                  <CardTitle className="text-base">{b.fiscal_year}年度 {b.branch && `(${b.branch})`}</CardTitle>
                  <Badge variant={b.status === "approved" ? "default" : "secondary"}>
                    {b.status === "approved" ? "承認済" : "下書き"}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* 実績サマリー */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">実績サマリー（完了工事 {act.completed_count}件）</p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                      {[
                        { label: "実績売上",  val: fmt(act.revenue),      sub: `計画: ${fmt(planRevenue)}`,  color: "" },
                        { label: "実績原価",  val: fmt(act.cost),         sub: `計画: ${fmt(planCost)}`,     color: "" },
                        { label: "実績粗利",  val: fmt(act.gross_profit), sub: `計画: ${fmt(planGross)}`,    color: act.gross_profit >= 0 ? "text-green-700" : "text-red-600" },
                        { label: "粗利率",    val: pct(act.gross_rate),   sub: planRevenue > 0 ? `計画: ${pct((planGross/planRevenue)*100)}` : "-", color: act.gross_rate >= 0 ? "text-green-700" : "text-red-600" },
                      ].map((k) => (
                        <div key={k.label} className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                          <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
                          <p className={cn("text-lg font-semibold tabular-nums", k.color)}>{k.val}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{k.sub}</p>
                        </div>
                      ))}
                    </div>
                    {/* 売上達成率バー */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>売上達成率</span>
                        <span className="font-medium">{pct(achieveRate)}</span>
                      </div>
                      <Progress value={achieveRate} className="h-2" />
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{fmt(act.revenue)}</span>
                        <span>目標 {fmt(planRevenue > 0 ? planRevenue : b.target_revenue)}</span>
                      </div>
                    </div>
                  </div>

                  {/* 予算明細 */}
                  {(b.items ?? []).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">予算明細</p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>カテゴリ</TableHead>
                            <TableHead>項目</TableHead>
                            <TableHead className="text-right">計画金額</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(b.items ?? []).map((item: { id: string; category: string | null; name: string; amount: number }) => (
                            <TableRow key={item.id}>
                              <TableCell className="text-sm">
                                <Badge variant="outline" className="text-xs">
                                  {item.category === "revenue" ? "収入" : item.category === "direct_cost" ? "直接費" : "間接費"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">{item.name}</TableCell>
                              <TableCell className="text-right tabular-nums">{fmt(item.amount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
