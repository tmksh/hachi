"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, FileText, TrendingUp, Clock, CheckCircle, XCircle, ChevronRight } from "lucide-react";

interface Quote {
  id: string;
  number: string;
  customer: string;
  subject: string;
  amount: number;
  status: string;
  createdAt: string;
}

const quotes: Quote[] = [
  { id: "1",  number: "Q-2026-001", customer: "田中建設株式会社",     subject: "渋谷マンション外壁塗装工事",   amount: 4800000,  status: "approved",  createdAt: "2026-01-10" },
  { id: "2",  number: "Q-2026-002", customer: "鈴木工務店",           subject: "店舗内装リフォーム工事",       amount: 4500000,  status: "submitted", createdAt: "2026-01-25" },
  { id: "3",  number: "Q-2026-003", customer: "佐藤 一郎",            subject: "マンション改修工事",           amount: 2200000,  status: "draft",     createdAt: "2026-02-05" },
  { id: "4",  number: "Q-2026-004", customer: "加藤総合建設株式会社", subject: "オフィスビル改装工事",         amount: 15000000, status: "submitted", createdAt: "2026-02-12" },
  { id: "5",  number: "Q-2026-005", customer: "田中建設株式会社",     subject: "品川倉庫リフォーム工事",       amount: 8200000,  status: "submitted", createdAt: "2026-02-20" },
  { id: "6",  number: "Q-2026-006", customer: "渡辺リフォーム株式会社", subject: "共同住宅リノベーション",     amount: 8900000,  status: "draft",     createdAt: "2026-02-28" },
  { id: "7",  number: "Q-2026-007", customer: "高橋 健二",            subject: "自宅全面リフォーム工事",       amount: 5500000,  status: "rejected",  createdAt: "2026-01-18" },
  { id: "8",  number: "Q-2026-008", customer: "西川工業株式会社",     subject: "工場屋根修繕工事",             amount: 6200000,  status: "draft",     createdAt: "2026-03-01" },
  { id: "9",  number: "Q-2026-009", customer: "伊藤設計事務所",       subject: "設計事務所移転工事",           amount: 3200000,  status: "approved",  createdAt: "2025-12-20" },
  { id: "10", number: "Q-2026-010", customer: "中村建設",             subject: "倉庫改修工事",                 amount: 3500000,  status: "draft",     createdAt: "2026-03-03" },
];

function formatAmount(n: number) {
  return `¥${Math.round(n / 10000).toLocaleString()}万`;
}

const STATUS_LEFT_COLOR: Record<string, string> = {
  approved:  "bg-green-400",
  submitted: "bg-blue-400",
  draft:     "bg-muted-foreground/30",
  rejected:  "bg-red-400",
};

function QuoteRow({ quote }: { quote: Quote }) {
  return (
    <Link href={`/quotes/${quote.id}`}>
      <div className="relative flex items-center gap-4 px-5 py-3.5 hover:bg-white/30 transition-colors duration-150 cursor-pointer group">
        {/* Status left bar */}
        <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full ${STATUS_LEFT_COLOR[quote.status] ?? "bg-muted"}`} />

        {/* Quote number */}
        <span className="font-mono text-xs text-muted-foreground w-28 shrink-0">{quote.number}</span>

        {/* Subject + customer */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{quote.subject}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{quote.customer}</p>
        </div>

        {/* Amount */}
        <span className="text-sm font-semibold tabular-nums shrink-0 w-20 text-right">{formatAmount(quote.amount)}</span>

        {/* Status */}
        <div className="shrink-0 w-24 flex justify-center">
          <StatusBadge status={quote.status} />
        </div>

        {/* Date */}
        <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-20 text-right">{quote.createdAt.slice(5).replace("-", "/")}</span>

        {/* Arrow */}
        <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground transition-colors" />
      </div>
    </Link>
  );
}

function QuoteList({ items }: { items: Quote[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <FileText className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">該当する見積がありません</p>
      </div>
    );
  }
  return (
    <div>
      {/* List header */}
      <div className="flex items-center gap-4 px-5 py-2 border-b border-white/20">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground w-28 shrink-0">見積番号</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex-1">件名 / 顧客</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground w-20 text-right shrink-0">金額</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground w-24 text-center shrink-0">ステータス</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground w-20 text-right shrink-0">作成日</span>
        <span className="w-4 shrink-0" />
      </div>
      <div className="divide-y divide-white/15">
        {items.map((q) => <QuoteRow key={q.id} quote={q} />)}
      </div>
    </div>
  );
}

export default function QuotesListPage() {
  const [tab, setTab] = useState("all");

  const filteredQuotes = tab === "all" ? quotes : quotes.filter((q) => q.status === tab);

  const totalAmount   = quotes.reduce((s, q) => s + q.amount, 0);
  const approvedCount = quotes.filter((q) => q.status === "approved").length;
  const pendingCount  = quotes.filter((q) => q.status === "submitted").length;
  const draftCount    = quotes.filter((q) => q.status === "draft").length;

  const kpis = [
    { label: "総見積金額",   value: formatAmount(totalAmount),    icon: TrendingUp,   color: "text-primary" },
    { label: "承認済み",     value: `${approvedCount}件`,          icon: CheckCircle,  color: "text-green-500" },
    { label: "提出済み",     value: `${pendingCount}件`,           icon: Clock,        color: "text-blue-500" },
    { label: "却下",         value: `${quotes.filter(q => q.status === "rejected").length}件`, icon: XCircle, color: "text-red-400" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="見積管理">
        <Link href="/quotes/new">
          <Button size="sm">
            <Plus className="size-4 mr-1" />
            新規見積
          </Button>
        </Link>
      </PageHeader>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="stat-card transition-[box-shadow,background-color] duration-200">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              <p className="text-xl font-semibold tabular-nums">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs + list */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">すべて <span className="ml-1.5 text-xs opacity-60">{quotes.length}</span></TabsTrigger>
          <TabsTrigger value="draft">下書き <span className="ml-1.5 text-xs opacity-60">{draftCount}</span></TabsTrigger>
          <TabsTrigger value="submitted">提出済み <span className="ml-1.5 text-xs opacity-60">{pendingCount}</span></TabsTrigger>
          <TabsTrigger value="approved">承認済み <span className="ml-1.5 text-xs opacity-60">{approvedCount}</span></TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-3">
          <Card className="overflow-hidden">
            <QuoteList items={filteredQuotes} />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
