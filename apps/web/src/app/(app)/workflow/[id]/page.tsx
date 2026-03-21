"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { ArrowLeft, Check, X } from "lucide-react";
import { toast } from "sonner";
import { getWorkflowRequest, approveWorkflowStep, rejectWorkflowStep } from "@/lib/actions/workflow";

type Detail = Awaited<ReturnType<typeof getWorkflowRequest>>;

export default function WorkflowDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => { if (id) getWorkflowRequest(id as string).then(setData).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(load, [id]);

  const handleApprove = async (stepId: string) => { try { await approveWorkflowStep(stepId); toast.success("承認しました"); load(); } catch { toast.error("失敗"); } };
  const handleReject = async (stepId: string) => { try { await rejectWorkflowStep(stepId); toast.success("却下しました"); load(); } catch { toast.error("失敗"); } };

  if (loading) return <div className="p-4 md:p-6 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64" /></div>;
  if (!data) return <div className="p-4 md:p-6"><Link href="/workflow" className="text-sm text-muted-foreground flex items-center gap-1"><ArrowLeft className="h-4 w-4" />戻る</Link><p className="mt-4">見つかりません</p></div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Link href="/workflow" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />ワークフロー一覧</Link>
      <div className="flex items-center gap-3"><h1 className="text-xl font-semibold">{data.title}</h1><StatusBadge status={data.status} />{data.is_urgent && <Badge variant="destructive">緊急</Badge>}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">申請情報</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">申請者</span><span>{data.requester?.display_name ?? "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">種別</span><span>{data.workflow_type?.name ?? "-"}</span></div>
            {data.amount && <div className="flex justify-between"><span className="text-muted-foreground">金額</span><span className="font-medium tabular-nums">¥{data.amount.toLocaleString()}</span></div>}
            {data.due_date && <div className="flex justify-between"><span className="text-muted-foreground">期限</span><span>{data.due_date}</span></div>}
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">承認ステップ</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(data.steps ?? []).map((step: { id: string; step_order: number; approver: { display_name: string } | null; status: string; comment: string | null }) => (
              <div key={step.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div><p className="text-sm font-medium">Step {step.step_order}: {step.approver?.display_name ?? "-"}</p><StatusBadge status={step.status} />{step.comment && <p className="text-xs text-muted-foreground mt-1">{step.comment}</p>}</div>
                {step.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleApprove(step.id)} className="gap-1"><Check className="h-4 w-4" />承認</Button>
                    <Button size="sm" variant="outline" onClick={() => handleReject(step.id)} className="gap-1"><X className="h-4 w-4" />却下</Button>
                  </div>
                )}
              </div>
            ))}
            {(data.steps ?? []).length === 0 && <p className="text-sm text-muted-foreground">承認ステップなし</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
