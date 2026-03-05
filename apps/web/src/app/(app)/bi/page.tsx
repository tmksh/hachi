"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingCart,
  DollarSign,
  BarChart3,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const monthlyRevenue = [
  { month: "4月", 売上: 45, 目標: 50 },
  { month: "5月", 売上: 52, 目標: 50 },
  { month: "6月", 売上: 48, 目標: 52 },
  { month: "7月", 売上: 61, 目標: 55 },
  { month: "8月", 売上: 55, 目標: 55 },
  { month: "9月", 売上: 67, 目標: 58 },
  { month: "10月", 売上: 72, 目標: 60 },
  { month: "11月", 売上: 65, 目標: 62 },
  { month: "12月", 売上: 78, 目標: 65 },
  { month: "1月", 売上: 58, 目標: 60 },
  { month: "2月", 売上: 63, 目標: 62 },
  { month: "3月", 売上: 85, 目標: 70 },
];

const profitMargin = [
  { month: "4月", 粗利率: 18.5 },
  { month: "5月", 粗利率: 20.2 },
  { month: "6月", 粗利率: 19.8 },
  { month: "7月", 粗利率: 21.5 },
  { month: "8月", 粗利率: 22.1 },
  { month: "9月", 粗利率: 21.8 },
  { month: "10月", 粗利率: 23.4 },
  { month: "11月", 粗利率: 22.6 },
  { month: "12月", 粗利率: 24.1 },
  { month: "1月", 粗利率: 20.5 },
  { month: "2月", 粗利率: 22.8 },
  { month: "3月", 粗利率: 25.3 },
];

const dealSource = [
  { name: "紹介", value: 42 },
  { name: "Web", value: 28 },
  { name: "展示会", value: 18 },
  { name: "飛び込み", value: 12 },
];

const constructionStatus = [
  { name: "着工前", value: 8 },
  { name: "施工中", value: 15 },
  { name: "検査中", value: 4 },
  { name: "完工", value: 23 },
];

const PIE_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444"];
const STATUS_COLORS = ["#94a3b8", "#3b82f6", "#f59e0b", "#22c55e"];

export default function BiDashboardPage() {
  const [period, setPeriod] = useState("year");

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="BIダッシュボード"
        description="経営指標の可視化と分析"
      >
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">今月</SelectItem>
            <SelectItem value="quarter">四半期</SelectItem>
            <SelectItem value="year">年間</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "売上",
            value: "¥749M",
            change: "+12.3%",
            positive: true,
            icon: DollarSign,
          },
          {
            label: "粗利",
            value: "¥168M",
            change: "+8.7%",
            positive: true,
            icon: TrendingUp,
          },
          {
            label: "受注件数",
            value: "142件",
            change: "+15",
            positive: true,
            icon: ShoppingCart,
          },
          {
            label: "顧客数",
            value: "238",
            change: "+32",
            positive: true,
            icon: Users,
          },
        ].map((kpi, i) => (
          <Card key={i} className="stat-card transition-[box-shadow,background-color] duration-200">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
                <kpi.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xl font-semibold tabular-nums">{kpi.value}</p>
              <p
                className={`text-xs mt-1 ${
                  kpi.positive ? "text-green-600" : "text-red-500"
                }`}
              >
                {kpi.change} 前年比
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Revenue */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              月別売上推移
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} unit="M" />
                <RechartsTooltip
                  formatter={(value) => [`¥${value}M`, ""]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="売上" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="目標" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Profit Margin */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              粗利率推移
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={profitMargin}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} unit="%" domain={[15, 30]} />
                <RechartsTooltip
                  formatter={(value) => [`${value}%`, "粗利率"]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="粗利率"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Deal Source */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">案件獲得チャネル</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={dealSource}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                >
                  {dealSource.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index]} />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(value) => [`${value}件`, ""]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Construction Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">工事ステータス内訳</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={constructionStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}件`}
                >
                  {constructionStatus.map((_, index) => (
                    <Cell key={index} fill={STATUS_COLORS[index]} />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(value) => [`${value}件`, ""]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {constructionStatus.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[i] }}
                  />
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="font-medium ml-auto">{item.value}件</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
