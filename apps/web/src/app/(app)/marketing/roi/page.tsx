"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, TrendingUp, Target } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

const channelData = [
  {
    channel: "Web広告（Google）",
    investment: 1200000,
    leads: 85,
    deals: 12,
    revenue: 48000000,
    roi: 3900,
  },
  {
    channel: "Web広告（SNS）",
    investment: 800000,
    leads: 62,
    deals: 8,
    revenue: 28000000,
    roi: 3400,
  },
  {
    channel: "展示会・イベント",
    investment: 2500000,
    leads: 120,
    deals: 18,
    revenue: 72000000,
    roi: 2780,
  },
  {
    channel: "チラシ・DM",
    investment: 600000,
    leads: 28,
    deals: 4,
    revenue: 15000000,
    roi: 2400,
  },
  {
    channel: "紹介",
    investment: 300000,
    leads: 45,
    deals: 22,
    revenue: 95000000,
    roi: 31567,
  },
  {
    channel: "ポータルサイト",
    investment: 500000,
    leads: 38,
    deals: 6,
    revenue: 22000000,
    roi: 4300,
  },
];

const chartData = channelData.map((d) => ({
  channel: d.channel.length > 8 ? d.channel.slice(0, 8) + "..." : d.channel,
  ROI: Math.round(d.roi / 100),
}));

const totalInvestment = channelData.reduce((s, d) => s + d.investment, 0);
const totalRevenue = channelData.reduce((s, d) => s + d.revenue, 0);
const avgRoi = Math.round(((totalRevenue - totalInvestment) / totalInvestment) * 100);

function formatCurrency(value: number) {
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}億`;
  if (value >= 10000) return `${Math.round(value / 10000).toLocaleString()}万`;
  return `¥${value.toLocaleString()}`;
}

export default function MarketingRoiPage() {
  const [period, setPeriod] = useState("year");

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="ROI分析"
        description="マーケティングチャネル別の投資対効果"
      >
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="quarter">四半期</SelectItem>
            <SelectItem value="half">半期</SelectItem>
            <SelectItem value="year">年間</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            label: "総投資額",
            value: formatCurrency(totalInvestment),
            icon: DollarSign,
          },
          {
            label: "総リターン",
            value: formatCurrency(totalRevenue),
            icon: TrendingUp,
          },
          {
            label: "平均ROI",
            value: `${avgRoi.toLocaleString()}%`,
            icon: Target,
          },
        ].map((card, i) => (
          <Card key={i}>
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
        {/* ROI Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              チャネル別ROI（倍率）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} unit="x" />
                <YAxis
                  type="category"
                  dataKey="channel"
                  tick={{ fontSize: 11 }}
                  width={90}
                />
                <RechartsTooltip
                  formatter={(value) => [`${value}x`, "ROI"]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="ROI" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Channel Comparison Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              チャネル別詳細
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>チャネル</TableHead>
                  <TableHead className="text-right">投資額</TableHead>
                  <TableHead className="text-right">リード</TableHead>
                  <TableHead className="text-right">成約</TableHead>
                  <TableHead className="text-right">成約額</TableHead>
                  <TableHead className="text-right">ROI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channelData.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-xs">
                      {row.channel}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatCurrency(row.investment)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {row.leads}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {row.deals}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatCurrency(row.revenue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs font-medium text-green-600">
                      {row.roi.toLocaleString()}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
