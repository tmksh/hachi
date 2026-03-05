"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Search,
  Plus,
  HardHat,
  CheckCircle2,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";

const constructions = [
  {
    id: "C-001",
    name: "山田邸リノベーション工事",
    site: "東京都世田谷区成城3-12-5",
    manager: "田中太郎",
    startDate: "2025-10-01",
    endDate: "2026-04-30",
    progress: 75,
    status: "in_progress",
  },
  {
    id: "C-002",
    name: "田中ビル外壁改修工事",
    site: "東京都渋谷区代々木1-8-3",
    manager: "鈴木一郎",
    startDate: "2025-11-15",
    endDate: "2026-06-30",
    progress: 45,
    status: "in_progress",
  },
  {
    id: "C-003",
    name: "佐藤邸新築工事",
    site: "神奈川県横浜市青葉区美しが丘2-1-7",
    manager: "高橋健太",
    startDate: "2026-01-10",
    endDate: "2026-09-30",
    progress: 20,
    status: "in_progress",
  },
  {
    id: "C-004",
    name: "鈴木マンション大規模修繕",
    site: "東京都港区南青山4-5-10",
    manager: "伊藤美咲",
    startDate: "2025-06-01",
    endDate: "2026-02-28",
    progress: 100,
    status: "completed",
  },
  {
    id: "C-005",
    name: "中村商店改装工事",
    site: "千葉県船橋市本町7-3-2",
    manager: "渡辺直樹",
    startDate: "2026-04-01",
    endDate: "2026-07-31",
    progress: 0,
    status: "preparing",
  },
  {
    id: "C-006",
    name: "小林邸耐震補強工事",
    site: "埼玉県さいたま市浦和区高砂1-6-8",
    manager: "田中太郎",
    startDate: "2025-09-01",
    endDate: "2026-01-31",
    progress: 60,
    status: "delayed",
  },
  {
    id: "C-007",
    name: "加藤オフィスビル内装工事",
    site: "東京都千代田区丸の内2-4-1",
    manager: "高橋健太",
    startDate: "2026-05-01",
    endDate: "2026-08-31",
    progress: 0,
    status: "preparing",
  },
  {
    id: "C-008",
    name: "松本邸増築工事",
    site: "東京都杉並区荻窪5-11-3",
    manager: "伊藤美咲",
    startDate: "2025-12-01",
    endDate: "2026-05-31",
    progress: 35,
    status: "in_progress",
  },
];

const stats = [
  {
    label: "進行中",
    value: constructions.filter((c) => c.status === "in_progress").length,
    icon: HardHat,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    label: "完了",
    value: constructions.filter((c) => c.status === "completed").length,
    icon: CheckCircle2,
    color: "text-green-600",
    bg: "bg-green-50 dark:bg-green-900/20",
  },
  {
    label: "予定",
    value: constructions.filter((c) => c.status === "preparing").length,
    icon: CalendarClock,
    color: "text-orange-600",
    bg: "bg-orange-50 dark:bg-orange-900/20",
  },
  {
    label: "遅延",
    value: constructions.filter((c) => c.status === "delayed").length,
    icon: AlertTriangle,
    color: "text-red-600",
    bg: "bg-red-50 dark:bg-red-900/20",
  },
];

export default function ConstructionsListPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = constructions.filter((c) => {
    const matchSearch =
      search === "" ||
      c.name.includes(search) ||
      c.site.includes(search) ||
      c.manager.includes(search);
    const matchStatus =
      statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="工事管理" description="工事の進捗と現場情報を管理します">
        <Link href="/constructions/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            新規工事
          </Button>
        </Link>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, i) => (
          <Card key={i} className="stat-card transition-[box-shadow,background-color] duration-200">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{stat.label}</span>
                <div className={`h-8 w-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </div>
              <p className="text-2xl font-semibold tabular-nums">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="工事名、現場、担当で検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="in_progress">進行中</SelectItem>
            <SelectItem value="completed">完了</SelectItem>
            <SelectItem value="preparing">予定</SelectItem>
            <SelectItem value="delayed">遅延</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">工事名</TableHead>
                <TableHead className="min-w-[180px]">現場</TableHead>
                <TableHead>担当</TableHead>
                <TableHead>開始日</TableHead>
                <TableHead>完了予定</TableHead>
                <TableHead className="min-w-[140px]">進捗率</TableHead>
                <TableHead>ステータス</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-accent/50" onClick={() => router.push(`/constructions/${c.id}`)}>
                  <TableCell>
                    <Link
                      href={`/constructions/${c.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {c.name}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.id}</p>
                  </TableCell>
                  <TableCell className="text-sm">{c.site}</TableCell>
                  <TableCell className="text-sm">{c.manager}</TableCell>
                  <TableCell className="text-sm tabular-nums">{c.startDate}</TableCell>
                  <TableCell className="text-sm tabular-nums">{c.endDate}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={c.progress} className="h-2 flex-1" />
                      <span className="text-xs font-medium tabular-nums w-8 text-right">
                        {c.progress}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    該当する工事が見つかりません
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
