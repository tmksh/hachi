"use client";

import { useQuerySeedAt } from "@/hooks/use-query-seed-at";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { KpiRow } from "@/components/shared/kpi-row";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, TrendingUp, Percent, Info } from "lucide-react";
import type { PerformanceData } from "@/lib/actions/performance";
import { getCurrentFiscalYear, fiscalYearLabel, listFiscalYears } from "@/lib/bi-utils";
import { cn } from "@/lib/utils";
import { fetchPerformance, LIST_STALE_MS, QK } from "@/lib/queries/portal";

const ALL_DEPARTMENTS = "__all__";

function fmt(n: number) { return `¥${n.toLocaleString()}`; }
function fmtRate(rate: number | null) { return rate == null ? "—" : `${rate}%`; }

function rateClass(rate: number | null) {
  if (rate == null) return "text-muted-foreground";
  return rate >= 100 ? "text-emerald-700" : rate >= 80 ? "text-amber-600" : "text-rose-500";
}

export function PerformanceClient({ initialData }: { initialData: PerformanceData | null }) {
  const querySeedAt = useQuerySeedAt();
  const [fiscalYear, setFiscalYear] = useState(initialData?.fiscalYear ?? getCurrentFiscalYear());
  const [department, setDepartment] = useState<string>(ALL_DEPARTMENTS);
  const fiscalYearOptions = listFiscalYears(5);
  const dept = department === ALL_DEPARTMENTS ? undefined : department;
  const { data, isFetching } = useQuery({
    queryKey: QK.performance(fiscalYear, dept),
    queryFn: () => fetchPerformance(fiscalYear, dept),
    staleTime: LIST_STALE_MS,
    placeholderData: keepPreviousData,
    initialData: fiscalYear === (initialData?.fiscalYear ?? getCurrentFiscalYear()) && !dept
      ? initialData
      : undefined,
    initialDataUpdatedAt: initialData ? querySeedAt : undefined,
  });
  const loading = isFetching && !data;

  const months = data?.months ?? [];
  const maxBarValue = Math.max(1, ...months.flatMap((m) => [m.plan, m.actual]));

  return (
    <div className="p-4 md:p-6 space-y-4 min-h-screen">
      <PageHeader title="予実管理" description={`${fiscalYearLabel(fiscalYear)} ・ 計画と実績の比較`}>
        <Select value={String(fiscalYear)} onValueChange={(v) => setFiscalYear(Number(v))}>
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fiscalYearOptions.map((y) => (
              <SelectItem key={y} value={String(y)}>{fiscalYearLabel(y)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="部門" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_DEPARTMENTS}>全部門</SelectItem>
            {(data?.departments ?? []).map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      {data?.isProvisionalTarget && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground rounded-lg p-3" style={{ background: "rgba(var(--brand-accent-rgb),0.25)", border: "1px solid rgba(var(--brand-accent-rgb),0.8)" }}>
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[var(--brand-dark)]" />
          <span>
            月次目標が未設定のため、実績平均×1.1 を<Badge variant="outline" className="mx-1 h-4 px-1 text-[10px]">仮目標</Badge>として表示しています。会社設定で目標を登録すると正式な計画値で比較できます。
          </span>
        </div>
      )}

      <KpiRow
        loading={loading}
        columns={3}
        stacked
        items={[
          {
            label: "年間計画",
            value: data ? fmt(data.annualPlan) : "—",
            sub: data?.isProvisionalTarget ? "仮目標（実績平均×1.1）" : "月次目標×12",
            icon: Target,
          },
          {
            label: "実績累計",
            value: data ? fmt(data.totalActual) : "—",
            sub: "完了・進行中工事＋入金済み請求",
            icon: TrendingUp,
          },
          {
            label: "達成率",
            value: data ? fmtRate(data.achievementRate) : "—",
            sub: "対年間計画",
            icon: Percent,
            valueClassName: rateClass(data?.achievementRate ?? null),
          },
        ]}
      />

      <Card>
        <CardContent className="p-0">
          <div className="px-5 pt-4 pb-2.5 border-b border-border/60">
            <span className="text-xs font-bold text-foreground">月別 計画 vs 実績</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {department === ALL_DEPARTMENTS ? "全部門" : department} ・ {fiscalYearLabel(fiscalYear)}
            </p>
          </div>
          {loading ? (
            <div className="p-5 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs" style={{ background: "rgba(var(--brand-accent-rgb),0.25)" }}>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground whitespace-nowrap">月</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">計画</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">実績</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">達成率</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground w-[30%] min-w-[180px]">計画（薄）/ 実績（濃）</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m) => (
                    <tr
                      key={m.month}
                      className="border-b last:border-0 transition-colors"
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(var(--brand-accent-rgb),0.15)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                    >
                      <td className="px-5 py-2.5 font-medium text-foreground whitespace-nowrap">{m.month}</td>
                      <td className="text-right px-4 py-2.5 tabular-nums text-muted-foreground">{fmt(m.plan)}</td>
                      <td className="text-right px-4 py-2.5 tabular-nums font-semibold">{fmt(m.actual)}</td>
                      <td className={cn("text-right px-4 py-2.5 tabular-nums font-semibold", rateClass(m.rate))}>
                        {fmtRate(m.rate)}
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="flex flex-col gap-1">
                          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(var(--brand-accent-rgb),0.4)" }}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.min((m.plan / maxBarValue) * 100, 100)}%`, background: "rgba(var(--brand-accent-rgb),0.9)" }}
                            />
                          </div>
                          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(var(--brand-accent-rgb),0.4)" }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${Math.min((m.actual / maxBarValue) * 100, 100)}%`, background: "var(--brand-gradient)" }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 font-semibold" style={{ background: "rgba(var(--brand-accent-rgb),0.25)" }}>
                    <td className="px-5 py-3">年度合計</td>
                    <td className="text-right px-4 py-3 tabular-nums">{data ? fmt(data.annualPlan) : "—"}</td>
                    <td className="text-right px-4 py-3 tabular-nums">{data ? fmt(data.totalActual) : "—"}</td>
                    <td className={cn("text-right px-4 py-3 tabular-nums font-bold", rateClass(data?.achievementRate ?? null))}>
                      {data ? fmtRate(data.achievementRate) : "—"}
                    </td>
                    <td className="px-5 py-3" />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="px-5 pb-4 pt-3 text-[11px] text-muted-foreground flex items-start gap-1.5">
            <Info className="h-3 w-3 shrink-0 mt-0.5 text-[var(--brand-dark)]" />
            実績は完了・進行中工事の契約金額と入金済み請求（工事計上分を除く）の合算です。部門フィルタは工事担当者の部門で絞り込みます。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
