"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { DealActivity } from "@/lib/database.types";
import { getCustomerDealsWithActivities, updateDealSummary } from "@/lib/actions/crm-features";
import { toast } from "sonner";

const STAGE_LABELS: Record<string, string> = {
  inquiry: "問い合わせ", first_meeting: "初回面談", materials_sent: "資料送付",
  quote_submitted: "見積提出", negotiation: "商談中", closing: "クロージング", won: "受注", lost: "失注",
};

type DealWithActivities = Awaited<ReturnType<typeof getCustomerDealsWithActivities>>[number];

export function DealsTimelineTab({ customerId }: { customerId: string }) {
  const [deals, setDeals] = useState<DealWithActivities[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [summaryDraft, setSummaryDraft] = useState("");

  useEffect(() => {
    getCustomerDealsWithActivities(customerId)
      .then((d) => { setDeals(d); if (d[0]) { setSelectedId(d[0].id); setSummaryDraft(d[0].summary ?? ""); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [customerId]);

  const selected = deals.find((d) => d.id === selectedId);

  const saveSummary = async () => {
    if (!selectedId) return;
    try {
      await updateDealSummary(selectedId, summaryDraft);
      setDeals((prev) => prev.map((d) => d.id === selectedId ? { ...d, summary: summaryDraft } : d));
      toast.success("要約を保存しました");
    } catch {
      toast.error("保存に失敗しました");
    }
  };

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (deals.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">商談がありません。パイプラインから追加してください。</p>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      <div className="space-y-2">
        {deals.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => { setSelectedId(d.id); setSummaryDraft(d.summary ?? ""); }}
            className={cn(
              "w-full text-left rounded-lg border px-3 py-2.5 transition-colors",
              selectedId === d.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
            )}
          >
            <p className="font-medium text-sm truncate">{d.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-[10px] h-5">{STAGE_LABELS[d.stage] ?? d.stage}</Badge>
              {d.value != null && <span className="text-xs tabular-nums">¥{d.value.toLocaleString()}</span>}
            </div>
          </button>
        ))}
      </div>
      {selected && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <h3 className="font-semibold">{selected.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">更新 {format(new Date(selected.updated_at), "yyyy/MM/dd HH:mm", { locale: ja })}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">商談要約</p>
              <Textarea value={summaryDraft} onChange={(e) => setSummaryDraft(e.target.value)} rows={4} placeholder="商談の要約を入力..." />
              <button type="button" onClick={saveSummary} className="text-xs text-primary mt-2 hover:underline">要約を保存</button>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">タイムライン</p>
              <div className="space-y-3">
                {(selected.activities ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">アクティビティなし</p>
                ) : selected.activities.map((a: DealActivity) => (
                  <div key={a.id} className="border-l-2 border-primary/30 pl-3">
                    <p className="text-sm font-medium">{a.title}</p>
                    {a.description && <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>}
                    <p className="text-[11px] text-muted-foreground mt-1">{format(new Date(a.performed_at), "yyyy/MM/dd HH:mm", { locale: ja })}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
