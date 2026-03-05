"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Wallet, TrendingDown, PiggyBank, Percent } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const departments = [
  { name: "営業部", budget: 12000000, used: 8400000 },
  { name: "工事部", budget: 45000000, used: 38200000 },
  { name: "設計部", budget: 8000000, used: 5100000 },
  { name: "総務部", budget: 6000000, used: 4800000 },
  { name: "経理部", budget: 3500000, used: 2100000 },
  { name: "マーケティング部", budget: 5500000, used: 4200000 },
];

const monthlyBudget = [
  { month: "4月", 予算: 680, 実績: 620 },
  { month: "5月", 予算: 680, 実績: 710 },
  { month: "6月", 予算: 680, 実績: 650 },
  { month: "7月", 予算: 680, 実績: 740 },
  { month: "8月", 予算: 680, 実績: 580 },
  { month: "9月", 予算: 680, 実績: 690 },
  { month: "10月", 予算: 680, 実績: 720 },
  { month: "11月", 予算: 680, 実績: 660 },
  { month: "12月", 予算: 680, 実績: 810 },
  { month: "1月", 予算: 680, 実績: 550 },
  { month: "2月", 予算: 680, 実績: 630 },
  { month: "3月", 予算: 680, 実績: 0 },
];

const totalBudget = departments.reduce((s, d) => s + d.budget, 0);
const totalUsed = departments.reduce((s, d) => s + d.used, 0);
const remaining = totalBudget - totalUsed;
const usageRate = Math.round((totalUsed / totalBudget) * 100);

function formatCurrency(value: number) {
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}億`;
  if (value >= 10000) return `${Math.round(value / 10000).toLocaleString()}万円`;
  return `¥${value.toLocaleString()}`;
}

export default function BudgetPage() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="予算管理"
        description="部門別予算の使用状況と推移"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "年間予算",
            value: formatCurrency(totalBudget),
            icon: Wallet,
          },
          {
            label: "使用済み",
            value: formatCurrency(totalUsed),
            icon: TrendingDown,
          },
          {
            label: "残予算",
            value: formatCurrency(remaining),
            icon: PiggyBank,
          },
          {
            label: "消化率",
            value: `${usageRate}%`,
            icon: Percent,
          },
        ].map((card, i) => (
          <Card key={i} className="stat-card transition-[box-shadow,background-color] duration-200">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{card.label}</span>
                <card.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xl font-semibold tabular-nums">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Department Budget Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">部門別予算状況</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>部門</TableHead>
                  <TableHead className="text-right">予算</TableHead>
                  <TableHead className="text-right">使用済み</TableHead>
                  <TableHead className="text-right">残り</TableHead>
                  <TableHead className="w-[120px]">消化率</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept, i) => {
                  const rate = Math.round((dept.used / dept.budget) * 100);
                  const remainDept = dept.budget - dept.used;
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{dept.name}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {formatCurrency(dept.budget)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {formatCurrency(dept.used)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {formatCurrency(remainDept)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={rate}
                            className="h-2 flex-1"
                          />
                          <span className="text-xs tabular-nums w-8 text-right">
                            {rate}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Monthly Budget Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              月別予算 vs 実績（万円）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={monthlyBudget}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} unit="万" />
                <RechartsTooltip
                  formatter={(value) => [`${value}万円`, ""]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="予算" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="実績" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
