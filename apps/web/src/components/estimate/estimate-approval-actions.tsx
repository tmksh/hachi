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
import { AlertTriangle, CheckCircle, CornerUpLeft, FileCheck, Loader2 } from "lucide-react";
import {
  getEstimateMarginThreshold,
  submitEstimateApproval,
  confirmEstimateIssued,
} from "@/lib/actions/sales-flow";
import { getProfiles } from "@/lib/actions/profiles";
import { toMarginThresholdPercent } from "@/lib/estimate-margin";
import { humanizeClientError } from "@/lib/humanize-error";

type Props = {
  estimateId: string;
  /** ライブ粗利率（%）。明細編集に追従させる */
  grossProfitRate: number;
  defaultGrossProfitRate?: number | null;
  estimateStatus?: string | null;
  /** 経営調整費（サマリー）。未計上だと申請不可 */
  reserveFee1Amount?: number | null;
  /** 予備費（サマリー）。未計上だと申請不可 */
  reserveFee2Amount?: number | null;
  onConfirmed?: () => void;
  /** 承認ステータスが変わったとき（親の差戻しバナー更新用） */
  onStatusChange?: () => void;
};

export function EstimateApprovalActions({
  estimateId,
  grossProfitRate,
  defaultGrossProfitRate,
  estimateStatus,
  reserveFee1Amount,
  reserveFee2Amount,
  onConfirmed,
  onStatusChange,
}: Props) {
  const [marginInfo, setMarginInfo] = useState<Awaited<ReturnType<typeof getEstimateMarginThreshold>>>(null);
  const [profiles, setProfiles] = useState<{ id: string; display_name: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [approverId, setApproverId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const loadMargin = () => {
      getEstimateMarginThreshold(estimateId).then(setMarginInfo).catch(() => {});
    };
    loadMargin();
    getProfiles()
      .then((p) =>
        setProfiles(
          p
            .filter((x) => Boolean(x.id))
            .map((x) => ({ id: x.id, display_name: x.display_name || x.email || "（名前未設定）" })),
        ),
      )
      .catch(() => {});

    const onVisible = () => {
      if (document.visibilityState === "visible") loadMargin();
    };
    window.addEventListener("focus", loadMargin);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", loadMargin);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [estimateId]);

  const threshold = marginInfo?.threshold
    ?? toMarginThresholdPercent(defaultGrossProfitRate);
  const needsApproval = grossProfitRate < threshold - 1e-9;
  const approvalStatus = marginInfo?.approvalStatus ?? "none";
  const canReapply = approvalStatus === "returned" || approvalStatus === "rejected";
  const isReturned = approvalStatus === "returned";
  const isIssued = estimateStatus === "issued"
    || estimateStatus === "sent"
    || estimateStatus === "accepted"
    || approvalStatus === "approved";

  const reserveOk =
    Number(reserveFee1Amount ?? 0) > 0 && Number(reserveFee2Amount ?? 0) > 0;

  const openDialog = () => {
    if (!reserveOk) {
      toast.error("経営調整費・予備費をサマリー欄に計上してから申請してください");
      return;
    }
    if (profiles.length === 0) {
      toast.error("承認者一覧を取得できませんでした。画面を再読み込みしてください");
      return;
    }
    setDialogOpen(true);
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const result = await confirmEstimateIssued(estimateId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("見積を確定（発行済み）にしました");
      setMarginInfo((prev) => prev ? { ...prev, approvalStatus: "approved", status: "issued" } : prev);
      onConfirmed?.();
      onStatusChange?.();
    } catch (e) {
      toast.error(humanizeClientError(e, "確定に失敗しました。経営調整費・予備費の計上と粗利率を確認してください"));
    } finally {
      setConfirming(false);
    }
  };

  const handleSubmit = async () => {
    if (!reserveOk) {
      toast.error("経営調整費・予備費をサマリー欄に計上してから申請してください");
      return;
    }
    if (!comment.trim()) { toast.error("申請コメントを入力してください"); return; }
    if (!approverId) { toast.error("承認者を選択してください"); return; }
    setSubmitting(true);
    try {
      const result = await submitEstimateApproval({
        estimateId,
        comment: comment.trim(),
        approverId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(canReapply ? "再申請を送信しました" : "上長への承認申請を送信しました");
      setDialogOpen(false);
      setComment("");
      setMarginInfo((prev) => prev ? { ...prev, approvalStatus: "pending", workflowRequestId: result.workflowRequestId, remandComment: null } : prev);
      onStatusChange?.();
    } catch (e) {
      toast.error(humanizeClientError(e, "申請に失敗しました。経営調整費・予備費の計上と承認者選択を確認して再度お試しください"));
    } finally {
      setSubmitting(false);
    }
  };

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
          onClick={openDialog}
        >
          {isReturned
            ? <CornerUpLeft className="h-4 w-4 mr-1" />
            : <AlertTriangle className="h-4 w-4 mr-1" />}
          {canReapply ? "承認申請（再申請）" : "上司への承認申請"}
        </Button>
      )}

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
            {!reserveOk && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                経営調整費・予備費が未計上です。サマリー欄で計上してから申請してください。
              </div>
            )}
            {marginInfo?.remandComment && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <p className="text-xs font-medium text-amber-700 mb-0.5">差戻し指摘</p>
                {marginInfo.remandComment}
              </div>
            )}
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
              <Select value={approverId || undefined} onValueChange={setApproverId}>
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
            <Button onClick={() => void handleSubmit()} disabled={submitting || !reserveOk}>
              {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {canReapply ? "再申請する" : "申請する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
