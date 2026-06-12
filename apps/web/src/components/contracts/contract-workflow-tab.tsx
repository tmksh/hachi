"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Loader2, ExternalLink, FileText } from "lucide-react";
import { toast } from "sonner";
import { getContractWorkflowRequests, submitContractWorkflow } from "@/lib/actions/contract-features";
import { findTemplate, type FormValues } from "@/lib/contract-templates";
import type { ContractDetail } from "./contract-detail-types";

type WorkflowRow = Awaited<ReturnType<typeof getContractWorkflowRequests>>[number];

function parseContractDraft(notes: string | null | undefined): { template_id: string; form: FormValues } | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes) as { contract_draft?: { template_id: string; form: FormValues } };
    if (parsed.contract_draft?.template_id) return parsed.contract_draft;
  } catch {
    // plain text notes
  }
  return null;
}

export function ContractWorkflowTab({
  contractId,
  data,
  onRefresh,
}: {
  contractId: string;
  data: ContractDetail;
  onRefresh?: () => void;
}) {
  const router = useRouter();
  const draft = useMemo(() => parseContractDraft(data.notes), [data.notes]);
  const template = draft?.template_id ? findTemplate(draft.template_id) : null;
  const form = draft?.form ?? {};
  const excl = Number(form.amount_excl_tax) || data.amount || 0;
  const taxRate = Number(form.tax_rate) || 10;
  const totalAmount = excl > 0 ? excl + Math.floor(excl * taxRate / 100) : (data.amount ?? 0);

  const [history, setHistory] = useState<WorkflowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadHistory = () => {
    setLoading(true);
    getContractWorkflowRequests(contractId)
      .then(setHistory)
      .catch(() => toast.error("ワークフロー履歴の取得に失敗しました"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadHistory(); }, [contractId]);

  const pending = history.find((r) => r.status === "submitted");
  const filtered = history.filter((r) => tab === "all" || r.status === tab);

  const submit = async () => {
    setSubmitting(true);
    try {
      const req = await submitContractWorkflow(contractId, data.title);
      toast.success("承認ワークフローに申請しました");
      setConfirmOpen(false);
      loadHistory();
      onRefresh?.();
      router.push(`/workflow/${req.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "申請に失敗");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">最新契約書の内容でワークフロー申請を行います</p>
              <p className="text-xs text-muted-foreground mt-1">
                書類作成タブの下書き内容がそのまま申請データとしてポータルのワークフローに連携されます。
              </p>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground text-xs">テンプレート</span><p className="font-medium">{template?.name ?? "工事請負契約書"}</p></div>
            <div><span className="text-muted-foreground text-xs">発注者（甲）</span><p className="font-medium">{String(form.kou_name ?? data.customer?.name ?? "—")}</p></div>
            <div><span className="text-muted-foreground text-xs">工事名称</span><p className="font-medium">{String(form.work_name ?? data.title)}</p></div>
            <div><span className="text-muted-foreground text-xs">契約金額</span><p className="font-medium tabular-nums">¥{totalAmount.toLocaleString()}</p></div>
            {(form.start_date || form.end_date || data.start_date || data.end_date) && (
              <div className="sm:col-span-2">
                <span className="text-muted-foreground text-xs">工期</span>
                <p className="font-medium">{String(form.start_date ?? data.start_date ?? "—")} ～ {String(form.end_date ?? data.end_date ?? "—")}</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {pending ? (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/workflow/${pending.id}`}>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  申請中 — 詳細を見る
                </Link>
              </Button>
            ) : (
              <Button size="sm" onClick={() => setConfirmOpen(true)}>承認ワークフローに申請</Button>
            )}
            <Button size="sm" variant="ghost" asChild>
              <Link href="/workflow" className="gap-1.5">
                ワークフロー一覧 <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-sm font-semibold mb-2">この契約のワークフロー履歴</h3>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">すべて</TabsTrigger>
            <TabsTrigger value="submitted">申請中</TabsTrigger>
            <TabsTrigger value="approved">承認済</TabsTrigger>
            <TabsTrigger value="rejected">却下</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-3">
            <Card variant="inset">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>件名</TableHead>
                      <TableHead>申請者</TableHead>
                      <TableHead className="text-right">金額</TableHead>
                      <TableHead>申請日</TableHead>
                      <TableHead>ステータス</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />読み込み中...</TableCell></TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">履歴がありません</TableCell></TableRow>
                    ) : filtered.map((r) => (
                      <TableRow key={r.id} className="cursor-pointer glass-row" onClick={() => router.push(`/workflow/${r.id}`)}>
                        <TableCell className="font-medium">{r.title}</TableCell>
                        <TableCell>{r.requester?.display_name ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.amount ? `¥${r.amount.toLocaleString()}` : "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                          {format(new Date(r.created_at), "yyyy/M/d HH:mm", { locale: ja })}
                        </TableCell>
                        <TableCell><StatusBadge status={r.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>社内承認を取りますか？</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>契約書の内容を確定し、社内承認ワークフロー（営業部長 / 工事課長 / 取締役 等）に申請します。</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>テンプレート: {template?.name ?? "—"}</li>
                  <li>工事名称: {String(form.work_name ?? data.title)}</li>
                  <li>契約金額: ¥{totalAmount.toLocaleString()}</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>キャンセル</AlertDialogCancel>
            <AlertDialogAction disabled={submitting} onClick={(e) => { e.preventDefault(); void submit(); }}>
              {submitting ? "申請中..." : "申請する"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
