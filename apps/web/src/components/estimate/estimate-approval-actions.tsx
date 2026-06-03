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
  getEstimateMarginThreshold,
  submitEstimateApproval,
} from "@/lib/actions/sales-flow";
import { getProfiles } from "@/lib/actions/profiles";

type Props = {
  estimateId: string;
  grossProfitRate: number;
};

export function EstimateApprovalActions({ estimateId, grossProfitRate }: Props) {
  const [marginInfo, setMarginInfo] = useState<Awaited<ReturnType<typeof getEstimateMarginThreshold>>>(null);
  const [profiles, setProfiles] = useState<{ id: string; display_name: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [approverId, setApproverId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getEstimateMarginThreshold(estimateId).then(setMarginInfo).catch(() => {});
    getProfiles().then((p) => setProfiles(p.map((x) => ({ id: x.id, display_name: x.display_name })))).catch(() => {});
  }, [estimateId]);

  const threshold = marginInfo?.threshold ?? 50;
  const needsApproval = grossProfitRate < threshold;
  const approvalStatus = marginInfo?.approvalStatus ?? "none";

  if (!needsApproval) return null;

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
        ) : approvalStatus === "approved" ? (
          <Button variant="outline" size="sm" disabled className="text-emerald-700 border-emerald-200">
            <CheckCircle className="h-4 w-4 mr-1" />
            承認済み
          </Button>
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
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>見積の上長承認申請</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              粗利率 {grossProfitRate.toFixed(1)}% は基準 {threshold.toFixed(0)}% を下回っています。
              申請理由を入力し、承認者を選択してください。
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
              申請する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
