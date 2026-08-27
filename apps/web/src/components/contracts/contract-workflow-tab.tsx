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
import {
  getContractApprovalWorkflowTypes,
  getContractWorkflowRequests,
  submitContractWorkflow,
  type ContractApprovalWorkflowType,
} from "@/lib/actions/contract-features";
import { findTemplate, type FormValues } from "@/lib/contract-templates";
import { getWorkflowStatusLabel, isWorkflowRemanded } from "@/lib/status-config";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
  onEsignEnabled,
}: {
  contractId: string;
  data: ContractDetail;
  onRefresh?: () => void;
  onEsignEnabled?: () => void;
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
  const [wfTypes, setWfTypes] = useState<ContractApprovalWorkflowType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState("");

  const loadHistory = () => {
    setLoading(true);
    getContractWorkflowRequests(contractId)
      .then(setHistory)
      .catch(() => toast.error("ワークフロー履歴の取得に失敗しました"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadHistory(); }, [contractId]);

  useEffect(() => {
    getContractApprovalWorkflowTypes()
      .then((types) => {
        setWfTypes(types);
        setSelectedTypeId((prev) => prev || types[0]?.id || "");
      })
      .catch(() => {});
  }, []);

  const selectedType = wfTypes.find((t) => t.id === selectedTypeId) ?? wfTypes[0] ?? null;

  const pending = history.find((r) => r.status === "submitted");
  const remanded = history.find((r) => isWorkflowRemanded(r.status, r.payload as Record<string, unknown> | null));
  const approved = history.some((r) => r.status === "approved");
  const filtered = history.filter((r) => {
    if (tab === "all") return true;
    if (tab === "rejected") {
      return r.status === "rejected" && !isWorkflowRemanded(r.status, r.payload as Record<string, unknown> | null);
    }
    if (tab === "returned") {
      return isWorkflowRemanded(r.status, r.payload as Record<string, unknown> | null);
    }
    return r.status === tab;
  });

  useEffect(() => {
    if (approved) onEsignEnabled?.();
  }, [approved, onEsignEnabled]);

  const submit = async () => {
    if (!selectedTypeId && wfTypes.length > 0) {
      toast.error("承認ワークフロー種別を選択してください");
      return;
    }
    setSubmitting(true);
    try {
      const req = await submitContractWorkflow(contractId, data.title, selectedTypeId || undefined);
      if (!req.ok) {
        toast.error(req.error);
        return;
      }
      const steps = selectedType?.approvalSteps.length ?? 0;
      toast.success(
        steps > 1
          ? `承認ワークフローに申請しました（${steps}段階）`
          : "承認ワークフローに申請しました",
      );
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
                書類作成タブの下書き内容がそのまま申請データとして連携されます。
                多段階承認（上長→総務など）は
                <Link href="/settings?tab=organization&sub=workflow_types" className="text-primary underline mx-1">
                  設定＞組織＞ワークフロー
                </Link>
                で承認ルートを並べて構成できます。
              </p>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground text-xs">テンプレート</span><p className="font-medium">{template?.name ?? "工事請負契約書"}</p></div>
            <div><span className="text-muted-foreground text-xs">発注者（甲）</span><p className="font-medium">{String(form.kou_name ?? data.customer?.name ?? "—")}</p></div>
            <div><span className="text-muted-foreground text-xs">名称</span><p className="font-medium">{String(form.work_name ?? data.title)}</p></div>
            <div><span className="text-muted-foreground text-xs">契約金額</span><p className="font-medium tabular-nums">¥{totalAmount.toLocaleString()}</p></div>
            {(form.start_date || form.end_date || data.start_date || data.end_date) && (
              <div className="sm:col-span-2">
                <span className="text-muted-foreground text-xs">工期</span>
                <p className="font-medium">{String(form.start_date ?? data.start_date ?? "—")} ～ {String(form.end_date ?? data.end_date ?? "—")}</p>
              </div>
            )}
          </div>

          {remanded && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-sm text-amber-950 space-y-2">
              <p className="font-medium">差戻しされています</p>
              <p className="text-xs text-amber-900/90">
                {(remanded.payload as { remand_comment?: string } | null)?.remand_comment
                  ? `指摘: ${(remanded.payload as { remand_comment?: string }).remand_comment}`
                  : "指摘内容を確認し、書類作成タブで修正のうえ再申請してください。"}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="h-8" asChild>
                  <Link href={`/workflow/${remanded.id}`}>差戻し詳細</Link>
                </Button>
                <Button
                  size="sm"
                  className="h-8 bg-amber-700 hover:bg-amber-800"
                  onClick={() => {
                    // 書類作成タブ（仕様 Step15）へ戻る
                    router.push(`/contracts/${contractId}?tab=documents`);
                  }}
                >
                  書類作成タブで修正する
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {pending && !remanded ? (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/workflow/${pending.id}`}>
                  申請中 — 詳細を見る
                </Link>
              </Button>
            ) : remanded ? (
              <Button size="sm" onClick={() => setConfirmOpen(true)}>再申請する</Button>
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
            <TabsTrigger value="returned">差戻し</TabsTrigger>
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
                        <TableCell>
                          <StatusBadge
                            status={r.status}
                            label={getWorkflowStatusLabel(r.status, r.payload as Record<string, unknown> | null)}
                          />
                        </TableCell>
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
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>契約書の内容を確定し、ポータルで設定した承認ルートどおりに申請します。</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>テンプレート: {template?.name ?? "—"}</li>
                  <li>名称: {String(form.work_name ?? data.title)}</li>
                  <li>契約金額: ¥{totalAmount.toLocaleString()}</li>
                </ul>
                {wfTypes.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-medium text-foreground">承認ワークフロー種別</p>
                    <Select value={selectedType?.id ?? ""} onValueChange={setSelectedTypeId}>
                      <SelectTrigger className="h-9 bg-background">
                        <SelectValue placeholder="種別を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {wfTypes.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                            {t.approvalSteps.length > 0
                              ? `（${t.approvalSteps.length}段階）`
                              : "（ルート未設定）"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedType && selectedType.approvalSteps.length > 0 ? (
                      <div className="space-y-1.5">
                        <ol className="rounded-md border bg-background px-3 py-2 space-y-1 text-xs text-foreground">
                          {selectedType.approvalSteps.map((s) => (
                            <li key={`${s.stepOrder}-${s.approverId}`}>
                              Step {s.stepOrder}: {s.displayName}
                              {s.isAdministration && (
                                <span className="ml-1 text-teal-700">（総務・追記可）</span>
                              )}
                            </li>
                          ))}
                        </ol>
                        {!selectedType.hasAdministrationApprover && (
                          <p className="text-[11px] text-teal-800">
                            ルートに総務がいません。申請時に総務ロールを最終ステップへ自動追加します。
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-amber-700">
                        承認ルートが未設定です。
                        <Link href="/settings?tab=organization&sub=workflow_types" className="underline ml-1">
                          設定で追加
                        </Link>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-amber-700">
                    契約書用のワークフロー種別がありません。
                    <Link href="/settings?tab=organization&sub=workflow_types" className="underline ml-1">
                      設定＞組織＞ワークフロー
                    </Link>
                    で「契約書承認」等を作成してください。
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting || !selectedType || selectedType.approvalSteps.length === 0}
              onClick={(e) => { e.preventDefault(); void submit(); }}
            >
              {submitting ? "申請中..." : "申請する"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
