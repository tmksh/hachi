"use client";

import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
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
  FileText,
  Receipt,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { clockIn as clockInAction, clockOut as clockOutAction } from "@/lib/actions/attendance";
import { ResponsiveClock } from "@/components/dashboard/responsive-clock";
import { SortableWidget } from "@/components/shared/sortable-widget";
import { AdaptiveList } from "@/components/shared/adaptive-list";
import { useWidgets } from "@/hooks/use-widgets";
import { useWidgetGridLayout } from "@/hooks/use-widget-grid-layout";
import { useDashboardData, useTodayAttendance } from "@/hooks/use-dashboard-data";
import type { DragEndEvent } from "@dnd-kit/core";

import { getCustomerAvatarColor } from "@/lib/customer-avatar-color";
import {
  BLUE,
  BLUE_CARD_SM,
  BLUE_HOVER,
  BLUE_TITLE,
  BLUE_MUTED,
  BLUE_KPI_ICON,
  BLUE_KPI_ICON_STYLE,
  BLUE_ACTIVE_GRADIENT,
  CHART_WON_LEGEND,
  CHART_PIPELINE_LEGEND,
} from "@/lib/blue-theme";

import { ResponsiveTrendChartBlue } from "@/components/dashboard/responsive-trend-chart-blue";

const WidgetGrid = dynamic(
  () => import("@/components/dashboard/widget-grid").then((m) => m.WidgetGrid),
  { loading: () => <div className="flex flex-wrap gap-4"><Skeleton className="h-48 w-full md:w-1/3 rounded-2xl" /></div> },
);

type DashboardData = NonNullable<ReturnType<typeof useDashboardData>["data"]>;

function formatYen(n: number) {
  if (n >= 100_000_000) return `¥${(n / 100_000_000).toFixed(1)}億`;
  if (n >= 10_000) return `¥${(n / 10_000).toFixed(0)}万`;
  return `¥${n.toLocaleString()}`;
}

const KPI_ICON_CLASS = BLUE_KPI_ICON;
const KPI_ICON_INNER = "h-3.5 w-3.5 text-white";

/** デザイン確認用モック（万円）— 全7ヶ月に棒を表示 */
const MOCK_TREND_VALUES = [
  { 受注額: 2800, パイプライン: 1800 },
  { 受注額: 3400, パイプライン: 2600 },
  { 受注額: 2200, パイプライン: 3100 },
  { 受注額: 4100, パイプライン: 2900 },
  { 受注額: 3600, パイプライン: 3800 },
  { 受注額: 4800, パイプライン: 3200 },
  { 受注額: 5200, パイプライン: 4100 },
];

function getTrendChartData(trend: DashboardData["monthlyTrend"] | undefined) {
  return (trend ?? []).map((row, i) => ({
    month: row.month,
    ...(MOCK_TREND_VALUES[i] ?? { 受注額: 3000, パイプライン: 2500 }),
  }));
}


export default function Dashboard2Page() {
  const [clockedIn, setClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const { data, isLoading: loading } = useDashboardData();
  const { data: attendanceEntry } = useTodayAttendance();
  const now = new Date();

  const { widgets, hydrated, reorder, resizeWidget, setWidgetWidth, initWidths } = useWidgets();

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) reorder(String(active.id), String(over.id));
  }, [reorder]);

  useEffect(() => {
    if (attendanceEntry?.clock_in_at) {
      setClockedIn(!attendanceEntry.clock_out_at);
      setClockInTime(new Date(attendanceEntry.clock_in_at));
    }
  }, [attendanceEntry]);

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
    { label: "受注額",      value: formatYen(data?.kpis.wonValue ?? 0),          sub: "今月",   icon: TrendingUp },
    { label: "パイプライン", value: formatYen(data?.kpis.pipelineValue ?? 0),     sub: "見込み", icon: BarChart3 },
    { label: "顧客数",      value: String(data?.kpis.customerCount ?? 0),          sub: "社",     icon: Users },
    { label: "進行案件",    value: String(data?.kpis.activeConstructions ?? 0),    sub: "件",     icon: Briefcase },
  ];

  const renderCard = (id: string) => {
    switch (id) {
      case "attendance":
        return !isVisible("attendance") ? null : (
          <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 shrink-0">
              <span className={`text-xs font-bold ${BLUE_TITLE}`}>勤怠打刻</span>
              <Link href="/attendance"><ArrowUpRight className="h-3.5 w-3.5 text-slate-300 hover:text-[#2B6EA8] transition-colors" /></Link>
            </div>
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3">
              <div className="flex-1 min-h-0 w-full flex items-center justify-center">
                <ResponsiveClock />
              </div>
              <div className="flex flex-col items-center gap-1 shrink-0">
                <p className="text-xl font-black tabular-nums leading-none text-slate-900">{format(now, "HH:mm")}</p>
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 transition-all ${clockedIn ? "bg-emerald-500" : "bg-slate-300"}`} />
                  <span className="text-[11px] text-slate-700">{clockedIn ? "勤務中" : "未出勤"}</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {clockInTime ? `出勤 ${format(clockInTime, "HH:mm")}〜` : format(now, "M月d日（EEE）", { locale: ja })}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 shrink-0">
              <button
                onClick={handleClockIn}
                disabled={clockedIn}
                className="h-9 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all disabled:opacity-60 disabled:cursor-not-allowed text-white shadow-sm disabled:shadow-none"
                style={{ background: clockedIn ? undefined : BLUE_ACTIVE_GRADIENT }}
              >
                <LogIn className="h-3 w-3" />出勤
              </button>
              <button onClick={handleClockOut} disabled={!clockedIn}
                className={`h-9 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all disabled:opacity-60 disabled:cursor-not-allowed border ${BLUE_MUTED} ${BLUE_HOVER} disabled:opacity-40`}
                style={{ background: BLUE[50], borderColor: BLUE[100], color: BLUE[700] }}>
                <LogOut className="h-3 w-3" />退勤
              </button>
            </div>
          </div>
        );

      case "workflow":
        return !isVisible("workflow") ? null : (
          <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 shrink-0">
              <span className={`text-xs font-bold ${BLUE_TITLE}`}>ワークフロー</span>
              <Link href="/workflow"><ArrowUpRight className="h-3.5 w-3.5 text-slate-300 hover:text-[#2B6EA8] transition-colors" /></Link>
            </div>
            <div className="flex flex-col gap-2 flex-1">
              {[
                { label: "承認待ち", count: data?.workflow.pendingApprovals ?? 0,  color: "text-slate-800" },
                { label: "申請中",   count: data?.workflow.submittedRequests ?? 0,  color: "text-slate-600" },
                { label: "完了済み", count: data?.workflow.completedRequests ?? 0,  color: "text-slate-700" },
              ].map((item, i) => (
                <Link key={i} href="/workflow" className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#A3DAF6]/50 transition-colors">
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
          <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-slate-400" />
                <span className={`text-xs font-bold ${BLUE_TITLE}`}>今日のフォーカス</span>
                {!loading && todos.length > 0 && (
                  <span className="text-[10px] font-bold text-slate-400 tabular-nums">{todos.length}件</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {urgentCount > 0 && (
                  <span className="text-[9px] font-bold text-rose-500 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5">急ぎ{urgentCount}</span>
                )}
                <Link href="/bi"><ArrowUpRight className="h-3.5 w-3.5 text-slate-300 hover:text-[#2B6EA8] transition-colors" /></Link>
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
                  <div key={todo.id} className={`flex items-center gap-2 py-1.5 px-2 rounded-lg group cursor-pointer transition-colors ${isUrgent ? "hover:bg-rose-50" : "hover:bg-[#A3DAF6]/50"}`}>
                    <div className={`h-3.5 w-3.5 rounded shrink-0 border flex items-center justify-center transition-colors ${isCompleted ? "border-slate-300 bg-slate-100" : "border-slate-200 group-hover:border-slate-300"}`}>
                      {isCompleted && <Check className="h-2 w-2 text-slate-500" strokeWidth={3} />}
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
          <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3 h-full min-h-0">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${BLUE_TITLE}`}>お知らせ</span>
                {!loading && data?.announcements && data.announcements.length > 0 && (
                  <span className="text-[10px] font-bold text-slate-600 bg-white border border-slate-100 rounded-full px-2 py-0.5 tabular-nums shadow-sm">{data.announcements.length}</span>
                )}
              </div>
              <Link href="/circulation"><ArrowUpRight className="h-3.5 w-3.5 text-slate-300 hover:text-[#2B6EA8] transition-colors" /></Link>
            </div>
            {loading ? (
              <div className="flex flex-col gap-2 flex-1 min-h-0">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-1.5 py-2 border-b border-slate-50 last:border-0">
                    <Skeleton className="h-3 w-3/4" /><Skeleton className="h-2.5 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <AdaptiveList
                items={data?.announcements ?? []}
                itemHeightPx={68}
                max={15}
                className="gap-2"
                empty={<p className="text-xs text-slate-400 py-4 text-center">お知らせはありません</p>}
              >
                {(ann) => (
                <Link key={ann.id} href={`/circulation/${ann.id}`}
                  className="group flex gap-3 py-2 border-b border-slate-50 last:border-0 hover:bg-[#A3DAF6]/50 -mx-1 px-1 rounded-lg transition-colors shrink-0">
                  <div className={`w-0.5 rounded-full shrink-0 self-stretch ${ann.is_urgent ? "bg-rose-400" : "bg-slate-200"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-800 line-clamp-1">{ann.title}</p>
                      <span className="text-[10px] text-slate-400 tabular-nums shrink-0">{format(new Date(ann.published_at), "M/d", { locale: ja })}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{ann.body}</p>
                  </div>
                </Link>
              )}
              </AdaptiveList>
            )}
          </div>
        );

      case "customers":
        return !isVisible("customers") ? null : (
          <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3 h-full min-h-0">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 shrink-0">
              <span className={`text-xs font-bold ${BLUE_TITLE}`}>最近の顧客</span>
              <Link href="/crm"><ArrowUpRight className="h-3.5 w-3.5 text-slate-300 hover:text-[#2B6EA8] transition-colors" /></Link>
            </div>
            {loading ? (
              <div className="flex flex-col gap-1 flex-1 min-h-0">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1"><Skeleton className="h-3 w-24" /><Skeleton className="h-2.5 w-16" /></div>
                  </div>
                ))}
              </div>
            ) : (
              <AdaptiveList
                items={data?.recentCustomers ?? []}
                itemHeightPx={52}
                max={15}
                empty={<p className="text-xs text-slate-400 py-4">顧客データはありません</p>}
              >
                {(customer) => {
                const avatar = getCustomerAvatarColor(customer.id);
                return (
                <Link key={customer.id} href={`/crm/${customer.id}`}
                  className="flex items-center gap-3 py-2 hover:bg-[#A3DAF6]/50 -mx-1 px-1 rounded-xl transition-colors group shrink-0">
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold shadow-sm"
                    style={{ background: avatar.avatarGradient }}
                  >
                    {customer.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{customer.name}</p>
                    <p className="text-[11px] text-slate-400">{customer.company_name || "個人"}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 shrink-0">{customer.status}</span>
                </Link>
              );}}
              </AdaptiveList>
            )}
          </div>
        );

      case "trend":
        return !isVisible("trend") ? null : (
          <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3 h-full min-h-0">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-xs font-bold ${BLUE_TITLE}`}>売上トレンド</span>
                <span className={`text-[11px] ${BLUE_MUTED} opacity-70 hidden sm:inline truncate`}>直近7ヶ月 / 万円</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 text-[11px] ${BLUE_MUTED}`}>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm inline-block" style={{ background: CHART_WON_LEGEND }} />受注額</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm inline-block" style={{ background: CHART_PIPELINE_LEGEND }} />パイプライン</span>
                </div>
              </div>
            </div>
            {loading ? (
              <Skeleton className="flex-1 min-h-[180px] w-full" />
            ) : (
              <ResponsiveTrendChartBlue data={getTrendChartData(data?.monthlyTrend)} />
            )}
          </div>
        );

      case "deals":
        return !isVisible("deals") ? null : (
          <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3 h-full min-h-0">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 shrink-0">
              <span className={`text-xs font-bold ${BLUE_TITLE}`}>商談パイプライン</span>
              <Link href="/deals"><ArrowUpRight className="h-3.5 w-3.5 text-slate-300 hover:text-[#2B6EA8] transition-colors" /></Link>
            </div>
            {loading ? (
              <div className="flex flex-col gap-1 flex-1 min-h-0">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="py-2 space-y-1.5">
                    <Skeleton className="h-3 w-32" /><Skeleton className="h-3 w-20" />
                  </div>
                ))}
              </div>
            ) : (
              <AdaptiveList
                items={data?.recentDeals ?? []}
                itemHeightPx={56}
                max={20}
                empty={<p className="text-xs text-slate-400 py-4">進行中の商談はありません</p>}
              >
                {(deal) => {
                const colorSeed = deal.customerId ?? deal.customerName;
                const avatar = getCustomerAvatarColor(colorSeed);
                const initial = deal.customerName !== "—" ? deal.customerName.charAt(0) : deal.title.charAt(0);
                return (
                <Link key={deal.id} href="/deals"
                  className="flex items-center justify-between gap-2 py-2 px-1 rounded-xl hover:bg-[#A3DAF6]/50 transition-colors shrink-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-bold shadow-sm"
                      style={{ background: avatar.avatarGradient }}
                    >
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">{deal.title}</p>
                      <p className="text-[11px] text-slate-400 truncate">{deal.customerName}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold tabular-nums text-slate-900">{formatYen(deal.value ?? 0)}</p>
                    <span
                      className="text-[10px] font-medium rounded-full px-2 py-0.5 mt-0.5 inline-block"
                      style={{ background: avatar.track, color: avatar.progress }}
                    >
                      {deal.stageLabel}
                    </span>
                  </div>
                </Link>
              );}}
              </AdaptiveList>
            )}
          </div>
        );

      case "quotes":
        return !isVisible("quotes") ? null : (
          <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3 h-full min-h-0">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 shrink-0">
              <span className={`text-xs font-bold ${BLUE_TITLE}`}>最近の見積</span>
              <Link href="/quotes"><ArrowUpRight className="h-3.5 w-3.5 text-slate-300 hover:text-[#2B6EA8] transition-colors" /></Link>
            </div>
            {loading ? (
              <div className="flex flex-col gap-1 flex-1 min-h-0">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="py-2 space-y-1.5">
                    <Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            ) : (
              <AdaptiveList
                items={data?.recentEstimates ?? []}
                itemHeightPx={52}
                max={15}
                empty={<p className="text-xs text-slate-400 py-4">見積データはありません</p>}
              >
                {(est) => (
                <Link key={est.id} href={`/quotes/${est.id}`}
                  className="flex items-center justify-between gap-2 py-2 px-1 rounded-xl hover:bg-[#A3DAF6]/50 transition-colors shrink-0">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{est.estimateNo}</p>
                    <p className="text-[11px] text-slate-400 truncate">{est.title}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold tabular-nums text-slate-900">{formatYen(est.total ?? 0)}</p>
                    <span className="text-[10px] text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 mt-0.5 inline-block">{est.statusLabel}</span>
                  </div>
                </Link>
              )}
              </AdaptiveList>
            )}
          </div>
        );

      case "production":
        return !isVisible("production") ? null : (
          <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 shrink-0">
              <span className={`text-xs font-bold ${BLUE_TITLE}`}>生産サマリー</span>
              <Link href="/contracts"><ArrowUpRight className="h-3.5 w-3.5 text-slate-300 hover:text-[#2B6EA8] transition-colors" /></Link>
            </div>
            <div className="flex flex-col gap-1">
              {[
                {
                  label: "契約",
                  href: "/contracts",
                  icon: ClipboardList,
                  count: data?.productionSummary.contractCount ?? 0,
                  sub: `進行中 ${data?.productionSummary.activeContracts ?? 0}件`,
                },
                {
                  label: "請求（下書き）",
                  href: "/invoices",
                  icon: FileText,
                  count: data?.productionSummary.invoiceDraft ?? 0,
                  sub: "要発行",
                },
                {
                  label: "請求（未入金）",
                  href: "/invoices",
                  icon: Receipt,
                  count: data?.productionSummary.invoiceSent ?? 0,
                  sub: formatYen(data?.productionSummary.invoiceUnpaidTotal ?? 0),
                },
                {
                  label: "工事",
                  href: "/constructions",
                  icon: HardHat,
                  count: data?.kpis.activeConstructions ?? 0,
                  sub: "進行中",
                },
              ].map((item) => (
                <Link key={item.label} href={item.href}
                  className="flex items-center justify-between py-2 px-1 rounded-xl hover:bg-[#A3DAF6]/50 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <item.icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{item.label}</p>
                      <p className="text-[11px] text-slate-400">{item.sub}</p>
                    </div>
                  </div>
                  {loading ? (
                    <Skeleton className="h-5 w-8" />
                  ) : (
                    <span className="text-xs font-bold tabular-nums text-slate-800 bg-white border border-slate-100 rounded-full px-2 py-0.5 shrink-0 shadow-sm">{item.count}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        );

      case "constructions":
        return !isVisible("constructions") ? null : (
          <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 shrink-0">
              <span className={`text-xs font-bold ${BLUE_TITLE}`}>進行中の工事</span>
              <Link href="/constructions"><ArrowUpRight className="h-3.5 w-3.5 text-slate-300 hover:text-[#2B6EA8] transition-colors" /></Link>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(100px,1fr))] gap-x-2 gap-y-1 flex-1 min-h-0 overflow-y-auto content-start">
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-1 w-full">
                  <Skeleton className="h-14 w-full max-w-[160px] rounded-t-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              )) : data?.constructions.length ? data.constructions.map((c, idx) => {
                const customer = c.customer as { id?: string; name?: string } | null;
                const colorSeed = customer?.id ?? customer?.name ?? c.title;
                const avatar = getCustomerAvatarColor(colorSeed);
                const MOCK_PROGRESS = [72, 35, 18, 55, 91];
                const rawProgress = c.progress > 0 ? c.progress : MOCK_PROGRESS[idx % MOCK_PROGRESS.length];
                const progress = Math.min(100, Math.max(0, rawProgress));
                const gradId = `gauge-grad-b-${c.id}`;
                const radius = 38;
                const circumference = Math.PI * radius;
                const dashOffset = circumference * (1 - progress / 100);
                return (
                  <Link
                    key={c.id}
                    href={`/constructions/${c.id}`}
                    className="group @container flex flex-col items-center w-full transition-transform hover:-translate-y-0.5"
                  >
                    <div className="relative w-full" style={{ aspectRatio: "2 / 1.05" }}>
                      <svg viewBox="0 0 100 56" className="w-full h-full block" preserveAspectRatio="xMidYMax meet">
                        <defs>
                          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor={avatar.start} />
                            <stop offset="100%" stopColor={avatar.end} />
                          </linearGradient>
                        </defs>
                        <path
                          d={`M 12 50 A ${radius} ${radius} 0 0 1 88 50`}
                          fill="none"
                          stroke="#EEF2F4"
                          strokeWidth="11"
                          strokeLinecap="round"
                        />
                        <path
                          d={`M 12 50 A ${radius} ${radius} 0 0 1 88 50`}
                          fill="none"
                          stroke={`url(#${gradId})`}
                          strokeWidth="11"
                          strokeLinecap="round"
                          strokeDasharray={circumference}
                          strokeDashoffset={dashOffset}
                          style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
                        />
                        <text
                          x="50"
                          y="47"
                          textAnchor="middle"
                          fill={avatar.end}
                          fontSize="18"
                          fontWeight="700"
                          className="tabular-nums"
                        >
                          {progress}
                          <tspan fontSize="11" fontWeight="700">%</tspan>
                        </text>
                      </svg>
                    </div>
                    <span className="w-full text-center font-medium text-slate-600 truncate mt-1 px-0.5 text-[clamp(0.875rem,9cqi,1.25rem)] leading-snug">
                      {customer?.name ?? c.title}
                    </span>
                  </Link>
                );
              }) : (
                <p className="text-xs text-slate-400 py-4 col-span-full text-center">進行中の工事はありません</p>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const sortableIds = widgets.filter((w) => w.id !== "kpi" && w.visible).map((w) => w.id);
  const layoutWidgets = useMemo(
    () =>
      sortableIds.map((id) => {
        const w = widgets.find((x) => x.id === id);
        return { id, widthPx: w?.widthPx };
      }),
    [sortableIds, widgets],
  );
  const { gridRef, displayWidths, stackFullWidth } = useWidgetGridLayout(layoutWidgets);

  return (
    <div className="p-4 md:p-6 space-y-4 min-h-screen">

      {/* Header */}
      <div>
        <h1 className={`text-lg font-bold tracking-tight ${BLUE_TITLE}`}>ダッシュボード</h1>
        <p className={`text-xs mt-0.5 ${BLUE_MUTED}`}>{format(now, "yyyy年M月d日（EEEE）", { locale: ja })}</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {loading ? Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={BLUE_CARD_SM + " px-3 py-2.5"}>
            <Skeleton className="h-6 w-full" />
          </div>
        )) : kpis.map((kpi, i) => (
          <div key={i} className={BLUE_CARD_SM + " px-3 py-2.5 flex items-center gap-2.5 flex-nowrap min-w-0 group hover:shadow-md transition-shadow"}>
            <div className={KPI_ICON_CLASS} style={BLUE_KPI_ICON_STYLE}>
              <kpi.icon className={KPI_ICON_INNER} />
            </div>
            <span className="text-xs font-semibold truncate min-w-0 text-slate-600">{kpi.label}</span>
            <p className="text-xl font-black tabular-nums tracking-tight leading-none ml-auto whitespace-nowrap shrink-0 text-slate-900">{kpi.value}</p>
            <span className="text-xs shrink-0 whitespace-nowrap text-slate-500">{kpi.sub}</span>
          </div>
        ))}
      </div>

      {/* Sortable widget grid */}
      <WidgetGrid sortableIds={sortableIds} onDragEnd={handleDragEnd} gridRef={gridRef}>
            {sortableIds.map((id) => {
              const card = renderCard(id);
              if (!card) return null;
              const wc = widgets.find((w) => w.id === id);
              return (
                <SortableWidget
                  key={id}
                  id={id}
                  widthPx={wc?.widthPx}
                  layoutWidthPx={displayWidths[id]}
                  stackFullWidth={stackFullWidth}
                  height={wc?.height}
                  onResize={resizeWidget}
                  onResizeWidth={setWidgetWidth}
                  onInitWidths={initWidths}
                >
                  {card}
                </SortableWidget>
              );
            })}
      </WidgetGrid>

    </div>
  );
}
