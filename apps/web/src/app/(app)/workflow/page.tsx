"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusSelect } from "@/components/shared/status-select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { getWorkflowRequests, updateWorkflowRequestStatus } from "@/lib/actions/workflow";
import { getStatusOption } from "@/lib/status-config";

type Row = Awaited<ReturnType<typeof getWorkflowRequests>>[number];
const TYPE_LABELS: Record<string, string> = { expense: "経費", leave: "休暇", purchase: "購入", custom: "その他" };

export default function WorkflowPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => { getWorkflowRequests().then(setRows).catch(() => {}).finally(() => setLoading(false)); }, []);

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

  const filtered = rows.filter(r => tab === "all" || r.status === tab);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="ワークフロー" description="申請と承認の管理"><Link href="/workflow/new"><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />新規申請</Button></Link></PageHeader>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="all">すべて</TabsTrigger><TabsTrigger value="submitted">申請中</TabsTrigger><TabsTrigger value="approved">承認済</TabsTrigger><TabsTrigger value="rejected">却下</TabsTrigger></TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card variant="inset"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>タイプ</TableHead><TableHead>件名</TableHead><TableHead>申請者</TableHead><TableHead className="text-right">金額</TableHead><TableHead>ステータス</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? Array.from({length:5}).map((_,i)=><TableRow key={i}><TableCell><Skeleton className="h-4 w-16"/></TableCell><TableCell><Skeleton className="h-4 w-32"/></TableCell><TableCell><Skeleton className="h-4 w-20"/></TableCell><TableCell><Skeleton className="h-4 w-16"/></TableCell><TableCell><Skeleton className="h-5 w-16"/></TableCell></TableRow>) : filtered.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">該当なし</TableCell></TableRow> : filtered.map(r => (
                <TableRow key={r.id} className="cursor-pointer glass-row" onClick={() => router.push(`/workflow/${r.id}`)}>
                  <TableCell><Badge variant="outline">{TYPE_LABELS[r.workflow_type?.key ?? ""] || "その他"}</Badge></TableCell>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell>{r.requester?.display_name ?? "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.amount ? `¥${r.amount.toLocaleString()}` : "-"}</TableCell>
                  <TableCell>
                    <StatusSelect
                      entity="workflow"
                      value={r.status}
                      disabled={updating === r.id}
                      onValueChange={(v) => handleStatusChange(r.id, v as Row["status"])}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody></Table></div></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
