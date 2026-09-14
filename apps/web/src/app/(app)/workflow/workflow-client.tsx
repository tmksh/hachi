"use client";

import { useQuerySeedAt } from "@/hooks/use-query-seed-at";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatusSelect } from "@/components/shared/status-select";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { updateWorkflowRequestStatus } from "@/lib/actions/workflow";
import { fetchWorkflowRequests } from "@/lib/queries/lists";
import { QK } from "@/lib/queries/portal";
import { getStatusOption, getWorkflowStatusLabel, isWorkflowRemanded } from "@/lib/status-config";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";

type Row = Awaited<ReturnType<typeof fetchWorkflowRequests>>[number];
const TYPE_LABELS: Record<string, string> = { expense: "経費", leave: "休暇", purchase: "購入", custom: "その他" };

type WorkflowClientProps = {
  initialRows?: Row[];
};

export function WorkflowClient({ initialRows }: WorkflowClientProps) {
  const querySeedAt = useQuerySeedAt();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: rows = [], isPending } = useQuery({
    queryKey: QK.workflowRequests,
    queryFn: () => fetchWorkflowRequests(),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    initialData: initialRows,
    initialDataUpdatedAt: initialRows ? querySeedAt : undefined,
  });
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  const setRows = (updater: Row[] | ((prev: Row[]) => Row[])) => {
    queryClient.setQueryData<Row[]>(QK.workflowRequests, (prev = []) =>
      typeof updater === "function" ? updater(prev) : updater,
    );
  };

  const handleStatusChange = async (id: string, status: Row["status"]) => {
    const prev = rows;
    setRows((current) => current.map((r) => (r.id === id ? { ...r, status } : r)));
    setUpdating(id);
    try {
      await updateWorkflowRequestStatus(id, status);
      toast.success(`ステータスを「${getStatusOption("workflow", status)?.label ?? status}」に変更しました`);
    } catch {
      setRows(prev);
      toast.error("ステータスの更新に失敗しました");
    } finally {
      setUpdating(null);
    }
  };

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    const typeLabel = TYPE_LABELS[r.workflow_type?.key ?? ""] || "その他";
    const match =
      !q ||
      r.title.toLowerCase().includes(q) ||
      (r.requester?.display_name ?? "").toLowerCase().includes(q) ||
      typeLabel.toLowerCase().includes(q);
    const matchTab =
      tab === "all"
      || (tab === "returned" && isWorkflowRemanded(r.status, (r.payload ?? null) as Record<string, unknown> | null))
      || (tab === "rejected" && r.status === "rejected" && !isWorkflowRemanded(r.status, (r.payload ?? null) as Record<string, unknown> | null))
      || (tab !== "returned" && tab !== "rejected" && r.status === tab);
    return match && matchTab;
  });

  if (isPending && rows.length === 0) {
    return <PageLoadingFallback />;
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="ワークフロー" description="申請と承認の管理"><Link href="/workflow/new"><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />新規申請</Button></Link></PageHeader>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="件名・申請者で検索..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={tab} onValueChange={setTab}>
          <SelectTrigger className="w-[140px] shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="submitted">申請中</SelectItem>
            <SelectItem value="returned">差戻し</SelectItem>
            <SelectItem value="approved">承認済</SelectItem>
            <SelectItem value="rejected">却下</SelectItem>
            <SelectItem value="cancelled">取消</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card variant="inset"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>タイプ</TableHead><TableHead>件名</TableHead><TableHead>申請者</TableHead><TableHead className="text-right">金額</TableHead><TableHead>ステータス</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">該当なし</TableCell></TableRow> : filtered.map(r => (
                <TableRow key={r.id} className="cursor-pointer glass-row" onMouseEnter={() => router.prefetch(`/workflow/${r.id}`)} onClick={() => router.push(`/workflow/${r.id}`)}>
                  <TableCell><Badge variant="outline">{TYPE_LABELS[r.workflow_type?.key ?? ""] || "その他"}</Badge></TableCell>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell>{r.requester?.display_name ?? "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.amount ? `¥${r.amount.toLocaleString()}` : "-"}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {isWorkflowRemanded(r.status, (r.payload ?? null) as Record<string, unknown> | null) || r.status === "cancelled" || r.status === "approved" ? (
                      <StatusBadge
                        status={isWorkflowRemanded(r.status, (r.payload ?? null) as Record<string, unknown> | null) ? "returned" : r.status}
                        label={getWorkflowStatusLabel(
                          r.status,
                          (r.payload ?? null) as Record<string, unknown> | null,
                        )}
                      />
                    ) : (
                      <StatusSelect
                        entity="workflow"
                        value={r.status}
                        disabled={updating === r.id}
                        onValueChange={(v) => handleStatusChange(r.id, v as Row["status"])}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody></Table></div></Card>
    </div>
  );
}
