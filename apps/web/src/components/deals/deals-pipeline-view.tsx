"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Users, DollarSign, BarChart3, FileText, MoreVertical, Pencil, Trash2, GripVertical, User, Clock, ArrowRight, Search, LayoutList, KanbanSquare, Eye, EyeOff, Target } from "lucide-react";
import { KpiRow } from "@/components/shared/kpi-row";
import { CustomerAvatar } from "@/components/shared/customer-avatar";
import { cn } from "@/lib/utils";
import { TEAL_CARD_SM } from "@/lib/teal-theme";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { updateDeal, deleteDeal } from "@/lib/actions/deals";
import { fetchDeals, fetchDealStages, fetchProfiles } from "@/lib/queries/lists";
import { AddDealDialog } from "@/components/deals/add-deal-dialog";
import { EditDealDialog } from "@/components/deals/edit-deal-dialog";
import { WonDialog } from "@/components/deals/won-dialog";
import type { Deal } from "@/lib/database.types";
import type { Profile } from "@/lib/database.types";

const PRIORITY_LABEL: Record<string, string> = { high: "高", medium: "中", low: "低" };
const PRIORITY_CLASS: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-700 border-emerald-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

const STAGE_FALLBACK: Record<string, { label: string; color: string }> = {
  lead: { label: "リード", color: "#6B7280" },
  negotiating: { label: "商談中", color: "#3B82F6" },
  school: { label: "スクール入学", color: "#8B5CF6" },
  presentation: { label: "プレゼン契約", color: "#F59E0B" },
  construction: { label: "着工", color: "#10B981" },
  delivered: { label: "引き渡し済み", color: "#0F5132" },
  lost: { label: "失注", color: "#EF4444" },
  inquiry: { label: "問い合わせ", color: "#6B7280" },
  first_meeting: { label: "初回面談", color: "#3B82F6" },
  materials_sent: { label: "資料送付", color: "#8B5CF6" },
  quote_submitted: { label: "見積提出", color: "#F59E0B" },
  negotiation: { label: "商談中", color: "#3B82F6" },
  closing: { label: "クロージング", color: "#10B981" },
  won: { label: "受注", color: "#0F5132" },
};

/** DB上の旧stageキーを deal_stages マスタキーに揃える */
function normalizeStageKey(stageKey: string, stages: StageRow[]): string {
  if (stages.some(s => s.key === stageKey)) return stageKey;
  const legacyMap: Record<string, string> = {
    won: "delivered",
    inquiry: "lead",
    first_meeting: "lead",
    materials_sent: "school",
    quote_submitted: "presentation",
    negotiation: "negotiating",
    closing: "construction",
  };
  const mapped = legacyMap[stageKey];
  if (mapped && stages.some(s => s.key === mapped)) return mapped;
  if (stageKey === "won") {
    const won = stages.find(s => s.is_won);
    if (won) return won.key;
  }
  if (stageKey === "lost") {
    const lost = stages.find(s => s.is_lost);
    if (lost) return lost.key;
  }
  return mapped ?? stageKey;
}

function resolveStage(stageKey: string, stages: StageRow[]) {
  const key = normalizeStageKey(stageKey, stages);
  const found = stages.find(s => s.key === key);
  if (found) return { label: found.label, color: found.color, isWon: found.is_won, isLost: found.is_lost, key };
  const fb = STAGE_FALLBACK[stageKey] ?? STAGE_FALLBACK[key];
  if (fb) return { ...fb, isWon: stageKey === "won" || key === "delivered", isLost: stageKey === "lost" || key === "lost", key };
  return { label: stageKey, color: "#6B7280", isWon: false, isLost: false, key: stageKey };
}

function isWonStageKey(stageKey: string, stages: StageRow[]) {
  if (stageKey === "won") return true;
  return stages.some(s => s.key === stageKey && s.is_won);
}

function isLostStageKey(stageKey: string, stages: StageRow[]) {
  if (stageKey === "lost") return true;
  return stages.some(s => s.key === stageKey && s.is_lost);
}

type DealRow = Deal & {
  customer: { id: string; name: string; company_name: string | null } | null;
  assignee: { id: string; display_name: string } | null;
};

type StageRow = { key: string; label: string; color: string; is_won: boolean; is_lost: boolean; sort_order: number };

function formatYen(n: number) {
  if (n >= 100_000_000) return `¥${(n / 100_000_000).toFixed(1)}億`;
  if (n >= 10_000) return `¥${(n / 10_000).toFixed(0)}万`;
  return `¥${n.toLocaleString()}`;
}

function stageColumnClass(stage: StageRow) {
  if (stage.is_won) return "bg-emerald-50/60 border-emerald-200/70";
  if (stage.is_lost) return "bg-slate-100/70 border-slate-200/80";
  return "bg-white/70 border-border/60";
}

function daysInStageLabel(days: number) {
  if (days > 14) return { text: `滞留 ${days}日`, className: "bg-rose-100 text-rose-700 border-rose-200" };
  if (days > 7) return { text: `滞留 ${days}日`, className: "bg-amber-100 text-amber-800 border-amber-200" };
  return { text: `${days}日`, className: "bg-slate-100 text-slate-600 border-slate-200" };
}

type DealsPipelineViewProps = {
  addOpen?: boolean;
  onAddOpenChange?: (open: boolean) => void;
};

export function DealsPipelineView({ addOpen: addOpenProp, onAddOpenChange }: DealsPipelineViewProps = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // React Query でキャッシュし、再訪時は即表示（staleTime 内は再取得なし）
  const { data: dealsData, isPending: dealsPending } = useQuery({
    queryKey: ["deals", "pipeline"],
    queryFn: () => fetchDeals(),
    staleTime: 60_000,
  });
  const { data: profilesData } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => fetchProfiles(),
    staleTime: 5 * 60_000,
  });
  const { data: stagesData } = useQuery({
    queryKey: ["deal-stages"],
    queryFn: () => fetchDealStages(),
    staleTime: 5 * 60_000,
  });

  // 楽観更新（D&D・削除）はローカル state を正とし、再取得時にサーバー値へ同期
  const [deals, setDeals]               = useState<DealRow[]>([]);
  const profiles = (profilesData ?? []) as Profile[];
  const stages   = (stagesData ?? []) as StageRow[];
  const loading  = dealsPending && deals.length === 0;
  useEffect(() => {
    if (dealsData) setDeals(dealsData as DealRow[]);
  }, [dealsData]);

  const [draggedDeal, setDraggedDeal]   = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [addOpenInternal, setAddOpenInternal] = useState(false);
  const [editDeal, setEditDeal]         = useState<DealRow | null>(null);
  const [wonDeal, setWonDeal]           = useState<DealRow | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState("_all");
  const [stageFilter, setStageFilter] = useState("_all");
  const [deleteTarget, setDeleteTarget] = useState<DealRow | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [viewMode, setViewMode]         = useState<"list" | "kanban">("list");
  const [searchQuery, setSearchQuery]   = useState("");
  const [showClosedDeals, setShowClosedDeals] = useState(false);

  const addOpen = addOpenProp ?? addOpenInternal;
  const setAddOpen = onAddOpenChange ?? setAddOpenInternal;

  const fetchDeals = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["deals", "pipeline"] });
  }, [queryClient]);

  const wonStageKeys  = stages.filter(s => s.is_won).map(s => s.key);
  const lostStageKeys = stages.filter(s => s.is_lost).map(s => s.key);

  const assigneeFiltered = assigneeFilter === "_all"
    ? deals
    : assigneeFilter === "_unassigned"
      ? deals.filter((d) => !d.assignee)
      : deals.filter((d) => d.assignee?.id === assigneeFilter);

  const searchFiltered = searchQuery.trim()
    ? assigneeFiltered.filter(d => {
        const q = searchQuery.toLowerCase();
        return d.title.toLowerCase().includes(q)
          || (d.customer?.name ?? "").toLowerCase().includes(q)
          || (d.customer?.company_name ?? "").toLowerCase().includes(q);
      })
    : assigneeFiltered;

  const stageFiltered = stageFilter === "_all"
    ? searchFiltered
    : searchFiltered.filter(d => normalizeStageKey(d.stage, stages) === stageFilter);

  const isClosedStage = (stageKey: string) => {
    const n = normalizeStageKey(stageKey, stages);
    return isWonStageKey(n, stages) || isLostStageKey(n, stages);
  };

  const filteredDeals = stageFilter !== "_all"
    ? stageFiltered
    : showClosedDeals
      ? searchFiltered
      : searchFiltered.filter(d => !isClosedStage(d.stage));

  const statsBase = stageFilter !== "_all" ? stageFiltered : searchFiltered;
  const allActiveDeals = statsBase.filter(d => !isClosedStage(d.stage));
  const wonDeals       = searchFiltered.filter(d => isWonStageKey(normalizeStageKey(d.stage, stages), stages));
  const lostDeals      = searchFiltered.filter(d => isLostStageKey(normalizeStageKey(d.stage, stages), stages));
  const highPriorityDeals = allActiveDeals.filter(d => d.priority === "high");

  const highPrioAmount  = highPriorityDeals.reduce((s, d) => s + (d.value || 0), 0);

  const totalAmount   = filteredDeals.reduce((s, d) => s + (d.value || 0), 0);
  const pipelineValue = allActiveDeals.reduce((s, d) => s + (d.value || 0), 0);
  const closedCount   = wonDeals.length + lostDeals.length;
  const convRate      = closedCount > 0 ? Math.round((wonDeals.length / closedCount) * 100) : 0;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDeal(deleteTarget.id);
      setDeals(prev => prev.filter(d => d.id !== deleteTarget.id));
      void fetchDeals();
    } catch { /* ignore */ } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleStageChange = async (deal: DealRow, targetStage: string) => {
    if (normalizeStageKey(deal.stage, stages) === targetStage) return;
    const typedStage = targetStage as Deal["stage"];
    setDeals(prev => prev.map(d => d.id === deal.id ? { ...d, stage: typedStage } : d));
    if (isWonStageKey(targetStage, stages) || isLostStageKey(targetStage, stages)) {
      setShowClosedDeals(true);
    }
    try {
      await updateDeal(deal.id, { stage: typedStage });
      if (isWonStageKey(targetStage, stages)) {
        setWonDeal({ ...deal, stage: typedStage });
      }
    } catch {
      fetchDeals();
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    setDragOverStage(null);
    if (!draggedDeal) return;
    const deal = deals.find(d => d.id === draggedDeal);
    if (!deal || deal.stage === targetStage) { setDraggedDeal(null); return; }
    setDraggedDeal(null);
    await handleStageChange(deal, targetStage);
  };

  if (loading) return (
    <div className="space-y-6">
      <KpiRow loading columns={5} items={[{ label: "", value: "" }, { label: "", value: "" }, { label: "", value: "" }, { label: "", value: "" }, { label: "", value: "" }]} />
      <Skeleton className="h-[400px] w-full" />
    </div>
  );

  return (
    <div className="space-y-6">
      <KpiRow
        items={[
          { label: "総商談数", value: String(filteredDeals.length), sub: "件", icon: Users },
          { label: "総金額", value: formatYen(totalAmount), icon: DollarSign },
          { label: "確度「高」", value: formatYen(highPrioAmount), sub: `${highPriorityDeals.length}件`, icon: Target },
          { label: "受注率", value: `${convRate}%`, icon: TrendingUp },
          { label: "パイプライン", value: formatYen(pipelineValue), sub: "見込み", icon: BarChart3 },
        ]}
        columns={5}
      />

      {/* 検索・フィルタ・表示切替 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="機会名、クライアント名で検索..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="担当者" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">担当者</SelectItem>
            <SelectItem value="_unassigned">未割り当て</SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="ステージ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">ステージ</SelectItem>
            {stages.map(s => (
              <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(wonDeals.length > 0 || lostDeals.length > 0) && (
          <button
            onClick={() => setShowClosedDeals(v => !v)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showClosedDeals ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showClosedDeals
              ? "受注/失注を非表示"
              : `受注${wonDeals.length}件・失注${lostDeals.length}件は非表示`}
          </button>
        )}
        <div className="ml-auto flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
          <button
            onClick={() => setViewMode("list")}
            className={cn("h-7 w-7 rounded-md flex items-center justify-center transition-colors", viewMode === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <LayoutList className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setViewMode("kanban")}
            className={cn("h-7 w-7 rounded-md flex items-center justify-center transition-colors", viewMode === "kanban" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <KanbanSquare className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* リスト表示 */}
      {viewMode === "list" && (
        <div className="rounded-xl border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">機会名</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">クライアント</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">ステージ</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs">金額</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground text-xs">確度</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground text-xs">担当</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {filteredDeals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {searchQuery ? `「${searchQuery}」に一致する商談はありません` : "商談がありません"}
                  </td>
                </tr>
              ) : filteredDeals.map(deal => {
                const selectStageKey = normalizeStageKey(deal.stage, stages);
                const stageDisplay = resolveStage(deal.stage, stages);
                const customerName = deal.customer?.company_name || deal.customer?.name || "顧客未設定";
                const customerSeed = deal.customer_id ?? deal.id;
                const priorityLabel = PRIORITY_LABEL[deal.priority] ?? deal.priority;
                const priorityClass = PRIORITY_CLASS[deal.priority] ?? PRIORITY_CLASS.medium;
                return (
                  <tr
                    key={deal.id}
                    onClick={() => deal.customer_id && router.push(`/crm/${deal.customer_id}?tab=deals`)}
                    className={cn("border-b last:border-0 transition-colors hover:bg-muted/30", deal.customer_id && "cursor-pointer")}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <CustomerAvatar seed={customerSeed} name={customerName} size="sm" className="h-7 w-7 text-xs shrink-0" />
                        <span className="font-medium text-foreground line-clamp-1">{deal.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{customerName}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
                      <Select value={selectStageKey} onValueChange={v => handleStageChange(deal, v)}>
                        <SelectTrigger
                          size="sm"
                          className="!h-6 min-h-6 !py-0 !px-2 w-auto min-w-0 rounded-full text-xs font-medium gap-0.5 shadow-none focus:ring-1 [&_svg]:size-3 [&_svg]:opacity-60"
                          style={{
                            backgroundColor: `${stageDisplay.color}18`,
                            borderColor: `${stageDisplay.color}40`,
                            color: stageDisplay.color,
                          }}
                          onClick={e => e.stopPropagation()}
                          onPointerDown={e => e.stopPropagation()}
                        >
                          <SelectValue className="text-xs">{stageDisplay.label}</SelectValue>
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} onPointerDown={e => e.stopPropagation()}>
                          {stages.map(s => (
                            <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">{formatYen(deal.value || 0)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", priorityClass)}>
                        {priorityLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {deal.assignee
                        ? <span className="text-xs text-muted-foreground">{deal.assignee.display_name}</span>
                        : <span className="text-xs text-muted-foreground/50">未設定</span>
                      }
                    </td>
                    <td className="px-2 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                            onClick={e => e.stopPropagation()}
                          >
                            <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem onClick={e => { e.stopPropagation(); setEditDeal(deal); }}>
                            <Pencil className="h-3.5 w-3.5 mr-2" />編集
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={e => { e.stopPropagation(); setDeleteTarget(deal); }}>
                            <Trash2 className="h-3.5 w-3.5 mr-2" />削除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* カンバン表示 */}
      {viewMode === "kanban" && (
      <div className="relative -mx-1 px-1">
        <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory scroll-smooth">
        {stages.map((stage, stageIndex) => {
          const stageDeals = filteredDeals.filter(d => normalizeStageKey(d.stage, stages) === stage.key);
          const stageTotal = stageDeals.reduce((s, d) => s + (d.value || 0), 0);
          const isDropTarget = dragOverStage === stage.key;
          return (
            <div
              key={stage.key}
              className="flex-shrink-0 w-[300px] snap-start flex flex-col"
              onDragOver={e => { e.preventDefault(); setDragOverStage(stage.key); }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={e => handleDrop(e, stage.key)}
            >
              <div
                className={cn(
                  "rounded-xl border flex flex-col min-h-[360px] overflow-hidden transition-shadow",
                  stageColumnClass(stage),
                  isDropTarget && "ring-2 ring-primary/50 shadow-md",
                )}
              >
                {/* カラムヘッダー */}
                <div
                  className="px-3 py-3 border-b border-black/5"
                  style={{ backgroundColor: `${stage.color}18` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm text-slate-800 truncate">{stage.label}</h3>
                        {stageIndex < stages.length - 1 && (
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 hidden lg:block" aria-hidden />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                        合計 {formatYen(stageTotal)}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className="tabular-nums shrink-0 font-semibold"
                      style={{ backgroundColor: `${stage.color}28`, color: stage.color }}
                    >
                      {stageDeals.length}
                    </Badge>
                  </div>
                </div>

                {/* カード一覧 */}
                <div className="flex-1 p-2 space-y-2 min-h-[280px]">
                  {stageDeals.length === 0 ? (
                    <div
                      className={cn(
                        "h-full min-h-[120px] rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 px-3 py-6 text-center",
                        isDropTarget ? "border-primary/40 bg-primary/5 text-primary" : "border-border/50 text-muted-foreground",
                      )}
                    >
                      <p className="text-xs font-medium">商談なし</p>
                      <p className="text-[10px] opacity-80">ここにドロップ</p>
                    </div>
                  ) : stageDeals.map(deal => {
                  const quoteParams = new URLSearchParams();
                  if (deal.customer_id) quoteParams.set("customer_id", deal.customer_id);
                  quoteParams.set("title", deal.title);
                  if (deal.value) quoteParams.set("value", String(deal.value));
                  const customerName = deal.customer?.company_name || deal.customer?.name || "顧客未設定";
                  const customerSeed = deal.customer_id ?? deal.id;
                  const daysBadge = daysInStageLabel(deal.days_in_stage ?? 0);

                  return (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={() => setDraggedDeal(deal.id)}
                      onClick={() => deal.customer_id && router.push(`/crm/${deal.customer_id}?tab=deals`)}
                      className={cn(
                        TEAL_CARD_SM,
                        "group/card cursor-grab active:cursor-grabbing border border-border/50 hover:border-primary/30 hover:shadow-md transition-all",
                        draggedDeal === deal.id && "opacity-50 scale-[0.98]",
                        deal.customer_id && "cursor-pointer",
                      )}
                    >
                      <div className="p-3 space-y-2.5">
                        <div className="flex items-start gap-2">
                          <CustomerAvatar seed={customerSeed} name={customerName} size="sm" className="h-8 w-8 text-xs" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm leading-snug line-clamp-2 text-slate-900">{deal.title}</p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{customerName}</p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="opacity-0 group-hover/card:opacity-100 h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted transition-opacity shrink-0"
                                onClick={e => e.stopPropagation()}
                              >
                                <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              <DropdownMenuItem onClick={e => { e.stopPropagation(); setEditDeal(deal); }}>
                                <Pencil className="h-3.5 w-3.5 mr-2" />編集
                              </DropdownMenuItem>
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

                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <span className="text-base font-black tabular-nums text-slate-900">{formatYen(deal.value || 0)}</span>
                          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border tabular-nums flex items-center gap-0.5", daysBadge.className)}>
                            <Clock className="h-2.5 w-2.5" />
                            {daysBadge.text}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          {deal.assignee ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md max-w-full truncate">
                              <User className="h-2.5 w-2.5 shrink-0" />
                              {deal.assignee.display_name}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/70">担当未設定</span>
                          )}
                          {deal.priority === "high" && (
                            <Badge variant="outline" className="text-[10px] h-5 border-rose-200 text-rose-600 bg-rose-50">
                              重要
                            </Badge>
                          )}
                        </div>

                        {stage.is_won && (
                          <button
                            onClick={e => { e.stopPropagation(); router.push(`/quotes/new?${quoteParams.toString()}`); }}
                            className="w-full flex items-center justify-center gap-1.5 text-[11px] font-medium text-primary hover:bg-primary/5 border border-dashed border-primary/30 rounded-lg py-1.5 transition-colors"
                          >
                            <FileText className="h-3 w-3" />見積を作成
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </div>
      )}

      <AddDealDialog open={addOpen} onOpenChange={setAddOpen} onCreated={fetchDeals} stages={stages} />

      <EditDealDialog
        open={editDeal !== null}
        onOpenChange={(v) => { if (!v) setEditDeal(null); }}
        deal={editDeal}
        stages={stages}
        onUpdated={fetchDeals}
      />

      {wonDeal && (
        <WonDialog
          open={wonDeal !== null}
          onOpenChange={v => { if (!v) setWonDeal(null); }}
          deal={wonDeal}
        />
      )}

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
