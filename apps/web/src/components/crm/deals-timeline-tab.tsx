"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { DealActivity } from "@/lib/database.types";
import {
  getCustomerDealsWithActivities, updateDealSummary, createCustomerTodo,
  assessDealConfidence, applyAssessedPriority,
  type DealConfidenceAssessment,
} from "@/lib/actions/crm-features";
import { Briefcase, Clock, Inbox, Plus, Save, ListTodo, Copy, Sparkles, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const STAGE_LABELS: Record<string, string> = {
  inquiry: "問い合わせ", first_meeting: "初回面談", materials_sent: "資料送付",
  quote_submitted: "見積提出", negotiation: "商談中", closing: "クロージング", won: "受注", lost: "失注",
  lead: "リード", proposal: "提案中",
};

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  call: "電話", meeting: "面談", email: "メール", note: "メモ", visit: "訪問", stage_change: "ステージ変更",
};

const PRIORITY_LABELS: Record<string, string> = { high: "高", medium: "中", low: "低" };

const VERDICT_META: Record<DealConfidenceAssessment["verdict"], { label: string; className: string }> = {
  appropriate: { label: "妥当", className: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  too_optimistic: { label: "甘い見込みの可能性", className: "text-amber-700 bg-amber-50 border-amber-300" },
  too_pessimistic: { label: "慎重すぎる可能性", className: "text-sky-700 bg-sky-50 border-sky-200" },
};

type DealWithActivities = Awaited<ReturnType<typeof getCustomerDealsWithActivities>>[number];
type ActivityRow = DealActivity & { performer?: { display_name: string } | null };

function getAssigneeName(deal: DealWithActivities | undefined) {
  if (!deal?.assignee || typeof deal.assignee !== "object" || !("display_name" in deal.assignee)) return null;
  return (deal.assignee as { display_name: string }).display_name;
}

function EmptyTimeline() {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-lg border border-dashed border-border/60 bg-muted/10">
      <div className="size-10 rounded-full bg-muted/60 flex items-center justify-center mb-3">
        <Clock className="size-4 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">アクティビティなし</p>
      <p className="text-xs text-muted-foreground mt-1">商談の活動記録がここに表示されます</p>
    </div>
  );
}

export function DealsTimelineTab({ customerId }: { customerId: string }) {
  const [deals, setDeals] = useState<DealWithActivities[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [selection, setSelection] = useState("");
  const [saving, setSaving] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [assessment, setAssessment] = useState<DealConfidenceAssessment | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    getCustomerDealsWithActivities(customerId)
      .then((d) => {
        setDeals(d);
        if (d[0]) {
          setSelectedId(d[0].id);
          setSummaryDraft(d[0].summary ?? "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [customerId]);

  const selected = deals.find((d) => d.id === selectedId);
  const assigneeName = getAssigneeName(selected);

  const selectDeal = (deal: DealWithActivities) => {
    setSelectedId(deal.id);
    setSummaryDraft(deal.summary ?? "");
    setAssessment(null);
  };

  const runAssessment = async () => {
    if (!selectedId) return;
    setAssessing(true);
    setAssessment(null);
    try {
      const result = await assessDealConfidence(selectedId);
      if (result.ok) {
        setAssessment(result.assessment);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("確度判定に失敗しました");
    } finally {
      setAssessing(false);
    }
  };

  const applySuggestion = async () => {
    if (!selectedId || !assessment) return;
    setApplying(true);
    try {
      await applyAssessedPriority(selectedId, assessment.suggestedPriority, assessment.reasons.join(" / "));
      setDeals((prev) => prev.map((d) => d.id === selectedId ? { ...d, priority: assessment.suggestedPriority } : d));
      setAssessment({ ...assessment, currentPriority: assessment.suggestedPriority, verdict: "appropriate" });
      toast.success(`確度を「${PRIORITY_LABELS[assessment.suggestedPriority]}」に修正しました`);
    } catch {
      toast.error("確度の修正に失敗しました");
    } finally {
      setApplying(false);
    }
  };

  const saveSummary = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await updateDealSummary(selectedId, summaryDraft);
      setDeals((prev) => prev.map((d) => d.id === selectedId ? { ...d, summary: summaryDraft } : d));
      toast.success("要約を保存しました");
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const addTodoFromSelection = async () => {
    const text = selection.trim();
    if (!text) {
      toast.error("テキストを選択してからToDoに追加してください");
      return;
    }
    if (!selectedId) return;
    try {
      await createCustomerTodo({
        customer_id: customerId,
        deal_id: selectedId,
        title: text.slice(0, 80),
        description: text,
        source: "deal_timeline",
      });
      toast.success("ToDoに追加しました");
      setSelection("");
    } catch {
      toast.error("ToDo追加に失敗しました");
    }
  };

  if (loading) return <Skeleton className="h-64 w-full rounded-lg" />;

  if (deals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 px-4 text-center rounded-lg border border-dashed">
        <div className="size-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
          <Inbox className="size-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">商談がありません</p>
        <p className="text-xs text-muted-foreground mt-1 mb-4">パイプラインから商談を追加してください</p>
        <Link href="/crm?view=pipeline">
          <Button size="sm" variant="outline" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            パイプラインを開く
          </Button>
        </Link>
      </div>
    );
  }

  if (!selected) return null;

  return (
    <Card variant="inset" className="py-0 overflow-hidden">
      {deals.length > 1 && (
        <div className="px-4 pt-4 pb-3 border-b border-border/40">
          <p className="text-xs text-muted-foreground mb-2">商談（{deals.length}件）</p>
          <div className="flex flex-wrap gap-2">
            {deals.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => selectDeal(d)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left transition-colors min-w-0 max-w-full",
                  selectedId === d.id
                    ? "border-[#0F5132] bg-[#D8EDE4]/60"
                    : "border-border/60 hover:bg-white/45 dark:hover:bg-white/5",
                )}
              >
                <p className="font-medium text-sm truncate">{d.title}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px] h-5">
                    {STAGE_LABELS[d.stage ?? ""] ?? d.stage}
                  </Badge>
                  {d.value != null && (
                    <span className="text-[11px] font-semibold tabular-nums">¥{d.value.toLocaleString()}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <CardHeader className="pb-3 pt-4 px-4 border-b border-border/40">
        <div className="flex flex-wrap items-start gap-2 min-w-0">
          <Briefcase className="h-4 w-4 text-[#0F5132] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                {STAGE_LABELS[selected.stage ?? ""] ?? selected.stage}
              </Badge>
              <Badge variant="secondary" className="text-[10px] h-5 shrink-0">
                確度 {PRIORITY_LABELS[selected.priority ?? ""] ?? selected.priority}
              </Badge>
              {selected.value != null && (
                <span className="text-sm font-semibold tabular-nums">¥{selected.value.toLocaleString()}</span>
              )}
            </div>
            <CardTitle className="text-base truncate">{selected.title}</CardTitle>
            <div className="flex flex-wrap gap-1.5">
              {(selected.tags ?? []).map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-[10px] h-5 font-normal">{tag}</Badge>
              ))}
            </div>
            {selected.next_action && (
              <p className="text-xs text-muted-foreground">
                次アクション: <span className="text-foreground">{selected.next_action}</span>
              </p>
            )}
            {selected.expected_close_date && (
              <p className="text-xs text-muted-foreground">
                見込みクローズ: {format(new Date(selected.expected_close_date), "yyyy/MM/dd", { locale: ja })}
              </p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>更新 {format(new Date(selected.updated_at), "yyyy/MM/dd HH:mm", { locale: ja })}</span>
              {assigneeName && <span>担当 {assigneeName}</span>}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 py-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="deal-summary" className="text-sm font-semibold">商談要約</Label>
          <div className="relative">
            <Textarea
              id="deal-summary"
              value={summaryDraft}
              onChange={(e) => setSummaryDraft(e.target.value)}
              onSelect={(e) => setSelection((e.target as HTMLTextAreaElement).value.substring(
                (e.target as HTMLTextAreaElement).selectionStart,
                (e.target as HTMLTextAreaElement).selectionEnd,
              ))}
              rows={4}
              placeholder="商談の要点・次のアクションなどを記録..."
            />
            {(selection.trim()) && (
              <div className="absolute bottom-2 right-2 flex gap-1 rounded-lg border bg-background shadow-sm p-1">
                <Button size="icon" variant="ghost" className="size-7" title="ToDoに追加" onClick={() => void addTodoFromSelection()}>
                  <ListTodo className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="size-7" title="コピー" onClick={() => { navigator.clipboard.writeText(selection); toast.success("コピーしました"); }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={saveSummary} disabled={saving} className="gap-1.5">
              <Save className="h-3.5 w-3.5" />
              {saving ? "保存中..." : "要約を保存"}
            </Button>
          </div>
        </div>

        <div className="pt-2 border-t border-border/40 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#0F5132]" />
                AI確度判定
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                ステージ・経過日数・活動履歴から入力確度の妥当性をAIが判定します
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => void runAssessment()} disabled={assessing} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              {assessing ? "判定中..." : "AIで確度を判定"}
            </Button>
          </div>

          {assessment && (
            <div className={cn("rounded-lg border p-3 space-y-2.5", VERDICT_META[assessment.verdict].className)}>
              <div className="flex flex-wrap items-center gap-2">
                {assessment.verdict === "appropriate"
                  ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                  : assessment.verdict === "too_optimistic"
                    ? <AlertTriangle className="h-4 w-4 shrink-0" />
                    : <TrendingUp className="h-4 w-4 shrink-0" />}
                <span className="text-sm font-semibold">{VERDICT_META[assessment.verdict].label}</span>
                <span className="text-xs">
                  入力確度「{PRIORITY_LABELS[assessment.currentPriority] ?? assessment.currentPriority}」
                  {assessment.suggestedPriority !== assessment.currentPriority &&
                    ` → AI提案「${PRIORITY_LABELS[assessment.suggestedPriority]}」`}
                </span>
                <span className="text-[11px] ml-auto">判定確信度 {assessment.confidence}%</span>
              </div>
              {assessment.reasons.length > 0 && (
                <ul className="text-xs space-y-1">
                  {assessment.reasons.map((r, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="shrink-0">・</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              )}
              {assessment.advice && (
                <p className="text-xs border-t border-current/15 pt-2">
                  <span className="font-semibold">提案: </span>{assessment.advice}
                </p>
              )}
              {assessment.suggestedPriority !== assessment.currentPriority && (
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => void applySuggestion()} disabled={applying} className="gap-1.5 h-7 text-xs">
                    {applying ? "反映中..." : `確度を「${PRIORITY_LABELS[assessment.suggestedPriority]}」に修正`}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-border/40 space-y-3">
          <h4 className="text-sm font-semibold">タイムライン</h4>
          {(selected.activities ?? []).length === 0 ? (
            <EmptyTimeline />
          ) : (
            <div className="space-y-0">
              {(selected.activities as ActivityRow[]).map((a, i) => {
                const isLast = i === selected.activities.length - 1;
                return (
                  <div key={a.id} className="flex gap-3">
                    <div className="flex flex-col items-center shrink-0 pt-1">
                      <span className="size-2.5 rounded-full bg-[#0F5132] ring-4 ring-[#D8EDE4]/80" />
                      {!isLast && <span className="w-px flex-1 bg-border/60 mt-1 min-h-[1.5rem]" />}
                    </div>
                    <div className={cn("flex-1 min-w-0 pb-4", isLast && "pb-0")}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{a.title}</p>
                        {a.type && (
                          <Badge variant="secondary" className="text-[10px] h-5 font-normal">
                            {ACTIVITY_TYPE_LABELS[a.type] ?? a.type}
                          </Badge>
                        )}
                      </div>
                      {a.description && (
                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{a.description}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        {format(new Date(a.performed_at), "yyyy/MM/dd HH:mm", { locale: ja })}
                        {a.performer?.display_name && ` · ${a.performer.display_name}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
