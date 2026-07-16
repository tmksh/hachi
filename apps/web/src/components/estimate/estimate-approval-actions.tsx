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
import { AlertTriangle, CheckCircle, FileCheck, Loader2 } from "lucide-react";
import {
  getEstimateMarginThreshold,
  submitEstimateApproval,
  confirmEstimateIssued,
} from "@/lib/actions/sales-flow";
import { getProfiles } from "@/lib/actions/profiles";
import { updateEstimate } from "@/lib/actions/estimates";
import { toMarginThresholdPercent } from "@/lib/estimate-margin";
import { useAuth } from "@/components/providers/auth-provider";
import { useCompanyPermissions } from "@/hooks/use-company-permissions";

type Props = {
  estimateId: string;
  /** ライブ粗利率（%）。明細編集に追従させる */
  grossProfitRate: number;
  defaultGrossProfitRate?: number | null;
  estimateStatus?: string | null;
  onConfirmed?: () => void;
};

export function EstimateApprovalActions({
  estimateId,
  grossProfitRate,
  defaultGrossProfitRate,
  estimateStatus,
  onConfirmed,
}: Props) {
  const { role } = useAuth();
  const { canAccess } = useCompanyPermissions();
  // 予備費の内訳は「予備費設定」権限を持つ人だけに見せる（隠しバッファを社員に開示しない）
  const canSeeReserve = role ? canAccess("reserve_fee", [role]) : false;
  const [marginInfo, setMarginInfo] = useState<Awaited<ReturnType<typeof getEstimateMarginThreshold>>>(null);
  const [profiles, setProfiles] = useState<{ id: string; display_name: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [approverId, setApproverId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    getEstimateMarginThreshold(estimateId).then(setMarginInfo).catch(() => {});
    getProfiles().then((p) => setProfiles(p.map((x) => ({ id: x.id, display_name: x.display_name })))).catch(() => {});
  }, [estimateId]);

  const threshold = marginInfo?.threshold
    ?? toMarginThresholdPercent(defaultGrossProfitRate);
  // 基準以上（>=）なら確定可能（No.38）
  const needsApproval = grossProfitRate < threshold - 1e-9;
  const approvalStatus = marginInfo?.approvalStatus ?? "none";
  const canReapply = approvalStatus === "returned" || approvalStatus === "rejected";
  const isIssued = estimateStatus === "issued"
    || estimateStatus === "sent"
    || estimateStatus === "accepted"
    || approvalStatus === "approved";

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await confirmEstimateIssued(estimateId);
      toast.success("見積を確定（発行済み）にしました");
      setMarginInfo((prev) => prev ? { ...prev, approvalStatus: "approved", status: "issued" } : prev);
      onConfirmed?.();
    } catch (e) {
      try {
        await updateEstimate(estimateId, { status: "issued" });
        toast.success("見積を確定（発行済み）にしました");
        onConfirmed?.();
      } catch {
        toast.error(e instanceof Error ? e.message : "確定に失敗しました");
      }
    } finally {
      setConfirming(false);
    }
  };

  const handleSubmit = async () => {
    if (!comment.trim()) { toast.error("申請コメントを入力してください"); return; }
    if (!approverId) { toast.error("承認者を選択してください"); return; }
    setSubmitting(true);
    try {
      const { workflowRequestId } = await submitEstimateApproval({
        estimateId,
        comment: comment.trim(),
        approverId,
      });
      toast.success("上長への承認申請を送信しました");
      setDialogOpen(false);
      setMarginInfo((prev) => prev ? { ...prev, approvalStatus: "pending", workflowRequestId } : prev);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "申請に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  // 粗利率が基準以上 → 確定ボタン（No.38）
  if (!needsApproval) {
    if (isIssued) {
      return (
        <Button variant="outline" size="sm" disabled className="text-emerald-700 border-emerald-200">
          <CheckCircle className="h-4 w-4 mr-1" />
          確定済み
        </Button>
      );
    }
    return (
      <Button
        variant="default"
        size="sm"
        className="bg-emerald-600 hover:bg-emerald-700"
        onClick={() => void handleConfirm()}
        disabled={confirming}
      >
        {confirming ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileCheck className="h-4 w-4 mr-1" />}
        確定する
      </Button>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {approvalStatus === "pending" && marginInfo?.workflowRequestId ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/workflow/${marginInfo.workflowRequestId}`}>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              承認待ち
            </Link>
          </Button>
        ) : approvalStatus === "approved" || approvalStatus === "conditional" ? (
          <Button variant="outline" size="sm" disabled className="text-emerald-700 border-emerald-200">
            <CheckCircle className="h-4 w-4 mr-1" />
            {approvalStatus === "conditional" ? "条件付き承認済み" : "承認済み"}
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            className="bg-amber-600 hover:bg-amber-700"
            onClick={() => setDialogOpen(true)}
          >
            <AlertTriangle className="h-4 w-4 mr-1" />
            {canReapply ? "再申請する" : "上司への承認申請"}
          </Button>
        )}
        <span className="text-[10px] text-muted-foreground">
          粗利 {grossProfitRate.toFixed(1)}% / 基準 {threshold.toFixed(0)}%
          {canSeeReserve && marginInfo && (marginInfo.reservePercent ?? 0) > 0 && (
            <span className="text-amber-600">
              （会社指定{marginInfo.baseThreshold?.toFixed(0)}%+予備費{marginInfo.reservePercent?.toFixed(0)}%）
            </span>
          )}
        </span>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{canReapply ? "見積の再承認申請" : "見積の上長承認申請"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              粗利率 {grossProfitRate.toFixed(1)}% は基準 {threshold.toFixed(0)}% を下回っています。
              {canReapply ? "修正内容を踏まえ、申請理由を入力して再申請してください。" : "申請理由を入力し、承認者を選択してください。"}
            </p>
            <div className="space-y-2">
              <Label>申請コメント（粗利率低下の理由）</Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                placeholder="例: 競合対抗のため値引き。追加保証付き。"
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
              {canReapply ? "再申請する" : "申請する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
