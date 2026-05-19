"use client";

import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWidgets } from "@/hooks/use-widgets";
import { WidgetCustomizer } from "@/components/shared/widget-customizer";
import { SortableWidget } from "@/components/shared/sortable-widget";
import {
  LogIn,
  LogOut,
  TrendingUp,
  Users,
  Briefcase,
  HardHat,
  BarChart3,
  ExternalLink,
  Check,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getDashboardData } from "@/lib/actions/dashboard";
import { clockIn as clockInAction, clockOut as clockOutAction, getTodayAttendance } from "@/lib/actions/attendance";
import { AnalogClock } from "@/components/shared/analog-clock";
import {
  DndContext,
  closestCorners,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

function formatYen(n: number) {
  if (n >= 100_000_000) return `¥${(n / 100_000_000).toFixed(1)}億`;
  if (n >= 10_000) return `¥${(n / 10_000).toFixed(0)}万`;
  return `¥${n.toLocaleString()}`;
}

const kpiColor = "#18181b";

export default function Dashboard2Page() {
  const [clockedIn, setClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const { widgets, hydrated, toggleVisible, moveUp, moveDown, reorder, resizeWidget, setWidgetWidth, initWidths, reset } = useWidgets();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) reorder(String(active.id), String(over.id));
  }, [reorder]);

  useEffect(() => {
    getDashboardData()
      .then(setData)
      .catch(() => toast.error("データの取得に失敗しました"))
      .finally(() => setLoading(false));
    getTodayAttendance().then((entry) => {
      if (entry?.clock_in_at) {
        setClockedIn(!entry.clock_out_at);
        setClockInTime(new Date(entry.clock_in_at));
      }
    }).catch(() => {});
  }, []);

  const now = new Date();

  const handleClockIn = async () => {
    try {
      await clockInAction();
      setClockedIn(true);
      setClockInTime(new Date());
      toast.success("出勤しました", { description: format(new Date(), "HH:mm", { locale: ja }) });
    } catch {
      toast.error("出勤打刻に失敗しました");
    }
  };
  const handleClockOut = async () => {
    try {
      await clockOutAction();
      setClockedIn(false);
      toast.success("退勤しました", { description: format(new Date(), "HH:mm", { locale: ja }) });
    } catch {
      toast.error("退勤打刻に失敗しました");
    }
  };

  const isVisible = (id: string) =>
    !hydrated || (widgets.find((w) => w.id === id)?.visible ?? true);

  const todos = data?.todos ?? [];
  const visibleTodos = todos.slice(0, 6);
  const urgentCount = todos.filter((t) => t.priority === "high" && t.status !== "completed").length;

  const renderCard = (id: string) => {
    switch (id) {
      case "attendance":
        return !isVisible("attendance") ? null : (
          <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-5 flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-widest uppercase text-zinc-400">勤怠打刻</span>
              <Link href="/attendance"><ExternalLink className="h-3.5 w-3.5 text-zinc-300 hover:text-zinc-600 transition-colors" /></Link>
            </div>
            <div className="flex flex-col items-center gap-2">
              <AnalogClock size={120} hourColor="#18181b" minuteColor="#27272a" secondColor="#71717a" centerColor="#18181b" />
              <p className="text-xl font-bold tabular-nums tracking-tight text-zinc-900 leading-none">{format(now, "HH:mm")}</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${clockedIn ? "bg-zinc-800" : "bg-zinc-300"}`} />
                  <span className="text-[11px] text-zinc-500 font-medium">{clockedIn ? "勤務中" : "未出勤"}</span>
                </div>
                <span className="text-zinc-200">·</span>
                <p className="text-[11px] text-zinc-400 tabular-nums">
                  {clockInTime ? `出勤 ${format(clockInTime, "HH:mm")}〜` : format(now, "M月d日（EEE）", { locale: ja })}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-auto">
              <button onClick={handleClockIn} disabled={clockedIn}
                className="h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-zinc-900 text-white hover:bg-zinc-700">
                <LogIn className="h-3.5 w-3.5" />出勤
              </button>
              <button onClick={handleClockOut} disabled={!clockedIn}
                className="h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-200 text-zinc-600 hover:bg-zinc-50">
                <LogOut className="h-3.5 w-3.5" />退勤
              </button>
            </div>
          </div>
        );

      case "ai-focus":
        return !isVisible("ai-focus") ? null : (
          <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-5 flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] font-semibold tracking-widest uppercase text-zinc-400">今日のフォーカス</span>
                {!loading && todos.length > 0 && <span className="text-[11px] font-bold text-zinc-900 tabular-nums">{todos.length}件</span>}
                {!loading && urgentCount > 0 && (
                  <span className="text-[10px] font-semibold text-rose-500 border border-rose-200 rounded px-1.5 py-0.5">急ぎ {urgentCount}</span>
                )}
              </div>
              <Link href="/bi"><ExternalLink className="h-3.5 w-3.5 text-zinc-300 hover:text-zinc-600 transition-colors" /></Link>
            </div>
            <div className="flex flex-col divide-y divide-zinc-100">
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5">
                  <Skeleton className="h-3.5 w-3.5 rounded-sm shrink-0" />
                  <Skeleton className="h-3 flex-1" />
                </div>
              )) : visibleTodos.length ? visibleTodos.map((todo, idx) => {
                const isCompleted = todo.status === "completed";
                const isUrgent = todo.priority === "high" && !isCompleted;
                return (
                  <div key={todo.id} className={`flex items-center gap-3 py-2.5 px-1 cursor-pointer group hover:bg-zinc-50 rounded transition-colors ${isUrgent ? "hover:bg-rose-50/40" : ""}`}>
                    <span className="text-[10px] tabular-nums text-zinc-300 w-4 shrink-0 font-mono leading-none">{String(idx + 1).padStart(2, "0")}</span>
                    <div className={`h-3.5 w-3.5 rounded-sm border shrink-0 flex items-center justify-center transition-colors ${isCompleted ? "bg-zinc-900 border-zinc-900" : "border-zinc-300 group-hover:border-zinc-500"}`}>
                      {isCompleted && <Check className="h-2 w-2 text-white" strokeWidth={3} />}
                    </div>
                    <span className={`text-xs flex-1 truncate ${isCompleted ? "line-through text-zinc-300" : "text-zinc-700"}`}>{todo.title}</span>
                    {isUrgent && <span className="text-[9px] font-bold text-rose-500 border border-rose-200 rounded px-1 shrink-0">急</span>}
                  </div>
                );
              }) : (
                <div className="py-8 flex flex-col items-center gap-1.5 text-center">
                  <CheckCircle2 className="h-6 w-6 text-zinc-300" />
                  <p className="text-xs text-zinc-400">今日のタスクは完了しました</p>
                </div>
              )}
            </div>
            {!loading && todos.length > visibleTodos.length && (
              <Link href="/bi" className="text-[11px] text-zinc-400 hover:text-zinc-700 transition-colors mt-auto">
                +{todos.length - visibleTodos.length} 件 →
              </Link>
            )}
          </div>
        );

      case "workflow":
        return !isVisible("workflow") ? null : (
          <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-5 flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-widest uppercase text-zinc-400">ワークフロー</span>
              <Link href="/workflow"><ExternalLink className="h-3.5 w-3.5 text-zinc-300 hover:text-zinc-600 transition-colors" /></Link>
            </div>
            <div className="flex flex-col gap-1 flex-1">
              {[
                { label: "承認待ち", count: data?.workflow.pendingApprovals ?? 0, accent: "text-amber-600" },
                { label: "申請中",   count: data?.workflow.submittedRequests ?? 0, accent: "text-zinc-500" },
                { label: "完了済み", count: data?.workflow.completedRequests ?? 0, accent: "text-zinc-800" },
              ].map((item, i) => (
                <Link key={i} href="/workflow" className="flex items-center justify-between py-3 border-b border-zinc-100 last:border-0 hover:bg-zinc-50 -mx-2 px-2 rounded transition-colors">
                  <span className="text-xs text-zinc-500">{item.label}</span>
                  {loading ? <Skeleton className="h-5 w-8" /> : (
                    <span className={`text-xl font-bold tabular-nums leading-none ${item.accent}`}>{item.count}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        );

      case "mail":
        return !isVisible("mail") ? null : (
          <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-5 flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold tracking-widest uppercase text-zinc-400">お知らせ</span>
                {!loading && data?.announcements && data.announcements.length > 0 && (
                  <span className="text-[10px] font-bold tabular-nums text-zinc-900 bg-zinc-100 rounded-full px-2 py-0.5">{data.announcements.length}</span>
                )}
              </div>
              <Link href="/circulation"><ExternalLink className="h-3.5 w-3.5 text-zinc-300 hover:text-zinc-600 transition-colors" /></Link>
            </div>
            <div className="flex flex-col divide-y divide-zinc-100">
              {loading ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="py-2.5 space-y-1.5"><Skeleton className="h-3 w-3/4" /><Skeleton className="h-2.5 w-full" /></div>
              )) : data?.announcements.length ? data.announcements.map((ann) => (
                <Link key={ann.id} href={`/circulation/${ann.id}`}
                  className="group flex items-start gap-2 py-2.5 px-1 hover:bg-zinc-50 rounded transition-colors">
                  <div className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${ann.is_urgent ? "bg-rose-500" : "bg-zinc-300"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs font-semibold leading-snug line-clamp-1 ${ann.is_urgent ? "text-rose-800" : "text-zinc-800"}`}>
                        {ann.is_urgent && <span className="inline-block text-[9px] font-bold bg-rose-500 text-white rounded px-1 py-0.5 mr-1.5 align-middle">緊急</span>}
                        {ann.title}
                      </p>
                      <span className="text-[10px] text-zinc-400 tabular-nums shrink-0">{format(new Date(ann.published_at), "M/d", { locale: ja })}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate mt-0.5">{ann.body}</p>
                  </div>
                </Link>
              )) : (
                <p className="text-xs text-zinc-400 py-4 text-center">お知らせはありません</p>
              )}
            </div>
          </div>
        );

      case "customers":
        return !isVisible("customers") ? null : (
          <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-5 flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-widest uppercase text-zinc-400">最近の顧客</span>
              <Link href="/crm"><ExternalLink className="h-3.5 w-3.5 text-zinc-300 hover:text-zinc-600 transition-colors" /></Link>
            </div>
            <div className="flex flex-col divide-y divide-zinc-100">
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="py-2.5 flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-md shrink-0" />
                  <div className="flex-1 space-y-1"><Skeleton className="h-3 w-24" /><Skeleton className="h-2.5 w-16" /></div>
                </div>
              )) : data?.recentCustomers.length ? data.recentCustomers.map((customer) => (
                <Link key={customer.id} href={`/crm/${customer.id}`}
                  className="py-2.5 flex items-center gap-3 group hover:bg-zinc-50 -mx-2 px-2 rounded transition-colors">
                  <div className="h-8 w-8 rounded-md bg-zinc-900 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-white">{customer.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-zinc-800 truncate">{customer.name}</p>
                    <p className="text-[11px] text-zinc-400">{customer.company_name || "個人"}</p>
                  </div>
                  <span className="text-[10px] text-zinc-400 border border-zinc-200 rounded px-1.5 py-0.5 shrink-0">{customer.status}</span>
                </Link>
              )) : (
                <p className="text-xs text-zinc-400 py-4">顧客データはありません</p>
              )}
            </div>
          </div>
        );

      case "constructions":
        return !isVisible("constructions") ? null : (
          <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-5 flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-widest uppercase text-zinc-400">進行中の工事</span>
              <Link href="/constructions"><ExternalLink className="h-3.5 w-3.5 text-zinc-300 hover:text-zinc-600 transition-colors" /></Link>
            </div>
            <div className="flex flex-col gap-3">
              {loading ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between"><Skeleton className="h-3 w-28" /><Skeleton className="h-5 w-10" /></div>
                  <Skeleton className="h-1 w-full" />
                </div>
              )) : data?.constructions.length ? data.constructions.map((c, idx) => (
                <Link key={c.id} href={`/constructions/${c.id}`}
                  className="group block space-y-2 hover:bg-zinc-50 -mx-2 px-2 py-1.5 rounded transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono font-bold text-zinc-300 shrink-0">{String(idx + 1).padStart(2, "0")}</span>
                      <span className="text-xs font-semibold text-zinc-700 truncate">{c.title}</span>
                    </div>
                    <span className="text-base font-black tabular-nums text-zinc-900 shrink-0">{c.progress}<span className="text-[10px] font-semibold text-zinc-400">%</span></span>
                  </div>
                  <div className="h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-zinc-900 rounded-full transition-all duration-500" style={{ width: `${c.progress}%` }} />
                  </div>
                </Link>
              )) : (
                <p className="text-xs text-zinc-400 py-4">進行中の工事はありません</p>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const sortableIds = widgets.filter((w) => w.id !== "kpi" && w.visible).map((w) => w.id);

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">ダッシュボード</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{format(now, "yyyy年M月d日（EEEE）", { locale: ja })}</p>
        </div>
        <WidgetCustomizer
          widgets={widgets}
          onToggle={toggleVisible}
          onMoveUp={moveUp}
          onMoveDown={moveDown}
          onReset={reset}
          kpiColor={kpiColor}
          onKpiColorChange={() => {}}
        />
      </div>

      {/* KPI row */}
      {isVisible("kpi") && (
        <Card className="stat-card transition-[box-shadow,background-color] duration-200 py-0">
          <CardContent className="py-2">
            <div className="grid grid-cols-2 lg:grid-cols-4">
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-4 first:pl-0 last:pr-0 space-y-1.5">
                  <Skeleton className="h-3 w-16" /><Skeleton className="h-6 w-24" />
                </div>
              )) : [
                { label: "受注額",      value: formatYen(data?.kpis.wonValue ?? 0),           icon: TrendingUp },
                { label: "パイプライン", value: formatYen(data?.kpis.pipelineValue ?? 0),      icon: BarChart3 },
                { label: "顧客数",      value: String(data?.kpis.customerCount ?? 0),          icon: Users },
                { label: "進行案件",    value: String(data?.kpis.activeConstructions ?? 0),    icon: Briefcase },
              ].map((kpi, i) => (
                <div key={i} className="px-4 rounded-lg transition-all duration-300 cursor-default hover:-translate-y-0.5 hover:shadow-[0_0_12px_2px_rgba(0,0,0,0.06)]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{kpi.label}</span>
                    <div className="neumorph-icon h-8 w-8" style={{ background: kpiColor }}>
                      <kpi.icon className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold tabular-nums tracking-tight">{kpi.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sortable widget grid */}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
          <div data-widget-grid className="flex flex-wrap gap-4">
            {sortableIds.map((id) => {
              const card = renderCard(id);
              if (!card) return null;
              const wc = widgets.find((w) => w.id === id);
              return (
                <SortableWidget
                  key={id}
                  id={id}
                  widthPx={wc?.widthPx}
                  height={wc?.height}
                  onResize={resizeWidget}
                  onResizeWidth={setWidgetWidth}
                  onInitWidths={initWidths}
                >
                  {card}
                </SortableWidget>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

    </div>
  );
}
