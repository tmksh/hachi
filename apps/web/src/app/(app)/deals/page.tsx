"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Users, DollarSign, BarChart3, Plus, FileText } from "lucide-react";
import { getDeals, updateDeal } from "@/lib/actions/deals";
import { AddDealDialog } from "@/components/deals/add-deal-dialog";
import { WonDialog } from "@/components/deals/won-dialog";
import type { Deal } from "@/lib/database.types";

type DealRow = Deal & {
  customer: { id: string; name: string; company_name: string | null } | null;
  assignee: { id: string; display_name: string } | null;
};

const STAGES: { key: Deal["stage"]; label: string; color: string }[] = [
  { key: "inquiry",         label: "問い合わせ",   color: "bg-gray-100 dark:bg-gray-800" },
  { key: "first_meeting",   label: "初回面談",     color: "bg-blue-50 dark:bg-blue-950/30" },
  { key: "materials_sent",  label: "資料送付",     color: "bg-cyan-50 dark:bg-cyan-950/30" },
  { key: "quote_submitted", label: "見積提出",     color: "bg-indigo-50 dark:bg-indigo-950/30" },
  { key: "negotiation",     label: "交渉中",       color: "bg-yellow-50 dark:bg-yellow-950/30" },
  { key: "closing",         label: "クロージング", color: "bg-orange-50 dark:bg-orange-950/30" },
  { key: "won",             label: "受注",         color: "bg-green-50 dark:bg-green-950/30" },
  { key: "lost",            label: "失注",         color: "bg-red-50 dark:bg-red-950/30" },
];

/** 見積ボタンを表示するステージ */
const QUOTE_STAGES: Deal["stage"][] = ["quote_submitted", "negotiation", "closing", "won"];

export default function DealsPage() {
  const router = useRouter();
  const [deals, setDeals]               = useState<DealRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [draggedDeal, setDraggedDeal]   = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [addOpen, setAddOpen]           = useState(false);
  const [wonDeal, setWonDeal]           = useState<DealRow | null>(null);

  const fetchDeals = useCallback(async () => {
    try { const d = await getDeals(); setDeals(d as DealRow[]); } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const totalAmount    = deals.reduce((s, d) => s + (d.value || 0), 0);
  const wonDeals       = deals.filter(d => d.stage === "won");
  const pipelineValue  = deals.filter(d => d.stage !== "won" && d.stage !== "lost").reduce((s, d) => s + (d.value || 0), 0);
  const closedCount    = wonDeals.length + deals.filter(d => d.stage === "lost").length;
  const convRate       = closedCount > 0 ? Math.round((wonDeals.length / closedCount) * 100) : 0;

  const handleDrop = async (e: React.DragEvent, targetStage: Deal["stage"]) => {
    e.preventDefault();
    setDragOverStage(null);
    if (!draggedDeal) return;
    const deal = deals.find(d => d.id === draggedDeal);
    if (!deal || deal.stage === targetStage) { setDraggedDeal(null); return; }

    // 楽観的更新
    setDeals(prev => prev.map(d => d.id === draggedDeal ? { ...d, stage: targetStage } : d));
    setDraggedDeal(null);

    try {
      await updateDeal(draggedDeal, { stage: targetStage });
      // 受注ステージに移動したら WonDialog を表示
      if (targetStage === "won") {
        setWonDeal({ ...deal, stage: "won" });
      }
    } catch {
      fetchDeals();
    }
  };

  if (loading) return (
    <div className="p-4 md:p-6 space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-4 gap-4">{Array.from({length:4}).map((_,i) => <Skeleton key={i} className="h-24" />)}</div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="商談パイプライン" description="商談の進捗を管理">
        <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />商談を追加
        </Button>
      </PageHeader>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "総商談数",    val: deals.length,                                        icon: Users },
          { label: "総金額",      val: `${Math.round(totalAmount/10000).toLocaleString()}万円`, icon: DollarSign },
          { label: "受注率",      val: `${convRate}%`,                                      icon: TrendingUp },
          { label: "パイプライン", val: `${Math.round(pipelineValue/10000).toLocaleString()}万円`, icon: BarChart3 },
        ].map((k, i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <k.icon className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="text-xl font-bold">{k.val}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* カンバン */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage.key);
          return (
            <div
              key={stage.key}
              className="flex-shrink-0 w-[280px] flex flex-col"
              onDragOver={e => { e.preventDefault(); setDragOverStage(stage.key); }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={e => handleDrop(e, stage.key)}
            >
              <div className={`rounded-t-lg px-3 py-2 ${stage.color}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{stage.label}</h3>
                  <Badge variant="secondary" className="text-xs">{stageDeals.length}</Badge>
                </div>
              </div>
              <div className={`flex-1 bg-black/[0.03] rounded-b-lg p-2 space-y-2 min-h-[120px] transition-colors ${dragOverStage === stage.key ? "bg-primary/10 ring-2 ring-primary/30 ring-inset" : ""}`}>
                {stageDeals.map(deal => {
                  const quoteParams = new URLSearchParams();
                  if (deal.customer_id) quoteParams.set("customer_id", deal.customer_id);
                  quoteParams.set("title", deal.title);
                  if (deal.value) quoteParams.set("value", String(deal.value));
                  return (
                    <Card
                      key={deal.id}
                      draggable
                      onDragStart={() => setDraggedDeal(deal.id)}
                      className={`cursor-grab active:cursor-grabbing group/card ${draggedDeal === deal.id ? "opacity-50" : ""}`}
                    >
                      <CardContent className="p-3 space-y-2">
                        <p className="font-medium text-sm">{deal.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {deal.customer?.company_name || deal.customer?.name || "-"}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{(deal.value||0).toLocaleString()}円</span>
                          <span className={`text-xs ${deal.days_in_stage > 7 ? "text-red-500" : "text-muted-foreground"}`}>
                            {deal.days_in_stage}日
                          </span>
                        </div>
                        {/* 見積作成ボタン（quote_submitted 以降で表示） */}
                        {QUOTE_STAGES.includes(deal.stage) && (
                          <button
                            onClick={e => { e.stopPropagation(); router.push(`/quotes/new?${quoteParams.toString()}`); }}
                            className="w-full flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary border border-dashed border-border hover:border-primary rounded-lg py-1 transition-colors"
                          >
                            <FileText className="h-3 w-3" />見積を作成
                          </button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 商談追加ダイアログ */}
      <AddDealDialog open={addOpen} onOpenChange={setAddOpen} onCreated={fetchDeals} />

      {/* 受注ダイアログ */}
      {wonDeal && (
        <WonDialog
          open={wonDeal !== null}
          onOpenChange={v => { if (!v) setWonDeal(null); }}
          deal={wonDeal}
        />
      )}
    </div>
  );
}
