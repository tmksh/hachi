"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/status-badge";
import { ArrowLeft, Check, X, CornerUpLeft, MessageSquare, Send } from "lucide-react";
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
  getWorkflowRequest,
  approveWorkflowStep,
  rejectWorkflowStep,
  remandWorkflowStep,
  addWorkflowComment,
} from "@/lib/actions/workflow";
import { useAuth } from "@/hooks/use-auth";

type Detail = Awaited<ReturnType<typeof getWorkflowRequest>>;
type Step = {
  id: string;
  step_order: number;
  approver: { id: string; display_name: string } | null;
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

type ActionType = "reject" | "remand";

export default function WorkflowDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  // 却下 / 差戻しダイアログ
  const [actionDialog, setActionDialog] = useState<{ type: ActionType; stepId: string } | null>(null);
  const [actionComment, setActionComment] = useState("");
  const [actioning, setActioning] = useState(false);

  // コメント投稿
  const [commentBody, setCommentBody] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  const load = () => {
    if (id) {
      getWorkflowRequest(id as string)
        .then(setData)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  };
  useEffect(load, [id]);

  const handleApprove = async (stepId: string) => {
    try {
      await approveWorkflowStep(stepId);
      toast.success("承認しました");
      load();
    } catch {
      toast.error("失敗しました");
    }
  };

  const openActionDialog = (type: ActionType, stepId: string) => {
    setActionComment("");
    setActionDialog({ type, stepId });
  };

  const handleAction = async () => {
    if (!actionDialog) return;
    setActioning(true);
    try {
      if (actionDialog.type === "reject") {
        await rejectWorkflowStep(actionDialog.stepId, actionComment.trim() || undefined);
        toast.success("却下しました");
      } else {
        await remandWorkflowStep(actionDialog.stepId, actionComment.trim() || undefined);
        toast.success("差戻しました");
      }
      setActionDialog(null);
      load();
    } catch {
      toast.error("失敗しました");
    } finally {
      setActioning(false);
    }
  };

  const handlePostComment = async () => {
    if (!commentBody.trim() || !id) return;
    setPostingComment(true);
    try {
      await addWorkflowComment(id as string, commentBody.trim());
      setCommentBody("");
      load();
    } catch {
      toast.error("コメントの投稿に失敗しました");
    } finally {
      setPostingComment(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-4 md:p-6">
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

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Link href="/workflow" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />ワークフロー一覧
      </Link>

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">{data.title}</h1>
        <StatusBadge status={data.status} />
        {(data as Detail & { is_urgent?: boolean }).is_urgent && (
          <Badge variant="destructive">緊急</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 申請情報 */}
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
            {(data as Detail & { amount?: number }).amount && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">金額</span>
                <span className="font-medium tabular-nums">
                  ¥{((data as Detail & { amount: number }).amount).toLocaleString()}
                </span>
              </div>
            )}
            {(data as Detail & { due_date?: string }).due_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">期限</span>
                <span>{(data as Detail & { due_date: string }).due_date}</span>
              </div>
            )}
            {/* 動的フィールド */}
            {Object.entries(fields).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <span className="text-muted-foreground shrink-0">{k}</span>
                <span className="text-right break-all">{String(v)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 承認ステップ */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">承認ステップ</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {steps.length === 0 && (
              <p className="text-sm text-muted-foreground">承認ステップなし</p>
            )}
            {steps.map((step) => {
              const isMyStep = user?.id === step.approver?.id;
              const canAct = isMyStep && step.status === "pending";
              return (
                <div key={step.id} className="flex items-start justify-between p-3 border rounded-lg gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      Step {step.step_order}: {step.approver?.display_name ?? "-"}
                      {isMyStep && (
                        <Badge variant="secondary" className="ml-2 text-xs">あなた</Badge>
                      )}
                    </p>
                    <StatusBadge status={step.status} />
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
                    <div className="flex gap-1.5 shrink-0">
                      <Button size="sm" onClick={() => handleApprove(step.id)} className="gap-1 h-8">
                        <Check className="h-3.5 w-3.5" />承認
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

      {/* コメント */}
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

          {/* コメント投稿 */}
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

      {/* 却下 / 差戻しダイアログ */}
      <Dialog open={!!actionDialog} onOpenChange={(o) => !o && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.type === "reject" ? "却下する" : "差戻しする"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              {actionDialog?.type === "reject"
                ? "この申請を却下します。理由があればコメントを入力してください。"
                : "この申請を申請者に差戻します。修正を依頼する内容を入力してください。"}
            </p>
            <Textarea
              rows={3}
              placeholder={actionDialog?.type === "reject" ? "却下理由（任意）" : "差戻し理由・修正依頼内容（任意）"}
              value={actionComment}
              onChange={(e) => setActionComment(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)} disabled={actioning}>
              キャンセル
            </Button>
            <Button
              variant={actionDialog?.type === "reject" ? "destructive" : "default"}
              onClick={handleAction}
              disabled={actioning}
            >
              {actioning ? "処理中..." : actionDialog?.type === "reject" ? "却下する" : "差戻しする"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
