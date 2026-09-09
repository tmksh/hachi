"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, X } from "lucide-react";
import { reviewStageProposal } from "@/lib/actions/sales-flow";
import { fetchPendingStageProposals, type StageProposal } from "@/lib/queries/deals";

const STAGE_LABELS: Record<string, string> = {
  inquiry: "問い合わせ",
  first_meeting: "初回商談",
  materials_sent: "資料送付",
  quote_submitted: "見積提出",
  negotiation: "交渉中",
  closing: "クロージング",
  won: "受注",
  lost: "失注",
};

export function StageProposalBanner({ customerId }: { customerId?: string }) {
  const [proposals, setProposals] = useState<StageProposal[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  const load = () => {
    fetchPendingStageProposals()
      .then((all) => setProposals(customerId ? all.filter((p) => p.customer_id === customerId) : all))
      .catch(() => {});
  };

  useEffect(() => { load(); }, [customerId]);

  const handleReview = async (id: string, action: "approve" | "reject") => {
    setLoading(id);
    try {
      await reviewStageProposal(id, action);
      toast.success(action === "approve" ? "ステージを更新しました" : "提案を却下しました");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作に失敗しました");
    } finally {
      setLoading(null);
    }
  };

  if (proposals.length === 0) return null;

  return (
    <div className="space-y-2">
      {proposals.map((p) => (
        <div
          key={p.id}
          className="rounded-lg border border-violet-200 bg-violet-50/80 dark:border-violet-900/40 dark:bg-violet-950/20 px-4 py-3"
        >
          <div className="flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-violet-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-violet-950 dark:text-violet-100">
                ステージ変更提案（Linq）
              </p>
              <p className="text-xs text-violet-800/80 dark:text-violet-200/80 mt-0.5">
                {(p.deal as { title?: string })?.title ?? "商談"}:
                {" "}{STAGE_LABELS[p.current_stage] ?? p.current_stage}
                {" → "}
                <strong>{STAGE_LABELS[p.proposed_stage] ?? p.proposed_stage}</strong>
              </p>
              {p.reason && (
                <p className="text-xs text-muted-foreground mt-1">{p.reason}</p>
              )}
            </div>
            <div className="flex gap-1.5 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={loading === p.id}
                onClick={() => handleReview(p.id, "reject")}
              >
                <X className="h-3 w-3 mr-0.5" />却下
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs bg-violet-600 hover:bg-violet-700"
                disabled={loading === p.id}
                onClick={() => handleReview(p.id, "approve")}
              >
                <Check className="h-3 w-3 mr-0.5" />承認
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
