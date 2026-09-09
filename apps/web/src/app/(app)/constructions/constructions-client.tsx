"use client";

import { useQuerySeedAt } from "@/hooks/use-query-seed-at";
import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { KpiRow } from "@/components/shared/kpi-row";
import { StatusSelect } from "@/components/shared/status-select";
import { CustomerAvatar } from "@/components/shared/customer-avatar";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";
import { Search, Plus, HardHat, ArrowUpDown, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { deleteConstruction, updateConstruction } from "@/lib/actions/constructions";
import { getStatusOption } from "@/lib/status-config";
import { fetchConstructions, fetchProfiles, LIST_STALE_MS, type ConstructionListRow } from "@/lib/queries/lists";
import { prefetchConstructionDetail } from "@/lib/nav-prefetch";
import type { Profile } from "@/lib/database.types";

type Row = ConstructionListRow;

type SortKey = "created_at" | "order_amount_asc" | "order_amount_desc" | "start_date";

const SORT_LABELS: Record<SortKey, string> = {
  created_at: "登録日（新しい順）",
  order_amount_asc: "受注額（低い順）",
  order_amount_desc: "受注額（高い順）",
  start_date: "着工日順",
};

function fmt(v: number) {
  return `¥${Math.round(v / 10000).toLocaleString()}万`;
}

function fmtPeriod(start: string | null, end: string | null) {
  if (!start && !end) return "-";
  return `${start ?? "-"} 〜 ${end ?? "-"}`;
}

type ConstructionsClientProps = {
  initialRows?: Row[];
  initialProfiles?: Profile[];
};

export function ConstructionsClient({ initialRows, initialProfiles }: ConstructionsClientProps) {
  const querySeedAt = useQuerySeedAt();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: rows = [], isPending } = useQuery({
    queryKey: ["constructions"],
    queryFn: fetchConstructions,
    staleTime: LIST_STALE_MS,
    initialData: initialRows,
    initialDataUpdatedAt: initialRows ? querySeedAt : undefined,
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: fetchProfiles,
    staleTime: 5 * 60_000,
    initialData: initialProfiles,
    initialDataUpdatedAt: initialProfiles ? querySeedAt : undefined,
  });
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("_all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const setRows = (updater: Row[] | ((prev: Row[]) => Row[])) => {
    queryClient.setQueryData<Row[]>(["constructions"], (prev = []) =>
      typeof updater === "function" ? updater(prev) : updater,
    );
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteConstruction(deleteTarget.id);
      setRows(prev => prev.filter(r => r.id !== deleteTarget.id));
    } catch { /* ignore */ } finally { setDeleting(false); setDeleteTarget(null); }
  };

  const handleStatusChange = async (id: string, status: Row["status"]) => {
    const prev = rows;
    setRows((current) => current.map((r) => (r.id === id ? { ...r, status } : r)));
    setUpdating(id);
    try {
      await updateConstruction(id, { status });
      toast.success(`ステータスを「${getStatusOption("construction", status)?.label ?? status}」に変更しました`);
    } catch {
      setRows(prev);
      toast.error("ステータスの更新に失敗しました");
    } finally {
      setUpdating(null);
    }
  };

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

  if (isPending && rows.length === 0) {
    return <PageLoadingFallback />;
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="工事管理" description="工事の進捗と原価を管理">
        <Link href="/constructions/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />新規工事
          </Button>
        </Link>
      </PageHeader>

      <KpiRow
        items={[
          { label: "総工事数", value: rows.length, sub: "件", icon: HardHat },
          { label: "施工中", value: rows.filter((r) => r.status === "in_progress").length, sub: "件", icon: HardHat },
          { label: "着工前", value: rows.filter((r) => r.status === "preparing").length, sub: "件", icon: HardHat },
          { label: "完了", value: rows.filter((r) => r.status === "completed").length, sub: "件", icon: CheckCircle2 },
        ]}
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="名称・顧客名で検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={tab} onValueChange={setTab}>
          <SelectTrigger className="w-[140px] shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="in_progress">施工中</SelectItem>
            <SelectItem value="preparing">着工前</SelectItem>
            <SelectItem value="completed">完了</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-sm text-muted-foreground whitespace-nowrap">担当者</span>
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="すべて" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">すべて</SelectItem>
              <SelectItem value="_unassigned">未割り当て</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="min-w-[12.5rem] w-auto [&_[data-slot=select-value]]:line-clamp-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <SelectItem key={k} value={k}>{SORT_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(assigneeFilter !== "_all" || sortKey !== "created_at" || search || tab !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-xs text-muted-foreground h-9"
            onClick={() => { setTab("all"); setAssigneeFilter("_all"); setSortKey("created_at"); setSearch(""); }}
          >
            リセット
          </Button>
        )}
      </div>
      <Card variant="inset">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>顧客名</TableHead>
                    <TableHead>工事番号</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead className="text-right">受注額</TableHead>
                    <TableHead>工期</TableHead>
                    <TableHead className="w-[120px]">進捗</TableHead>
                    <TableHead>担当</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        {search || assigneeFilter !== "_all" ? "検索条件に一致する工事がありません" : "該当なし"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((r) => (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer glass-row group"
                        onMouseEnter={() => prefetchConstructionDetail(queryClient, r.id)}
                        onClick={() => router.push(`/constructions/${r.id}`)}
                      >
                        <TableCell>
                          {r.customer ? (
                            <div className="flex items-center gap-2.5">
                              <CustomerAvatar seed={r.customer.id} name={r.customer.name} />
                              <span className="font-medium">{r.customer.name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/constructions/${r.id}`}
                            className="font-medium text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {r.construction_no}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate">{r.title}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{fmt(r.order_amount ?? 0)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {fmtPeriod(r.start_date, r.end_date)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[96px]">
                            <Progress value={r.progress} className="h-1.5 flex-1" />
                            <span className="text-xs tabular-nums text-muted-foreground w-8 shrink-0 text-right">
                              {r.progress}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {r.assignee ? (
                            <span className="text-sm">{r.assignee.display_name}</span>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal text-muted-foreground">
                              未割り当て
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusSelect
                            entity="construction"
                            value={r.status}
                            disabled={updating === r.id}
                            onValueChange={(v) => handleStatusChange(r.id, v as Row["status"])}
                          />
                        </TableCell>
                        <TableCell>
                          <button
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>工事を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>「{deleteTarget?.construction_no} {deleteTarget?.title}」を削除します。タスク・下請け発注も含めて削除されます。この操作は取り消せません。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={handleDelete} disabled={deleting}>削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
