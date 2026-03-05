"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, DollarSign, BarChart3 } from "lucide-react";

interface Deal {
  id: string;
  customer: string;
  title: string;
  amount: number;
  daysSinceUpdate: number;
  probability: number;
}

interface PipelineStage {
  key: string;
  label: string;
  color: string;
  deals: Deal[];
}

const pipeline: PipelineStage[] = [
  {
    key: "lead",
    label: "リード",
    color: "bg-gray-100 dark:bg-gray-800",
    deals: [
      { id: "1", customer: "中村建設", title: "倉庫改修工事", amount: 3500000, daysSinceUpdate: 2, probability: 10 },
      { id: "2", customer: "山口 隆", title: "戸建リフォーム", amount: 1800000, daysSinceUpdate: 5, probability: 10 },
      { id: "3", customer: "西川工業", title: "工場屋根修繕", amount: 6200000, daysSinceUpdate: 1, probability: 15 },
    ],
  },
  {
    key: "first_meeting",
    label: "初回面談",
    color: "bg-blue-50 dark:bg-blue-950/30",
    deals: [
      { id: "4", customer: "鈴木工務店", title: "店舗内装工事", amount: 4500000, daysSinceUpdate: 3, probability: 25 },
      { id: "5", customer: "佐藤 一郎", title: "マンション改修", amount: 2200000, daysSinceUpdate: 7, probability: 20 },
    ],
  },
  {
    key: "proposal",
    label: "提案・見積",
    color: "bg-indigo-50 dark:bg-indigo-950/30",
    deals: [
      { id: "6", customer: "田中建設", title: "渋谷マンション外壁塗装", amount: 4800000, daysSinceUpdate: 4, probability: 50 },
      { id: "7", customer: "加藤総合建設", title: "オフィスビル改装", amount: 15000000, daysSinceUpdate: 2, probability: 45 },
      { id: "8", customer: "渡辺リフォーム", title: "共同住宅リノベーション", amount: 8900000, daysSinceUpdate: 6, probability: 40 },
    ],
  },
  {
    key: "negotiation",
    label: "交渉中",
    color: "bg-yellow-50 dark:bg-yellow-950/30",
    deals: [
      { id: "9", customer: "田中建設", title: "品川倉庫リフォーム", amount: 8200000, daysSinceUpdate: 1, probability: 70 },
      { id: "10", customer: "高橋 健二", title: "自宅全面リフォーム", amount: 5500000, daysSinceUpdate: 10, probability: 60 },
    ],
  },
  {
    key: "won",
    label: "受注",
    color: "bg-green-50 dark:bg-green-950/30",
    deals: [
      { id: "11", customer: "田中建設", title: "新宿オフィスビル改修", amount: 12500000, daysSinceUpdate: 15, probability: 100 },
      { id: "12", customer: "伊藤設計事務所", title: "設計事務所移転工事", amount: 3200000, daysSinceUpdate: 20, probability: 100 },
    ],
  },
  {
    key: "lost",
    label: "失注",
    color: "bg-red-50 dark:bg-red-950/30",
    deals: [
      { id: "13", customer: "小林 さくら", title: "キッチンリフォーム", amount: 1500000, daysSinceUpdate: 30, probability: 0 },
    ],
  },
];

const allDeals = pipeline.flatMap((s) => s.deals);
const totalDeals = allDeals.length;
const totalAmount = allDeals.reduce((s, d) => s + d.amount, 0);
const wonDeals = pipeline.find((s) => s.key === "won")?.deals.length ?? 0;
const closedDeals = wonDeals + (pipeline.find((s) => s.key === "lost")?.deals.length ?? 0);
const conversionRate = closedDeals > 0 ? Math.round((wonDeals / closedDeals) * 100) : 0;
const weightedAmount = allDeals.reduce((s, d) => s + d.amount * (d.probability / 100), 0);

export default function DealsPage() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="商談パイプライン" description="商談の進捗状況を管理" />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="stat-card transition-[box-shadow,background-color] duration-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="size-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Users className="size-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">総商談数</p>
              <p className="text-xl font-bold">{totalDeals}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card transition-[box-shadow,background-color] duration-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="size-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <DollarSign className="size-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">総金額</p>
              <p className="text-xl font-bold">{(totalAmount / 10000).toLocaleString()}万円</p>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card transition-[box-shadow,background-color] duration-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="size-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <TrendingUp className="size-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">受注率</p>
              <p className="text-xl font-bold">{conversionRate}%</p>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card transition-[box-shadow,background-color] duration-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="size-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <BarChart3 className="size-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">加重金額</p>
              <p className="text-xl font-bold">{(weightedAmount / 10000).toLocaleString()}万円</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {pipeline.map((stage) => {
          const stageTotal = stage.deals.reduce((s, d) => s + d.amount, 0);
          return (
            <div
              key={stage.key}
              className="flex-shrink-0 w-[280px] flex flex-col"
            >
              {/* Column Header */}
              <div className={`rounded-t-lg px-3 py-2 ${stage.color}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{stage.label}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {stage.deals.length}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {stageTotal.toLocaleString()}円
                </p>
              </div>

              {/* Cards */}
              <div className="flex-1 bg-black/[0.03] rounded-b-lg p-2 space-y-2 min-h-[120px]">
                {stage.deals.map((deal) => (
                  <Card key={deal.id} className="stat-card transition-[box-shadow,background-color] duration-200">
                    <CardContent className="p-3 space-y-2">
                      <p className="font-medium text-sm leading-tight">{deal.title}</p>
                      <p className="text-xs text-muted-foreground">{deal.customer}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">
                          {deal.amount.toLocaleString()}円
                        </span>
                        <span
                          className={`text-xs ${
                            deal.daysSinceUpdate > 7
                              ? "text-red-500"
                              : "text-muted-foreground"
                          }`}
                        >
                          {deal.daysSinceUpdate}日前
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
