"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Users, DollarSign, BarChart3, Plus, FileText, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getDeals, updateDeal, getDealStages, deleteDeal } from "@/lib/actions/deals";
import { getProfiles } from "@/lib/actions/profiles";
import { AddDealDialog } from "@/components/deals/add-deal-dialog";
import { WonDialog } from "@/components/deals/won-dialog";
import type { Deal } from "@/lib/database.types";
import type { Profile } from "@/lib/database.types";

type DealRow = Deal & {
  customer: { id: string; name: string; company_name: string | null } | null;
  assignee: { id: string; display_name: string } | null;
};

type StageRow = { key: string; label: string; color: string; is_won: boolean; is_lost: boolean; sort_order: number };

export default function DealsPage() {
  const router = useRouter();
  const [deals, setDeals]               = useState<DealRow[]>([]);
  const [profiles, setProfiles]         = useState<Profile[]>([]);
  const [stages, setStages]             = useState<StageRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [draggedDeal, setDraggedDeal]   = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [addOpen, setAddOpen]           = useState(false);
  const [wonDeal, setWonDeal]           = useState<DealRow | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState("_all");
  const [deleteTarget, setDeleteTarget] = useState<DealRow | null>(null);
  const [deleting, setDeleting]         = useState(false);

  const fetchDeals = useCallback(async () => {
    try { const d = await getDeals(); setDeals(d as DealRow[]); } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchDeals();
    getProfiles().then(setProfiles).catch(() => {});
    getDealStages().then(data => setStages(data as StageRow[])).catch(() => {});
  }, [fetchDeals]);

  const filteredDeals = assigneeFilter === "_all"
    ? deals
    : assigneeFilter === "_unassigned"
      ? deals.filter((d) => !d.assignee)
      : deals.filter((d) => d.assignee?.id === assigneeFilter);

  const wonStageKeys  = stages.filter(s => s.is_won).map(s => s.key);
  const lostStageKeys = stages.filter(s => s.is_lost).map(s => s.key);

  const totalAmount   = filteredDeals.reduce((s, d) => s + (d.value || 0), 0);
  const wonDeals      = filteredDeals.filter(d => wonStageKeys.includes(d.stage));
  const pipelineValue = filteredDeals
    .filter(d => !wonStageKeys.includes(d.stage) && !lostStageKeys.includes(d.stage))
    .reduce((s, d) => s + (d.value || 0), 0);
  const closedCount   = wonDeals.length + filteredDeals.filter(d => lostStageKeys.includes(d.stage)).length;
  const convRate      = closedCount > 0 ? Math.round((wonDeals.length / closedCount) * 100) : 0;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDeal(deleteTarget.id);
      setDeals(prev => prev.filter(d => d.id !== deleteTarget.id));
    } catch { /* ignore */ } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    setDragOverStage(null);
    if (!draggedDeal) return;
    const deal = deals.find(d => d.id === draggedDeal);
    if (!deal || deal.stage === targetStage) { setDraggedDeal(null); return; }

    const typedStage = targetStage as Deal["stage"];
    setDeals(prev => prev.map(d => d.id === draggedDeal ? { ...d, stage: typedStage } : d));
    setDraggedDeal(null);

    try {
      await updateDeal(draggedDeal, { stage: typedStage });
      if (wonStageKeys.includes(targetStage)) {
        setWonDeal({ ...deal, stage: typedStage });
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
          { label: "総商談数",    val: filteredDeals.length,                                            icon: Users },
          { label: "総金額",      val: `${Math.round(totalAmount/10000).toLocaleString()}万円`,         icon: DollarSign },
          { label: "受注率",      val: `${convRate}%`,                                                  icon: TrendingUp },
          { label: "パイプライン", val: `${Math.round(pipelineValue/10000).toLocaleString()}万円`,      icon: BarChart3 },
        ].map((k, i) => (
          <Card key={i} className="py-0">
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

      {/* 担当者フィルタ */}
      <div className="flex items-center gap-2">
        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="担当者でフィルタ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">担当者：すべて</SelectItem>
            <SelectItem value="_unassigned">未割り当て</SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {assigneeFilter !== "_all" && (
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-9" onClick={() => setAssigneeFilter("_all")}>
            リセット
          </Button>
        )}
      </div>

      {/* カンバン */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map(stage => {
          const stageDeals = filteredDeals.filter(d => d.stage === stage.key);
          return (
            <div
              key={stage.key}
              className="flex-shrink-0 w-[280px] flex flex-col"
              onDragOver={e => { e.preventDefault(); setDragOverStage(stage.key); }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={e => handleDrop(e, stage.key)}
            >
              <div
                className="rounded-t-lg px-3 py-2 border border-b-0 border-white/60 dark:border-white/10"
                style={{ backgroundColor: stage.color + "22" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
                    <h3 className="font-semibold text-sm">{stage.label}</h3>
                  </div>
                  <Badge variant="secondary" className="text-xs">{stageDeals.length}</Badge>
                </div>
              </div>
              <div className={`flex-1 rounded-b-lg p-2 space-y-2 min-h-[200px] transition-colors border border-t-0 border-white/60 dark:border-white/10 bg-white/40 dark:bg-white/[0.03] ${dragOverStage === stage.key ? "!bg-primary/10 ring-2 ring-primary/40 ring-inset" : ""}`}>
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
                        <div className="flex items-start justify-between gap-1">
                          <p className="font-medium text-sm flex-1 min-w-0">{deal.title}</p>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="opacity-0 group-hover/card:opacity-100 h-6 w-6 rounded flex items-center justify-center hover:bg-muted transition-opacity shrink-0"
                                onClick={e => e.stopPropagation()}
                              >
                                <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              <DropdownMenuItem onClick={e => { e.stopPropagation(); router.push(`/crm/${deal.customer_id}`); }}>
                                <Pencil className="h-3.5 w-3.5 mr-2" />顧客詳細
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={e => { e.stopPropagation(); setDeleteTarget(deal); }}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" />削除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {deal.customer?.company_name || deal.customer?.name || "-"}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{(deal.value||0).toLocaleString()}円</span>
                          <span className={`text-xs ${deal.days_in_stage > 7 ? "text-red-500" : "text-muted-foreground"}`}>
                            {deal.days_in_stage}日
                          </span>
                        </div>
                        {stage.is_won && (
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
      <AddDealDialog open={addOpen} onOpenChange={setAddOpen} onCreated={fetchDeals} stages={stages} />

      {/* 受注ダイアログ */}
      {wonDeal && (
        <WonDialog
          open={wonDeal !== null}
          onOpenChange={v => { if (!v) setWonDeal(null); }}
          deal={wonDeal}
        />
      )}

      {/* 削除確認 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>商談を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.title}」を削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
