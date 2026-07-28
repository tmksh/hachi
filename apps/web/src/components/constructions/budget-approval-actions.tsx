"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import {
  getConstructionMarginThreshold,
  submitBudgetApproval,
} from "@/lib/actions/sales-flow";
import { getProfiles } from "@/lib/actions/profiles";

type Props = {
  constructionId: string;
  /** 画面で計算した工事粗利率（暫定, %） */
  grossProfitRate: number;
};

export function BudgetApprovalActions({ constructionId, grossProfitRate }: Props) {
  // 予備費は社員にも表示（非表示による不信感を防止）
  const canSeeReserve = true;
  const [info, setInfo] = useState<Awaited<ReturnType<typeof getConstructionMarginThreshold>> | null>(null);
  const [profiles, setProfiles] = useState<{ id: string; display_name: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [approverId, setApproverId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getConstructionMarginThreshold(constructionId).then(setInfo).catch(() => {});
    getProfiles().then((p) => setProfiles(p.map((x) => ({ id: x.id, display_name: x.display_name })))).catch(() => {});
  }, [constructionId]);

  if (!info) return null;

  const threshold = info.threshold;
  const needsApproval = grossProfitRate < threshold - 1e-9;
  const approvalStatus = info.approvalStatus;
  const hasReserve = (info.reservePercent ?? 0) > 0;
  const showBreakdown = canSeeReserve && hasReserve;
  const breakdown = showBreakdown
    ? `（会社指定${info.baseThreshold.toFixed(0)}%+予備費${info.reservePercent.toFixed(0)}%）`
    : "";

  const handleSubmit = async () => {
    if (!comment.trim()) { toast.error("申請理由を入力してください"); return; }
    if (!approverId) { toast.error("承認者を選択してください"); return; }
    setSubmitting(true);
    try {
      const result = await submitBudgetApproval({
        constructionId,
        comment: comment.trim(),
        approverId,
        grossProfitRate,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("上長への承認申請を送信しました");
      setDialogOpen(false);
      setInfo((prev) => prev ? { ...prev, approvalStatus: "pending", workflowRequestId: result.workflowRequestId } : prev);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "申請に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  // 基準達成 → 問題なし表示
  if (!needsApproval) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
        <CheckCircle className="h-3.5 w-3.5" />
        粗利基準クリア（基準 {threshold.toFixed(0)}%{breakdown}）
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {approvalStatus === "pending" && info.workflowRequestId ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/workflow/${info.workflowRequestId}`}>
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            承認待ち
          </Link>
        </Button>
      ) : approvalStatus === "approved" || approvalStatus === "conditional" ? (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
          <CheckCircle className="h-3.5 w-3.5" />
          {approvalStatus === "conditional" ? "条件付き承認済み" : "承認済み"}
        </span>
      ) : (
        <Button
          variant="default"
          size="sm"
          className="bg-amber-600 hover:bg-amber-700"
          onClick={() => setDialogOpen(true)}
        >
          <AlertTriangle className="h-4 w-4 mr-1" />
          上司への承認申請
        </Button>
      )}
      <span className="text-[11px] text-muted-foreground">
        工事粗利 {grossProfitRate.toFixed(1)}% / 基準 {threshold.toFixed(0)}%
        {showBreakdown && <span className="text-amber-600 ml-0.5">{breakdown}</span>}
      </span>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>実行予算の上長承認申請</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              工事粗利率 {grossProfitRate.toFixed(1)}% は基準 {threshold.toFixed(0)}% {breakdown}を下回っています。
              申請理由を入力し、承認者を選択してください。
            </p>
            <div className="space-y-2">
              <Label>申請コメント（粗利率低下の理由）</Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                placeholder="例: 追加工事の原価増。予備費を含めても基準未達だが受注優先。"
              />
            </div>
            <div className="space-y-2">
              <Label>承認者</Label>
              <Select value={approverId} onValueChange={setApproverId}>
                <SelectTrigger>
                  <SelectValue placeholder="上長を選択" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              申請する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
