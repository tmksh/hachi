"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Search, Plus, HardHat, ArrowUpDown } from "lucide-react";
import { getConstructions } from "@/lib/actions/constructions";
import { getProfiles } from "@/lib/actions/profiles";
import type { Profile } from "@/lib/database.types";

type Row = Awaited<ReturnType<typeof getConstructions>>[number];

type SortKey = "created_at" | "order_amount_asc" | "order_amount_desc" | "start_date";

const SORT_LABELS: Record<SortKey, string> = {
  created_at: "登録日（新しい順）",
  order_amount_asc: "受注額（低い順）",
  order_amount_desc: "受注額（高い順）",
  start_date: "着工日順",
};

export default function ConstructionsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("_all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");

  useEffect(() => {
    Promise.all([
      getConstructions(),
      getProfiles(),
    ]).then(([c, p]) => {
      setRows(c);
      setProfiles(p);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let result = rows.filter((r) => {
      const matchSearch = !q ||
        r.construction_no.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        (r.customer?.name ?? "").toLowerCase().includes(q);
      const matchTab = tab === "all" || r.status === tab;
      const matchAssignee = assigneeFilter === "_all" || r.assignee?.id === assigneeFilter || (assigneeFilter === "_unassigned" && !r.assignee);
      return matchSearch && matchTab && matchAssignee;
    });

    result = [...result].sort((a, b) => {
      if (sortKey === "order_amount_asc") return (a.order_amount ?? 0) - (b.order_amount ?? 0);
      if (sortKey === "order_amount_desc") return (b.order_amount ?? 0) - (a.order_amount ?? 0);
      if (sortKey === "start_date") return (a.start_date ?? "").localeCompare(b.start_date ?? "");
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [rows, search, tab, assigneeFilter, sortKey]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="工事管理" description="工事の進捗と原価を管理">
        <Link href="/constructions/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />新規工事
          </Button>
        </Link>
      </PageHeader>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "総工事数", val: rows.length },
          { label: "施工中", val: rows.filter((r) => r.status === "in_progress").length },
          { label: "着工前", val: rows.filter((r) => r.status === "preparing").length },
          { label: "完了", val: rows.filter((r) => r.status === "completed").length },
        ].map((k, i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-3">
              <span className="text-xs text-muted-foreground">{k.label}</span>
              {loading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl font-semibold">{k.val}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* フィルタ行 */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="工事名・顧客名で検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="担当者" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">担当者：すべて</SelectItem>
            <SelectItem value="_unassigned">未割り当て</SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="w-[180px]">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <SelectItem key={k} value={k}>{SORT_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(assigneeFilter !== "_all" || sortKey !== "created_at" || search) && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground h-9"
            onClick={() => { setAssigneeFilter("_all"); setSortKey("created_at"); setSearch(""); }}
          >
            リセット
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">すべて</TabsTrigger>
          <TabsTrigger value="in_progress">施工中</TabsTrigger>
          <TabsTrigger value="preparing">着工前</TabsTrigger>
          <TabsTrigger value="completed">完了</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {search || assigneeFilter !== "_all" ? "検索条件に一致する工事がありません" : "該当なし"}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((r) => (
                <Card
                  key={r.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => router.push(`/constructions/${r.id}`)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <HardHat className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{r.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {r.construction_no} · {r.customer?.name ?? "-"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={r.status} />
                        <span className="text-sm font-semibold tabular-nums">{r.progress}%</span>
                      </div>
                    </div>
                    <Progress value={r.progress} className="h-2" />
                    <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
                      <span>受注額: ¥{(r.order_amount ?? 0).toLocaleString()}</span>
                      <span>工期: {r.start_date ?? "-"} ~ {r.end_date ?? "-"}</span>
                      {r.assignee ? (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                          {r.assignee.display_name}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 text-muted-foreground">
                          未割り当て
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
