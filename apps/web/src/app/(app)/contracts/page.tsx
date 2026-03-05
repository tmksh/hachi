"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Search, Plus, FileSignature, TrendingUp } from "lucide-react";

const contracts = [
  {
    id: "CT-2025-001",
    customer: "山田太郎",
    type: "新築工事",
    amount: 32000000,
    date: "2025-09-15",
    status: "executing",
  },
  {
    id: "CT-2025-002",
    customer: "田中工務店",
    type: "リフォーム",
    amount: 8500000,
    date: "2025-10-01",
    status: "executing",
  },
  {
    id: "CT-2025-003",
    customer: "鈴木商事株式会社",
    type: "ビル改修",
    amount: 58000000,
    date: "2025-11-20",
    status: "executing",
  },
  {
    id: "CT-2026-001",
    customer: "佐藤花子",
    type: "増築工事",
    amount: 12000000,
    date: "2026-01-10",
    status: "contracted",
  },
  {
    id: "CT-2026-002",
    customer: "中村建設株式会社",
    type: "外壁工事",
    amount: 4500000,
    date: "2026-02-01",
    status: "contracted",
  },
  {
    id: "CT-2026-003",
    customer: "加藤次郎",
    type: "耐震補強",
    amount: 6800000,
    date: "2026-02-15",
    status: "draft",
  },
  {
    id: "CT-2025-004",
    customer: "松本美咲",
    type: "リフォーム",
    amount: 3200000,
    date: "2025-06-01",
    status: "completed",
  },
  {
    id: "CT-2025-005",
    customer: "小林株式会社",
    type: "内装工事",
    amount: 15000000,
    date: "2025-07-15",
    status: "completed",
  },
];

function formatCurrency(value: number) {
  const man = Math.round(value / 10000);
  return `¥${new Intl.NumberFormat("ja-JP").format(man)}万`;
}

const totalContracts = contracts.length;
const totalAmount = contracts.reduce((sum, c) => sum + c.amount, 0);
const activeContracts = contracts.filter(
  (c) => c.status === "executing" || c.status === "contracted"
).length;
const activeAmount = contracts
  .filter((c) => c.status === "executing" || c.status === "contracted")
  .reduce((sum, c) => sum + c.amount, 0);

export default function ContractsListPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");

  const filtered = contracts.filter((c) => {
    const matchSearch =
      search === "" ||
      c.id.includes(search) ||
      c.customer.includes(search) ||
      c.type.includes(search);
    const matchTab =
      tab === "all" ||
      c.status === tab ||
      (tab === "active" && (c.status === "executing" || c.status === "contracted"));
    return matchSearch && matchTab;
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="契約管理" description="契約の締結状況と入金を管理します">
        <Link href="/contracts/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            新規契約
          </Button>
        </Link>
      </PageHeader>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="stat-card transition-[box-shadow,background-color] duration-200">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">総契約数</span>
              <FileSignature className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-semibold tabular-nums">{totalContracts}</p>
          </CardContent>
        </Card>
        <Card className="stat-card transition-[box-shadow,background-color] duration-200">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">総契約金額</span>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-semibold tabular-nums">
              {formatCurrency(totalAmount)}
            </p>
          </CardContent>
        </Card>
        <Card className="stat-card transition-[box-shadow,background-color] duration-200">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">有効契約数</span>
              <FileSignature className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-semibold tabular-nums">{activeContracts}</p>
          </CardContent>
        </Card>
        <Card className="stat-card transition-[box-shadow,background-color] duration-200">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">有効契約金額</span>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-semibold tabular-nums">
              {formatCurrency(activeAmount)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="契約番号、顧客名、種別で検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Status Filter Tabs + Table */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">すべて</TabsTrigger>
          <TabsTrigger value="active">有効</TabsTrigger>
          <TabsTrigger value="draft">下書き</TabsTrigger>
          <TabsTrigger value="completed">完了</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>契約番号</TableHead>
                    <TableHead>顧客名</TableHead>
                    <TableHead>契約種別</TableHead>
                    <TableHead className="text-right">金額</TableHead>
                    <TableHead>締結日</TableHead>
                    <TableHead>ステータス</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-accent/50" onClick={() => router.push(`/contracts/${c.id}`)}>
                      <TableCell>
                        <Link
                          href={`/contracts/${c.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {c.id}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">{c.customer}</TableCell>
                      <TableCell className="text-sm">{c.type}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums font-medium">
                        {formatCurrency(c.amount)}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">{c.date}</TableCell>
                      <TableCell>
                        <StatusBadge status={c.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        該当する契約が見つかりません
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
