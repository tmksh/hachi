"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { KpiRow } from "@/components/shared/kpi-row";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, CheckCircle2, TrendingUp, Wallet, Percent } from "lucide-react";
import { toast } from "sonner";
import { deleteBudget, updateBudget } from "@/lib/actions/budgets";
import { fetchBudgets } from "@/lib/queries/portal";
import { BudgetEditDialog } from "@/components/budget/budget-edit-dialog";
import type { Budget, BudgetItem } from "@/lib/database.types";

type BudgetRow = Awaited<ReturnType<typeof fetchBudgets>>[number];

function fmt(n: number) { return `¥${n.toLocaleString()}`; }
function pct(n: number) { return `${n.toFixed(1)}%`; }

type BudgetClientProps = {
  initialBudgets: BudgetRow[];
};

export function BudgetClient({ initialBudgets }: BudgetClientProps) {
  const [budgets, setBudgets] = useState<BudgetRow[]>(initialBudgets);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<(Budget & { items?: BudgetItem[] }) | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BudgetRow | null>(null);

  const load = useCallback(() => {
    fetchBudgets().then(setBudgets).catch(() => {});
  }, []);

  const handleEdit = (b: BudgetRow) => {
    setEditing(b as Budget & { items?: BudgetItem[] });
    setDialogOpen(true);
  };
  const handleNew = () => { setEditing(null); setDialogOpen(true); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteBudget(deleteTarget.id);
      toast.success("削除しました");
      setDeleteTarget(null);
      load();
    } catch { toast.error("削除に失敗しました"); }
  };

  const handleApprove = async (b: BudgetRow) => {
    try {
      await updateBudget(b.id, { status: b.status === "approved" ? "draft" : "approved" });
      toast.success(b.status === "approved" ? "下書きに戻しました" : "承認しました");
      load();
    } catch { toast.error("失敗しました"); }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="予算管理" description="年度予算の策定と実績管理">
        <Button size="sm" onClick={handleNew} className="gap-1.5">
          <Plus className="h-4 w-4" />予算を策定
        </Button>
      </PageHeader>
      {budgets.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">予算データなし</CardContent></Card>
      ) : (
        <div className="space-y-8">
          {budgets.map(b => {
            const act = b.actuals;
            const planRevenue = (b.items ?? []).filter((i: { category: string | null; amount: number }) => i.category === "revenue").reduce((s: number, i: { amount: number }) => s + i.amount, 0);
            const planCost    = (b.items ?? []).filter((i: { category: string | null; amount: number }) => i.category === "direct_cost").reduce((s: number, i: { amount: number }) => s + i.amount, 0);
            const planGross   = planRevenue - planCost;
            const achieveRate = planRevenue > 0 ? Math.min((act.revenue / planRevenue) * 100, 100) : 0;

            return (
              <Card key={b.id} className="group">
                <CardHeader className="pb-3 flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{b.fiscal_year}年度 {b.branch && `(${b.branch})`}</CardTitle>
                    <Badge variant={b.status === "approved" ? "default" : "secondary"}>
                      {b.status === "approved" ? "承認済" : "下書き"}
                    </Badge>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="outline" onClick={() => handleApprove(b)} className="h-7 text-xs gap-1">
                      <CheckCircle2 className="h-3 w-3" />{b.status === "approved" ? "下書きに戻す" : "承認"}
                    </Button>
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => handleEdit(b)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => setDeleteTarget(b)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">実績サマリー（完了工事 {act.completed_count}件）</p>
                    <KpiRow
                      className="mb-4"
                      items={[
                        { label: "実績売上", value: fmt(act.revenue), sub: `計画 ${fmt(planRevenue)}`, icon: TrendingUp },
                        { label: "実績原価", value: fmt(act.cost), sub: `計画 ${fmt(planCost)}`, icon: Wallet },
                        {
                          label: "実績粗利",
                          value: fmt(act.gross_profit),
                          sub: `計画 ${fmt(planGross)}`,
                          icon: TrendingUp,
                          valueClassName: act.gross_profit >= 0 ? "text-emerald-700" : "text-red-600",
                        },
                        {
                          label: "粗利率",
                          value: pct(act.gross_rate),
                          sub: planRevenue > 0 ? `計画 ${pct((planGross / planRevenue) * 100)}` : "-",
                          icon: Percent,
                          valueClassName: act.gross_rate >= 0 ? "text-emerald-700" : "text-red-600",
                        },
                      ]}
                    />
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

      <BudgetEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        existing={editing}
        onSaved={load}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteTarget?.fiscal_year}年度の予算を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>関連する予算明細も削除されます。実績データには影響しません。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
