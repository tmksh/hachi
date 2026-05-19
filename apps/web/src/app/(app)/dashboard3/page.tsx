"use client";

import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useState, useEffect, useCallback, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  LogIn,
  LogOut,
  TrendingUp,
  Users,
  Briefcase,
  BarChart3,
  ArrowUpRight,
  Sparkles,
  Check,
  CheckCircle2,
  HardHat,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getDashboardData } from "@/lib/actions/dashboard";
import { clockIn as clockInAction, clockOut as clockOutAction, getTodayAttendance } from "@/lib/actions/attendance";
import { AnalogClock } from "@/components/shared/analog-clock";
import { SortableWidget } from "@/components/shared/sortable-widget";
import { useWidgets } from "@/hooks/use-widgets";
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

const MONTHLY_DATA = [
  { month: "11月", 受注額: 1820, パイプライン: 2400 },
  { month: "12月", 受注額: 2100, パイプライン: 2900 },
  { month: "1月",  受注額: 1650, パイプライン: 2600 },
  { month: "2月",  受注額: 2300, パイプライン: 3200 },
  { month: "3月",  受注額: 2750, パイプライン: 3500 },
  { month: "4月",  受注額: 2400, パイプライン: 3100 },
  { month: "5月",  受注額: 2850, パイプライン: 3969 },
];

const ACCENT = "#18181b";

/** カードの空きスペースに合わせて自動でサイズが変わるアナログ時計 */
function ResponsiveClock() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState(76);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      const next = Math.max(48, Math.min(220, Math.floor(Math.min(rect.width, rect.height))));
      setSize(next);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={wrapperRef} className="w-full h-full flex items-center justify-center">
      <AnalogClock size={size} />
    </div>
  );
}

export default function Dashboard3Page() {
  const [clockedIn, setClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const now = new Date();

  const { widgets, hydrated, toggleVisible, moveUp, moveDown, reorder, resizeWidget, setWidgetWidth, initWidths, reset } = useWidgets();

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

  const handleClockIn = async () => {
    try {
      await clockInAction();
      setClockedIn(true);
      setClockInTime(new Date());
      toast.success("出勤しました", { description: format(new Date(), "HH:mm", { locale: ja }) });
    } catch { toast.error("出勤打刻に失敗しました"); }
  };
  const handleClockOut = async () => {
    try {
      await clockOutAction();
      setClockedIn(false);
      toast.success("退勤しました", { description: format(new Date(), "HH:mm", { locale: ja }) });
    } catch { toast.error("退勤打刻に失敗しました"); }
  };

  const isVisible = (id: string) =>
    !hydrated || (widgets.find((w) => w.id === id)?.visible ?? true);

  const todos = data?.todos ?? [];
  const visibleTodos = todos.slice(0, 5);
  const urgentCount = todos.filter((t) => t.priority === "high" && t.status !== "completed").length;

  const kpis = [
    { label: "受注額",      value: formatYen(data?.kpis.wonValue ?? 0),          sub: "今月",   icon: TrendingUp, color: ACCENT },
    { label: "パイプライン", value: formatYen(data?.kpis.pipelineValue ?? 0),     sub: "見込み", icon: BarChart3,  color: "#3f3f46" },
    { label: "顧客数",      value: String(data?.kpis.customerCount ?? 0),          sub: "社",     icon: Users,      color: "#52525b" },
    { label: "進行案件",    value: String(data?.kpis.activeConstructions ?? 0),    sub: "件",     icon: Briefcase,  color: "#71717a" },
  ];

  const renderCard = (id: string) => {
    switch (id) {
      case "attendance":
        return !isVisible("attendance") ? null : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-slate-700">勤怠打刻</span>
              <Link href="/attendance"><ArrowUpRight className="h-3.5 w-3.5 text-slate-300 hover:text-slate-600 transition-colors" /></Link>
            </div>
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3">
              <div className="flex-1 min-h-0 w-full flex items-center justify-center">
                <ResponsiveClock />
              </div>
              <div className="flex flex-col items-center gap-1 shrink-0">
                <p className="text-xl font-black tabular-nums text-slate-900 leading-none">{format(now, "HH:mm")}</p>
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 transition-all ${clockedIn ? "bg-zinc-800" : "bg-slate-300"}`} />
                  <span className="text-[11px] text-slate-500">{clockedIn ? "勤務中" : "未出勤"}</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {clockInTime ? `出勤 ${format(clockInTime, "HH:mm")}〜` : format(now, "M月d日（EEE）", { locale: ja })}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 shrink-0">
              <button onClick={handleClockIn} disabled={clockedIn}
                className="h-9 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-white"
                style={{ background: clockedIn ? "#d4d4d8" : ACCENT }}>
                <LogIn className="h-3 w-3" />出勤
              </button>
              <button onClick={handleClockOut} disabled={!clockedIn}
                className="h-9 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200 text-slate-600 hover:bg-slate-50">
                <LogOut className="h-3 w-3" />退勤
              </button>
            </div>
          </div>
        );

      case "workflow":
        return !isVisible("workflow") ? null : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">ワークフロー</span>
              <Link href="/workflow"><ArrowUpRight className="h-3.5 w-3.5 text-slate-300 hover:text-slate-600 transition-colors" /></Link>
            </div>
            <div className="flex flex-col gap-2 flex-1">
              {[
                { label: "承認待ち", count: data?.workflow.pendingApprovals ?? 0,  color: "text-zinc-800" },
                { label: "申請中",   count: data?.workflow.submittedRequests ?? 0,  color: "text-zinc-600" },
                { label: "完了済み", count: data?.workflow.completedRequests ?? 0,  color: "text-zinc-700" },
              ].map((item, i) => (
                <Link key={i} href="/workflow" className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <span className="text-xs text-slate-500">{item.label}</span>
                  {loading ? <Skeleton className="h-5 w-6" /> : (
                    <span className={`text-lg font-black tabular-nums ${item.color}`}>{item.count}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        );

      case "ai-focus":
        return !isVisible("ai-focus") ? null : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-2 h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-zinc-600" />
                <span className="text-xs font-bold text-slate-700">今日のフォーカス</span>
                {!loading && todos.length > 0 && (
                  <span className="text-[10px] font-bold text-slate-400 tabular-nums">{todos.length}件</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {urgentCount > 0 && (
                  <span className="text-[9px] font-bold text-rose-500 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5">急ぎ{urgentCount}</span>
                )}
                <Link href="/bi"><ArrowUpRight className="h-3.5 w-3.5 text-slate-300 hover:text-slate-600 transition-colors" /></Link>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 px-2">
                  <Skeleton className="h-3 w-3 rounded shrink-0" /><Skeleton className="h-2.5 flex-1" />
                </div>
              )) : visibleTodos.length ? visibleTodos.map((todo) => {
                const isCompleted = todo.status === "completed";
                const isUrgent = todo.priority === "high" && !isCompleted;
                return (
                  <div key={todo.id} className={`flex items-center gap-2 py-1.5 px-2 rounded-lg group cursor-pointer transition-colors ${isUrgent ? "hover:bg-rose-50" : "hover:bg-slate-50"}`}>
                    <div className={`h-3.5 w-3.5 rounded shrink-0 border flex items-center justify-center transition-colors ${isCompleted ? "border-zinc-800 bg-zinc-800" : "border-slate-300 group-hover:border-zinc-600"}`}>
                      {isCompleted && <Check className="h-2 w-2 text-white" strokeWidth={3} />}
                    </div>
                    <span className={`text-sm flex-1 truncate ${isCompleted ? "line-through text-slate-300" : isUrgent ? "text-slate-800 font-semibold" : "text-slate-700"}`}>
                      {todo.title}
                    </span>
                    {isUrgent && <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />}
                  </div>
                );
              }) : (
                <div className="col-span-2 flex flex-col items-center gap-1 py-4">
                  <CheckCircle2 className="h-5 w-5 text-slate-300" />
                  <p className="text-[11px] text-slate-400">完了しました</p>
                </div>
              )}
            </div>
          </div>
        );

      case "mail":
        return !isVisible("mail") ? null : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">お知らせ</span>
                {!loading && data?.announcements && data.announcements.length > 0 && (
                  <span className="text-[10px] font-bold text-zinc-700 bg-zinc-100 rounded-full px-2 py-0.5 tabular-nums">{data.announcements.length}</span>
                )}
              </div>
              <Link href="/circulation"><ArrowUpRight className="h-3.5 w-3.5 text-slate-300 hover:text-slate-600 transition-colors" /></Link>
            </div>
            <div className="flex flex-col gap-2">
              {loading ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1.5 py-2 border-b border-slate-50 last:border-0">
                  <Skeleton className="h-3 w-3/4" /><Skeleton className="h-2.5 w-full" />
                </div>
              )) : data?.announcements.length ? data.announcements.map((ann) => (
                <Link key={ann.id} href={`/circulation/${ann.id}`}
                  className="group flex gap-3 py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 -mx-1 px-1 rounded-lg transition-colors">
                  <div className={`w-0.5 rounded-full shrink-0 self-stretch ${ann.is_urgent ? "bg-rose-400" : "bg-slate-200"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-800 line-clamp-1">{ann.title}</p>
                      <span className="text-[10px] text-slate-400 tabular-nums shrink-0">{format(new Date(ann.published_at), "M/d", { locale: ja })}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{ann.body}</p>
                  </div>
                </Link>
              )) : (
                <p className="text-xs text-slate-400 py-4 text-center">お知らせはありません</p>
              )}
            </div>
          </div>
        );

      case "customers":
        return !isVisible("customers") ? null : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">最近の顧客</span>
              <Link href="/crm"><ArrowUpRight className="h-3.5 w-3.5 text-slate-300 hover:text-slate-600 transition-colors" /></Link>
            </div>
            <div className="flex flex-col gap-1">
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1"><Skeleton className="h-3 w-24" /><Skeleton className="h-2.5 w-16" /></div>
                </div>
              )) : data?.recentCustomers.length ? data.recentCustomers.map((customer) => (
                <Link key={customer.id} href={`/crm/${customer.id}`}
                  className="flex items-center gap-3 py-2 hover:bg-slate-50 -mx-1 px-1 rounded-xl transition-colors group">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold bg-zinc-900">
                    {customer.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{customer.name}</p>
                    <p className="text-[11px] text-slate-400">{customer.company_name || "個人"}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 shrink-0">{customer.status}</span>
                </Link>
              )) : (
                <p className="text-xs text-slate-400 py-4">顧客データはありません</p>
              )}
            </div>
          </div>
        );

      case "trend":
        return !isVisible("trend") ? null : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">売上トレンド</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">直近7ヶ月 / 受注額・パイプライン（万円）</p>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm inline-block bg-zinc-900" />受注額</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm inline-block bg-zinc-300" />パイプライン</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={MONTHLY_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="10%" barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "#f8fafc" }}
                  contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}
                  formatter={(v: number) => [`¥${v}万`, undefined]}
                />
                <Bar dataKey="パイプライン" fill="#d4d4d8" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Bar dataKey="受注額" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case "constructions":
        return !isVisible("constructions") ? null : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">進行中の工事</span>
              <Link href="/constructions"><ArrowUpRight className="h-3.5 w-3.5 text-slate-300 hover:text-slate-600 transition-colors" /></Link>
            </div>
            <div className="flex flex-col gap-3">
              {loading ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between"><Skeleton className="h-3 w-32" /><Skeleton className="h-3 w-8" /></div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              )) : data?.constructions.length ? data.constructions.map((c) => (
                <Link key={c.id} href={`/constructions/${c.id}`}
                  className="group space-y-1.5 hover:bg-slate-50 -mx-1 px-1 py-1 rounded-lg transition-colors block">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <HardHat className="h-3 w-3 text-slate-400 shrink-0" />
                      <span className="text-xs font-medium text-slate-700 truncate">{c.title}</span>
                    </div>
                    <span className="text-xs font-bold tabular-nums shrink-0 text-zinc-800">{c.progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${c.progress}%`, background: `linear-gradient(90deg, #18181b, #52525b)` }} />
                  </div>
                </Link>
              )) : (
                <p className="text-xs text-slate-400 py-4">進行中の工事はありません</p>
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
    <div className="p-4 md:p-6 space-y-4 bg-slate-50 min-h-screen">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">ダッシュボード</h1>
          <p className="text-xs text-slate-500 mt-0.5">{format(now, "yyyy年M月d日（EEEE）", { locale: ja })}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          リアルタイム
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading ? Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-2">
            <Skeleton className="h-3 w-16" /><Skeleton className="h-7 w-24" />
          </div>
        )) : kpis.map((kpi, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col gap-1 group hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{kpi.label}</span>
              <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: kpi.color + "18" }}>
                <kpi.icon className="h-3.5 w-3.5" style={{ color: kpi.color }} />
              </div>
            </div>
            <p className="text-2xl font-black tabular-nums tracking-tight text-slate-900 leading-none">{kpi.value}</p>
            <p className="text-[11px] text-slate-400">{kpi.sub}</p>
          </div>
        ))}
      </div>

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
