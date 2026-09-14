"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateWorkflowRelatedQueries } from "@/lib/workflow-cache";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/status-badge";
import { getWorkflowStatusLabel, isWorkflowRemanded } from "@/lib/status-config";
import { ArrowLeft, Check, X, CornerUpLeft, MessageSquare, Send, Sparkles, AlertTriangle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  approveWorkflowStep,
  approveWorkflowStepConditional,
  rejectWorkflowStep,
  remandWorkflowStep,
  addWorkflowComment,
  getWorkflowApprovalSupport,
  resubmitWorkflowRequest,
  cancelWorkflowRequest,
  type FieldDef,
} from "@/lib/actions/workflow";
import { fetchWorkflowRequest, QK } from "@/lib/queries/portal";
import { saveContractAdminSupplement } from "@/lib/actions/contract-features";
import type { ApprovalSupportResult } from "@/lib/integrations/linq-ai/types";
import { useAuth } from "@/hooks/use-auth";
import { isUuid, STANDALONE_WORKFLOW_KEYS } from "@/lib/tenant-host";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Detail = Awaited<ReturnType<typeof fetchWorkflowRequest>>;
type Step = {
  id: string;
  step_order: number;
  approver: { id: string; display_name: string; role?: string | null } | null;
  status: string;
  comment: string | null;
  decided_at?: string | null;
};
type Comment = {
  id: string;
  body: string;
  created_at: string;
  user: { id: string; display_name: string } | null;
};

type ActionType = "reject" | "remand" | "conditional" | "cancel";

const SYSTEM_PAYLOAD_KEYS = new Set([
  "contract_id",
  "template_id",
  "contract_draft",
  "remand",
  "admin_supplemented_by",
  "estimate_id",
  "resubmitted_at",
  "cancelled_at",
]);

type WorkflowDetailClientProps = {
  initialData: Detail | null;
  initialApprovalSupport: ApprovalSupportResult | null;
};

export function WorkflowDetailClient({
  initialData,
  initialApprovalSupport,
}: WorkflowDetailClientProps) {
  const { id } = useParams();
  const router = useRouter();
  const { user, profile, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [data, setData] = useState<Detail | null>(initialData);
  const [approvalSupport, setApprovalSupport] = useState<ApprovalSupportResult | null>(initialApprovalSupport);

  const [actionDialog, setActionDialog] = useState<{ type: ActionType; stepId: string } | null>(null);
  const [actionComment, setActionComment] = useState("");
  const [actioning, setActioning] = useState(false);

  const [commentBody, setCommentBody] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  const [paymentTerms, setPaymentTerms] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editPayload, setEditPayload] = useState<Record<string, string>>({});
  const [resubmitting, setResubmitting] = useState(false);

  const applyLocal = (detail: Detail | null) => {
    setData(detail);
    const payload = (detail as Detail & { payload?: Record<string, unknown> } | null)?.payload ?? {};
    setPaymentTerms(String(payload.payment_terms ?? ""));
    setBankAccount(String(payload.bank_account ?? ""));
    setAdminNotes(String(payload.admin_notes ?? ""));
    if (detail) {
      setEditTitle(detail.title ?? "");
      setEditAmount(detail.amount != null ? String(detail.amount) : "");
      setEditDueDate(detail.due_date ? String(detail.due_date).slice(0, 10) : "");
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(payload)) {
        if (SYSTEM_PAYLOAD_KEYS.has(k)) continue;
        if (v == null) continue;
        next[k] = String(v);
      }
      setEditPayload(next);
    }
  };

  const patchListRow = (row: {
    id: string;
    status?: string;
    payload?: Record<string, unknown>;
    title?: string | null;
    amount?: number | null;
    due_date?: string | null;
    decided_at?: string | null;
  }) => {
    queryClient.setQueryData(QK.workflowRequests, (prev: unknown) => {
      if (!Array.isArray(prev)) return prev;
      return prev.map((r: { id: string }) => (r.id === row.id ? { ...r, ...row } : r));
    });
  };

  const syncCaches = async (detail: Detail | null) => {
    if (!id) return;
    await queryClient.cancelQueries({ queryKey: QK.workflowRequests });
    await queryClient.cancelQueries({ queryKey: QK.workflowRequest(id as string) });
    queryClient.setQueryData(QK.workflowRequest(id as string), (prev: unknown) => {
      if (prev && typeof prev === "object" && prev !== null && "detail" in (prev as object)) {
        return { ...(prev as { detail: Detail | null; support: unknown }), detail };
      }
      return { detail, support: null };
    });
    if (detail) {
      patchListRow({
        id: detail.id,
        status: detail.status,
        payload: (detail as Detail & { payload?: Record<string, unknown> }).payload,
        title: detail.title,
        amount: detail.amount,
        due_date: detail.due_date,
        decided_at: detail.decided_at,
      });
    }
    await Promise.all([
      queryClient.refetchQueries({ queryKey: QK.workflowRequests }),
      queryClient.refetchQueries({ queryKey: QK.workflowRequest(id as string) }),
      invalidateWorkflowRelatedQueries(queryClient, (detail?.payload ?? null) as Record<string, unknown> | null),
    ]);
    router.refresh();
  };

  useEffect(() => {
    setApprovalSupport(initialApprovalSupport);
    applyLocal(initialData);
    // 初回 hydrate では一覧を invalidate しない（古い in-flight 取得で差戻し結果を上書きするのを防ぐ）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, initialApprovalSupport]);

  const reload = () => {
    if (!id) return;
    fetchWorkflowRequest(id as string)
      .then(async (detail) => {
        applyLocal(detail);
        await syncCaches(detail);
        const payload = (detail as Detail & { payload?: Record<string, unknown> }).payload;
        if (payload?.estimate_id) {
          getWorkflowApprovalSupport(id as string)
            .then(setApprovalSupport)
            .catch(() => setApprovalSupport(null));
        } else {
          setApprovalSupport(null);
        }
      })
      .catch(() => toast.error("最新状態の取得に失敗しました。画面を再読み込みしてください"));
  };

  const handleApprove = async (stepId: string) => {
    try {
      const result = await approveWorkflowStep(stepId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("承認しました");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "失敗しました");
    }
  };

  const openActionDialog = (type: ActionType, stepId: string) => {
    setActionComment(type === "conditional" && approvalSupport?.suggestedComment
      ? approvalSupport.suggestedComment
      : "");
    setActionDialog({ type, stepId });
  };

  const handleAction = async () => {
    if (!actionDialog) return;
    setActioning(true);
    try {
      if (actionDialog.type === "cancel") {
        if (!id) return;
        const result = await cancelWorkflowRequest(id as string, actionComment.trim() || undefined);
        if (!result.ok) { toast.error(result.error); return; }
        toast.success("申請を取り消しました");
        if (result.ok && "id" in result && result.id) {
          patchListRow({
            id: result.id,
            status: result.status,
            payload: result.payload,
            decided_at: new Date().toISOString(),
          });
        }
      } else if (actionDialog.type === "reject") {
        const result = await rejectWorkflowStep(actionDialog.stepId, actionComment.trim() || undefined);
        if (!result.ok) { toast.error(result.error); return; }
        toast.success("却下しました");
      } else if (actionDialog.type === "conditional") {
        const result = await approveWorkflowStepConditional(actionDialog.stepId, actionComment.trim());
        if (!result.ok) { toast.error(result.error); return; }
        toast.success("条件付きで承認しました");
      } else {
        const result = await remandWorkflowStep(actionDialog.stepId, actionComment.trim() || undefined);
        if (!result.ok) { toast.error(result.error); return; }
        toast.success("差戻しました。申請者へ通知しました");
        if (result.ok && "id" in result && result.id) {
          patchListRow({
            id: result.id,
            status: result.status,
            payload: result.payload,
            decided_at: new Date().toISOString(),
          });
        }
      }
      setActionDialog(null);
      if (id) {
        await queryClient.cancelQueries({ queryKey: QK.workflowRequests });
        await queryClient.cancelQueries({ queryKey: QK.workflowRequest(id as string) });
        try {
          const detail = await fetchWorkflowRequest(id as string);
          applyLocal(detail);
          await syncCaches(detail);
        } catch {
          toast.error("最新状態の取得に失敗しました。画面を再読み込みしてください");
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "失敗しました");
    } finally {
      setActioning(false);
    }
  };

  const handleResubmit = async () => {
    if (!id) return;
    setResubmitting(true);
    try {
      const payloadPatch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(editPayload)) {
        if (SYSTEM_PAYLOAD_KEYS.has(k)) continue;
        payloadPatch[k] = v;
      }
      const amountNum = editAmount.trim() ? Number(editAmount) : null;
      if (amountNum != null && !Number.isFinite(amountNum)) {
        toast.error("金額の形式が正しくありません");
        return;
      }
      const result = await resubmitWorkflowRequest({
        id: id as string,
        title: editTitle.trim(),
        amount: amountNum,
        due_date: editDueDate || null,
        payload: payloadPatch,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("再申請しました");
      if (result.ok && "id" in result && result.id) {
        patchListRow({
          id: result.id,
          status: result.status,
          payload: result.payload,
          decided_at: null,
        });
      }
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "再申請に失敗しました");
    } finally {
      setResubmitting(false);
    }
  };

  const handlePostComment = async () => {
    if (!commentBody.trim() || !id) return;
    setPostingComment(true);
    try {
      await addWorkflowComment(id as string, commentBody.trim());
      setCommentBody("");
      reload();
    } catch {
      toast.error("コメントの投稿に失敗しました");
    } finally {
      setPostingComment(false);
    }
  };

  if (!data) {
    return (
      <div className="p-4 md:p-8">
        <Link href="/workflow" className="text-sm text-muted-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" />戻る
        </Link>
        <p className="mt-4">見つかりません</p>
      </div>
    );
  }

  const steps = (data.steps ?? []) as Step[];
  const comments = (data.comments ?? []) as Comment[];
  const fields = (data as Detail & { payload?: Record<string, unknown> }).payload ?? {};
  const requestRemanded = isWorkflowRemanded(data.status, fields);
  const contractId = isUuid(fields.contract_id) ? String(fields.contract_id).trim() : undefined;
  const estimateId = isUuid(fields.estimate_id) ? String(fields.estimate_id).trim() : undefined;
  const typeKey = String((data as Detail & { workflow_type?: { key?: string } }).workflow_type?.key ?? "");
  const isStandaloneType = STANDALONE_WORKFLOW_KEYS.has(typeKey);
  const isLinkedFlow = Boolean(contractId || estimateId) && !isStandaloneType;
  const requesterId =
    (data as Detail & { requester_id?: string | null }).requester_id
    ?? (data as Detail & { requester?: { id?: string | null } }).requester?.id
    ?? null;
  const actorId = user?.id ?? profile?.id ?? null;
  const isRequester = Boolean(actorId && requesterId && actorId === requesterId);
  const canActAsRequester = Boolean(isRequester || hasRole("hq_admin", "admin"));
  const canReapply = Boolean(canActAsRequester && data.status === "rejected" && !isLinkedFlow);
  const canCancel = Boolean(canActAsRequester && (data.status === "submitted" || data.status === "rejected") && !isLinkedFlow);
  const fieldDefs = ((data as Detail & { workflow_type?: { fields_schema?: FieldDef[] } }).workflow_type?.fields_schema ?? []) as FieldDef[];
  const activeStepOrder = Math.min(
    ...steps.filter((s) => s.status === "pending").map((s) => s.step_order),
    Number.POSITIVE_INFINITY,
  );
  const currentStep = steps.find((s) => s.status === "pending" && s.step_order === activeStepOrder);
  const isMyCurrentStep = Boolean(currentStep && user?.id === currentStep.approver?.id);
  // 仕様 Step17: 総務ロールが自分の承認番になったときだけ追記可
  const canEditAdminSupplement = Boolean(
    contractId
    && hasRole("administration")
    && data.status === "submitted"
    && isMyCurrentStep,
  );
  const adminSupplemented = Boolean(
    fields.admin_supplemented_at
    || (
      typeof fields.payment_terms === "string"
      && fields.payment_terms.trim()
      && typeof fields.bank_account === "string"
      && fields.bank_account.trim()
    ),
  );
  const needsAdminSupplementBeforeApprove = Boolean(
    contractId
    && hasRole("administration")
    && isMyCurrentStep
    && !adminSupplemented,
  );
  const PAYLOAD_LABELS: Record<string, string> = {
    estimate_id: "見積ID",
    customer_name: "顧客名",
    gross_profit_rate: "粗利率",
    application_comment: "申請コメント",
    contract_id: "契約ID",
    template_id: "テンプレートID",
    remand: "差戻し",
    remand_comment: "差戻しコメント",
    remanded_at: "差戻し日時",
    payment_terms: "支払条件",
    bank_account: "口座情報",
    admin_notes: "総務メモ",
    admin_supplemented_at: "総務追記日時",
    admin_supplemented_by: "総務追記者",
  };
  const displayFields = Object.entries(fields).filter(([k]) => {
    if (["contract_id", "template_id", "contract_draft", "remand", "admin_supplemented_by", "resubmitted_at", "cancelled_at", "cancel_comment"].includes(k)) {
      return false;
    }
    if (!requestRemanded && ["remanded_at", "remand_comment"].includes(k)) return false;
    if (data.status !== "rejected" && ["rejected_at", "reject_comment"].includes(k)) return false;
    return true;
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Link href="/workflow" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />ワークフロー一覧
      </Link>

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{data.title}</h1>
        <StatusBadge
          status={requestRemanded ? "returned" : data.status}
          label={getWorkflowStatusLabel(data.status, fields)}
        />
        {(data as Detail & { is_urgent?: boolean }).is_urgent && (
          <Badge variant="destructive">緊急</Badge>
        )}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {canReapply && (
            <Button size="sm" onClick={() => void handleResubmit()} disabled={resubmitting} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              {resubmitting ? "再申請中..." : "再申請"}
            </Button>
          )}
          {canActAsRequester && requestRemanded && estimateId && (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/quotes/${estimateId}`}>見積で再申請</Link>
            </Button>
          )}
          {canActAsRequester && requestRemanded && contractId && (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/contracts/${contractId}?tab=documents`}>契約で再申請</Link>
            </Button>
          )}
          {canCancel && (
            <Button size="sm" variant="outline" onClick={() => openActionDialog("cancel", "")} className="gap-1.5">
              <X className="h-3.5 w-3.5" />申請を取り消す
            </Button>
          )}
        </div>
      </div>

      {(requestRemanded || (data.status === "rejected" && !requestRemanded)) && (
        <div className={requestRemanded
          ? "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          : "rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"}
        >
          <p className="font-medium">
            {requestRemanded ? "差戻しされています。内容を修正して再申請してください。" : "却下されています。内容を見直して再申請できます。"}
          </p>
          {(fields.remand_comment || fields.reject_comment) && (
            <p className="mt-1 text-xs whitespace-pre-wrap">
              {String(fields.remand_comment || fields.reject_comment)}
            </p>
          )}
          {canReapply && (
            <div className="mt-3">
              <Button
                size="sm"
                onClick={() => void handleResubmit()}
                disabled={resubmitting}
                className="gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {resubmitting ? "再申請中..." : "再申請"}
              </Button>
            </div>
          )}
          {!canReapply && isLinkedFlow && canActAsRequester && requestRemanded && (estimateId || contractId) && (
            <div className="mt-3">
              {estimateId && (
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/quotes/${estimateId}`}>見積で再申請</Link>
                </Button>
              )}
              {contractId && (
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/contracts/${contractId}?tab=documents`}>契約で再申請</Link>
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">申請情報</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">申請者</span>
              <span>{(data as Detail & { requester?: { display_name: string } }).requester?.display_name ?? "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">種別</span>
              <span>{(data as Detail & { workflow_type?: { name: string } }).workflow_type?.name ?? "-"}</span>
            </div>
            {canReapply && (
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs">件名</span>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
            )}
            {canReapply ? (
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs">金額</span>
                <Input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
              </div>
            ) : (
              (data as Detail & { amount?: number }).amount != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">金額</span>
                  <span className="font-medium tabular-nums">
                    ¥{((data as Detail & { amount: number }).amount).toLocaleString()}
                  </span>
                </div>
              )
            )}
            {canReapply ? (
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs">期限</span>
                <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
              </div>
            ) : (
              (data as Detail & { due_date?: string }).due_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">期限</span>
                  <span>{(data as Detail & { due_date: string }).due_date}</span>
                </div>
              )
            )}
            {contractId && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground shrink-0">関連契約</span>
                <Link href={`/contracts/${contractId}`} className="text-primary hover:underline text-right">
                  契約詳細を開く →
                </Link>
              </div>
            )}
            {displayFields.map(([k, v]) => {
              const def = fieldDefs.find((f) => f.key === k);
              const label = def?.label ?? PAYLOAD_LABELS[k] ?? k;
              const readOnly = !canReapply || ["remanded_at", "remand_comment", "rejected_at", "reject_comment", "resubmitted_at", "cancelled_at", "cancel_comment", "admin_supplemented_at", "gross_profit_rate"].includes(k);
              if (!readOnly) {
                return (
                  <div key={k} className="space-y-1">
                    <span className="text-muted-foreground text-xs">{label}</span>
                    {def?.type === "textarea" ? (
                      <Textarea
                        rows={2}
                        value={editPayload[k] ?? ""}
                        onChange={(e) => setEditPayload((p) => ({ ...p, [k]: e.target.value }))}
                      />
                    ) : (
                      <Input
                        type={def?.type === "number" || def?.type === "date" ? def.type : "text"}
                        value={editPayload[k] ?? ""}
                        onChange={(e) => setEditPayload((p) => ({ ...p, [k]: e.target.value }))}
                      />
                    )}
                  </div>
                );
              }
              return (
                <div key={k} className="flex justify-between gap-4">
                  <span className="text-muted-foreground shrink-0">{label}</span>
                  <span className="text-right break-all">
                    {k === "gross_profit_rate" && typeof v === "number"
                      ? `${v.toFixed(1)}%`
                      : String(v)}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">承認ステップ</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {steps.length === 0 && (
              <p className="text-sm text-muted-foreground">承認ステップなし</p>
            )}
            {steps.map((step) => {
              const isMyStep = user?.id === step.approver?.id;
              // 順次承認: いまの順番の pending のみ操作可（No.85）
              const isCurrentStep = step.status === "pending" && step.step_order === activeStepOrder;
              const canAct = isMyStep && isCurrentStep;
              const waitingEarlier = step.status === "pending" && step.step_order > activeStepOrder;
              const isSoumu = step.approver?.role === "administration";
              return (
                <div key={step.id} className="flex items-start justify-between p-3 border rounded-lg gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      Step {step.step_order}: {step.approver?.display_name ?? "-"}
                      {isSoumu && (
                        <Badge variant="outline" className="ml-2 text-xs border-teal-300 text-teal-700">総務</Badge>
                      )}
                      {isMyStep && (
                        <Badge variant="secondary" className="ml-2 text-xs">あなた</Badge>
                      )}
                      {isCurrentStep && (
                        <Badge className="ml-2 text-xs">承認待ち</Badge>
                      )}
                      {waitingEarlier && (
                        <Badge variant="outline" className="ml-2 text-xs">前ステップ待ち</Badge>
                      )}
                    </p>
                    <StatusBadge
                      status={requestRemanded && step.status === "rejected" ? "returned" : step.status}
                      label={
                        requestRemanded && step.status === "rejected"
                          ? "差戻し"
                          : step.status === "rejected"
                            ? "却下"
                            : undefined
                      }
                    />
                    {step.comment && (
                      <p className="text-xs text-muted-foreground mt-1 break-all">
                        「{step.comment}」
                      </p>
                    )}
                    {step.decided_at && (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(step.decided_at), "M/d HH:mm", { locale: ja })}
                      </p>
                    )}
                  </div>
                  {canAct && (
                    <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(step.id)}
                        className="gap-1 h-8"
                        disabled={needsAdminSupplementBeforeApprove}
                        title={needsAdminSupplementBeforeApprove ? "先に総務追記を保存してください" : undefined}
                      >
                        <Check className="h-3.5 w-3.5" />承認
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openActionDialog("conditional", step.id)}
                        className="gap-1 h-8"
                        disabled={needsAdminSupplementBeforeApprove}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />条件付き承認
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openActionDialog("remand", step.id)} className="gap-1 h-8">
                        <CornerUpLeft className="h-3.5 w-3.5" />差戻し
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openActionDialog("reject", step.id)} className="gap-1 h-8 text-destructive border-destructive/40 hover:bg-destructive/10">
                        <X className="h-3.5 w-3.5" />却下
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {canEditAdminSupplement && (
        <Card className="border-teal-200 bg-teal-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">総務追記（支払条件・口座情報）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              総務ロールのみ追記可能です。支払条件と振込口座を保存してから承認してください。
              {!adminSupplemented && (
                <span className="block mt-1 text-amber-700 font-medium">未追記のため承認ボタンは無効です</span>
              )}
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">支払条件</Label>
              <Textarea
                rows={2}
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="例: 着工時30% / 中間40% / 完工時30%"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">振込口座</Label>
              <Input
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                placeholder="銀行名・支店・口座番号"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">総務メモ</Label>
              <Textarea
                rows={2}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="社内向けメモ"
              />
            </div>
            <Button
              size="sm"
              disabled={savingAdmin}
              onClick={async () => {
                if (!id) return;
                setSavingAdmin(true);
                try {
                  const result = await saveContractAdminSupplement(id as string, {
                    payment_terms: paymentTerms,
                    bank_account: bankAccount,
                    admin_notes: adminNotes,
                  });
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("総務追記を保存しました");
                  reload();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "保存に失敗しました");
                } finally {
                  setSavingAdmin(false);
                }
              }}
            >
              {savingAdmin ? "保存中..." : "追記を保存"}
            </Button>
          </CardContent>
        </Card>
      )}

      {approvalSupport && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              承認支援（AIプロバイダーは後日選定・現状はルールベース）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{approvalSupport.analysis}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={
                approvalSupport.recommendation === "approve" ? "default"
                  : approvalSupport.recommendation === "conditional" ? "secondary"
                    : "destructive"
              }>
                推奨: {
                  approvalSupport.recommendation === "approve" ? "承認"
                    : approvalSupport.recommendation === "conditional" ? "条件付き承認"
                      : approvalSupport.recommendation === "return" ? "差戻し" : "却下"
                }
              </Badge>
              {approvalSupport.suggestedComment && (
                <span className="text-xs text-muted-foreground">提案コメント: {approvalSupport.suggestedComment}</span>
              )}
            </div>
            {approvalSupport.similarEstimates.length > 0 && (
              <div className="text-xs text-muted-foreground">
                類似見積: {approvalSupport.similarEstimates.map((e) => `${e.title}(${e.grossProfitRate.toFixed(1)}%)`).join(" / ")}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            コメント{comments.length > 0 && <span className="text-muted-foreground font-normal">（{comments.length}件）</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {comments.length === 0 && (
            <p className="text-sm text-muted-foreground">コメントはありません</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <div className="flex-1 bg-muted/40 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{c.user?.display_name ?? "-"}</span>
                  <span>{format(new Date(c.created_at), "M/d HH:mm", { locale: ja })}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap break-all">{c.body}</p>
              </div>
            </div>
          ))}

          <div className="flex gap-2 pt-1">
            <Textarea
              ref={commentRef}
              rows={2}
              placeholder="コメントを入力..."
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  void handlePostComment();
                }
              }}
              className="resize-none"
            />
            <Button
              size="icon"
              className="shrink-0 self-end"
              disabled={!commentBody.trim() || postingComment}
              onClick={handlePostComment}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">⌘+Enter で送信</p>
        </CardContent>
      </Card>

      <Dialog open={!!actionDialog} onOpenChange={(o) => !o && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.type === "reject" ? "却下する"
                : actionDialog?.type === "conditional" ? "条件付きで承認する"
                  : actionDialog?.type === "cancel" ? "申請を取り消す"
                    : "差戻しする"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              {actionDialog?.type === "reject"
                ? "この申請を却下します。理由があればコメントを入力してください。"
                : actionDialog?.type === "conditional"
                  ? "条件をコメントに記載して承認します。"
                  : actionDialog?.type === "cancel"
                    ? "この申請を取り消します。承認者へ通知され、履歴は残ります（削除はしません）。"
                    : "この申請を申請者に差戻します。修正を依頼する内容を入力してください。"}
            </p>
            <Textarea
              rows={3}
              placeholder={
                actionDialog?.type === "reject" ? "却下理由（任意）"
                  : actionDialog?.type === "conditional" ? "承認条件（必須）"
                    : actionDialog?.type === "cancel" ? "取り消し理由（任意）"
                      : "差戻し理由・修正依頼内容（任意）"
              }
              value={actionComment}
              onChange={(e) => setActionComment(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)} disabled={actioning}>
              閉じる
            </Button>
            <Button
              variant={actionDialog?.type === "reject" || actionDialog?.type === "cancel" ? "destructive" : "default"}
              onClick={handleAction}
              disabled={actioning || (actionDialog?.type === "conditional" && !actionComment.trim())}
            >
              {actioning ? "処理中..."
                : actionDialog?.type === "reject" ? "却下する"
                  : actionDialog?.type === "conditional" ? "条件付き承認する"
                    : actionDialog?.type === "cancel" ? "取り消す"
                      : "差戻しする"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
