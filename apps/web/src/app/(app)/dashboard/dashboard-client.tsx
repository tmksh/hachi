"use client";

import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useState, useEffect, useCallback, useRef } from "react";
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
  Settings2,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  MessageSquare,
  Clock,
  ClipboardCheck,
  AlertCircle,
  Send,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { toast } from "sonner";
import { useUnfollowedLeads } from "@/hooks/use-unfollowed-leads";
import type { UnfollowedLead } from "@/lib/queries/dashboard";
import { sendFollowupInquiry } from "@/lib/actions/internal-messages";
import { clockIn as clockInAction, clockOut as clockOutAction } from "@/lib/actions/attendance";
import { ResponsiveClock } from "@/components/dashboard/responsive-clock";
import { KpiRow } from "@/components/shared/kpi-row";
import { SortableWidget } from "@/components/shared/sortable-widget";
import { ListWidgetCard } from "@/components/shared/adaptive-list";
import { useWidgets } from "@/hooks/use-widgets";
import { useWidgetGridLayout } from "@/hooks/use-widget-grid-layout";
import { useBrandColor } from "@/hooks/use-brand-color";
import { useInternalChat } from "@/contexts/chat-panel-context";
import { useQueryClient } from "@tanstack/react-query";
import { useDashboardData, useTodayAttendance } from "@/hooks/use-dashboard-data";
import type { DashboardData } from "@/lib/queries/dashboard";
import type { AttendanceEntry } from "@/lib/database.types";
import type { DragEndEvent } from "@dnd-kit/core";

import { getCustomerAvatarColor } from "@/lib/customer-avatar-color";
import { computeBrandFromHex } from "@/lib/brand-color";
import { cn } from "@/lib/utils";
import { BombAlert } from "@/components/layout/bomb-alert";

import { ResponsiveTrendChart } from "@/components/dashboard/responsive-trend-chart";

const WidgetGrid = dynamic(
  () => import("@/components/dashboard/widget-grid").then((m) => m.WidgetGrid),
  { loading: () => <div className="flex flex-wrap gap-4 min-w-0 w-full"><Skeleton className="h-48 w-full md:w-[calc(33%-11px)] rounded-2xl" /><Skeleton className="h-48 w-full md:w-[calc(33%-11px)] rounded-2xl" /><Skeleton className="h-48 w-full md:w-[calc(33%-11px)] rounded-2xl" /></div> },
);


function formatYen(n: number) {
  if (n >= 100_000_000) return `¥${(n / 100_000_000).toFixed(1)}億`;
  if (n >= 10_000) return `¥${(n / 10_000).toFixed(0)}万`;
  return `¥${n.toLocaleString()}`;
}

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


type DashboardClientProps = {
  initialData?: DashboardData;
  initialAttendance?: AttendanceEntry | null;
  initialUnfollowedLeads?: UnfollowedLead[];
};

export function DashboardClient({
  initialData,
  initialAttendance,
  initialUnfollowedLeads,
}: DashboardClientProps) {
  const [showBombPreview, setShowBombPreview] = useState(false);
  const [clockedIn, setClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const [clockOutTime, setClockOutTime] = useState<Date | null>(null);
  const queryClient = useQueryClient();
  const { data, isLoading: loading } = useDashboardData(initialData);
  const { data: attendanceEntry } = useTodayAttendance(initialAttendance);
  const { data: unfollowedData, isLoading: unfollowedLoading } = useUnfollowedLeads(7, initialUnfollowedLeads);
  const unfollowedLeads = unfollowedData ?? [];
  const [inquiryTarget, setInquiryTarget] = useState<UnfollowedLead | null>(null);
  const [inquiryContent, setInquiryContent] = useState("");
  const [inquirySending, setInquirySending] = useState(false);
  const [dealsTab, setDealsTab] = useState<"deals" | "unfollowed">("deals");
  const [focusHighlight, setFocusHighlight] = useState(false);
  const pendingFocusScroll = useRef(false);
  const now = new Date();

  const { widgets, hydrated, reorder, resizeWidget, toggleVisible, reset } = useWidgets();
  const { gradientHex, solidHex, mode: brandMode, setGradientColor, setSolidColor, switchMode, reset: resetColor } = useBrandColor();
  const { openInternalChat, refreshInternalChat } = useInternalChat();
  const brandHex = brandMode === "solid" ? solidHex : gradientHex;
  const brandColors = computeBrandFromHex(brandHex);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) reorder(String(active.id), String(over.id));
  }, [reorder]);

  useEffect(() => {
    if (attendanceEntry?.clock_in_at) {
      setClockedIn(!attendanceEntry.clock_out_at);
      setClockInTime(new Date(attendanceEntry.clock_in_at));
      setClockOutTime(attendanceEntry.clock_out_at ? new Date(attendanceEntry.clock_out_at) : null);
    }
  }, [attendanceEntry]);

  const handleClockIn = async () => {
    try {
      await clockInAction();
      const now = new Date();
      setClockedIn(true);
      setClockInTime(now);
      setClockOutTime(null);
      await queryClient.invalidateQueries({ queryKey: ["today-attendance"] });
      toast.success("出勤しました", { description: format(now, "HH:mm", { locale: ja }) });
    } catch { toast.error("出勤打刻に失敗しました"); }
  };
  const handleClockOut = async () => {
    try {
      await clockOutAction();
      const now = new Date();
      setClockedIn(false);
      setClockOutTime(now);
      await queryClient.invalidateQueries({ queryKey: ["today-attendance"] });
      toast.success("退勤しました", { description: format(now, "HH:mm", { locale: ja }) });
    } catch { toast.error("退勤打刻に失敗しました"); }
  };

  const handleSendInquiry = async () => {
    if (!inquiryTarget || !inquiryContent.trim()) return;
    if (!inquiryTarget.assigned_to) return;
    setInquirySending(true);
    try {
      await sendFollowupInquiry(
        inquiryTarget.assigned_to,
        inquiryTarget.id,
        inquiryContent.trim(),
      );
      toast.success("問い合わせを送信しました", {
        description: `${inquiryTarget.assigned_to_profile?.display_name ?? "担当者"} に送信しました`,
      });
      refreshInternalChat();
      openInternalChat();
      setInquiryTarget(null);
      setInquiryContent("");
    } catch {
      toast.error("送信に失敗しました");
    } finally {
      setInquirySending(false);
    }
  };

  const isVisible = (id: string) =>
    !hydrated || (widgets.find((w) => w.id === id)?.visible ?? true);

  const todos = data?.todos ?? [];
  const visibleTodos = todos.slice(0, 5);
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const isUrgentTodo = (t: (typeof todos)[number]) =>
    t.status !== "completed" && (
      t.priority === "high" ||
      (typeof t.due_date === "string" && t.due_date.slice(0, 10) <= todayKey)
    );
  const urgentCount = todos.filter(isUrgentTodo).length;

  const scrollToTodaysFocus = useCallback(() => {
    const el = document.getElementById("todays-focus");
    if (!(el instanceof HTMLElement)) return false;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
    return true;
  }, []);

  const goToTodaysFocus = useCallback(() => {
    setFocusHighlight(true);
    if (scrollToTodaysFocus()) return;
    if (!isVisible("ai-focus")) {
      pendingFocusScroll.current = true;
      toggleVisible("ai-focus");
    }
  }, [isVisible, scrollToTodaysFocus, toggleVisible]);

  useEffect(() => {
    if (!pendingFocusScroll.current) return;
    if (!isVisible("ai-focus")) return;
    pendingFocusScroll.current = false;
    requestAnimationFrame(() => {
      scrollToTodaysFocus();
    });
  }, [isVisible, scrollToTodaysFocus, widgets]);

  useEffect(() => {
    if (!focusHighlight) return;
    const t = window.setTimeout(() => setFocusHighlight(false), 1800);
    return () => window.clearTimeout(t);
  }, [focusHighlight]);

  const kpis = [
    { id: "kpi-won",           label: "受注額",      value: formatYen(data?.kpis.wonValue ?? 0),                              sub: "今月",   icon: TrendingUp },
    { id: "kpi-pipeline",      label: "パイプライン", value: formatYen(data?.kpis.pipelineValue ?? 0),                        sub: "見込み", icon: BarChart3 },
    { id: "kpi-customers",     label: "顧客数",      value: String(data?.kpis.customerCount ?? 0),                            sub: "社",     icon: Users },
    { id: "kpi-constructions", label: "進行案件",     value: String(data?.kpis.activeConstructions ?? 0),                     sub: "件",     icon: Briefcase },
    { id: "kpi-deals",         label: "商談数",      value: String(data?.kpis.dealCount ?? 0),                                sub: "件",     icon: MessageSquare },
    { id: "kpi-unpaid",        label: "未入金",      value: formatYen(data?.productionSummary.invoiceUnpaidTotal ?? 0),       sub: "請求中", icon: Receipt },
    { id: "kpi-approvals",     label: "承認待ち",    value: String(data?.workflow.pendingApprovals ?? 0),                     sub: "件",     icon: Clock },
    { id: "kpi-contracts",     label: "進行中契約",  value: String(data?.productionSummary.activeContracts ?? 0),             sub: "件",     icon: ClipboardCheck },
  ];

  // No.56: KPI指標をユーザー設定（useWidgets の order）に従って並び替え
  const kpiWidgets = widgets.filter((w) => w.id.startsWith("kpi-"));
  const kpiOrderMap = new Map(kpiWidgets.map((w, i) => [w.id, i]));
  const orderedKpis = [...kpis].sort(
    (a, b) => (kpiOrderMap.get(a.id) ?? 99) - (kpiOrderMap.get(b.id) ?? 99),
  );
  /** KPI同士でのみ順序を入れ替える（間にある他ウィジェットの順序は保つ） */
  const moveKpi = (id: string, dir: -1 | 1) => {
    const idx = kpiWidgets.findIndex((w) => w.id === id);
    const neighbor = kpiWidgets[idx + dir];
    if (idx !== -1 && neighbor) reorder(id, neighbor.id);
  };

  const renderCard = (id: string) => {
    switch (id) {
      case "attendance":
        return !isVisible("attendance") ? null : (
          <div
            className="rounded-2xl shadow-sm p-4 flex flex-col gap-3 h-full overflow-hidden"
            style={{ background: "var(--brand-gradient)" }}
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-white/20 shrink-0">
              <span className="text-xs font-bold text-white">勤怠打刻</span>
              <Link href="/attendance"><ArrowUpRight className="h-3.5 w-3.5 text-white/50 hover:text-white transition-colors" /></Link>
            </div>
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3">
              <div className="flex-1 min-h-0 w-full flex items-center justify-center">
                <ResponsiveClock flat />
              </div>
              <div className="flex flex-col items-center gap-1 shrink-0">
                <p className="text-xl font-black tabular-nums leading-none text-white">{format(now, "HH:mm")}</p>
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 transition-all ${clockedIn ? "bg-white" : clockOutTime ? "bg-white/70" : "bg-white/50"}`} />
                  <span className="text-[11px] text-white/90">{clockedIn ? "勤務中" : clockOutTime ? "退勤済" : "未出勤"}</span>
                </div>
                <p className="text-[11px] text-white/70">
                  {clockInTime && clockOutTime
                    ? `出勤 ${format(clockInTime, "HH:mm")}〜退勤 ${format(clockOutTime, "HH:mm")}`
                    : clockInTime
                    ? `出勤 ${format(clockInTime, "HH:mm")}〜`
                    : format(now, "M月d日（EEE）", { locale: ja })}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 shrink-0">
              <button
                onClick={handleClockIn}
                disabled={clockedIn || !!clockOutTime}
                className={`h-9 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all disabled:cursor-not-allowed ${
                  clockedIn || clockOutTime
                    ? "bg-white/15 text-white/50"
                    : "bg-white text-[#0F5132] shadow-sm hover:bg-white/95"
                }`}
              >
                <LogIn className="h-3 w-3" />出勤
              </button>
              <button
                onClick={handleClockOut}
                disabled={!clockedIn}
                className={`h-9 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all border disabled:cursor-not-allowed ${
                  clockedIn
                    ? "border-white/60 bg-white/10 text-white hover:bg-white/20"
                    : "border-white/25 bg-transparent text-white/40"
                }`}
              >
                <LogOut className="h-3 w-3" />退勤
              </button>
            </div>
          </div>
        );

      case "workflow":
        return !isVisible("workflow") ? null : (
          <div className="bg-white rounded-2xl shadow-sm p-3 flex flex-col gap-2 h-full">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
              <span className={`text-xs font-bold text-slate-800`}>ワークフロー</span>
              <Link href="/workflow"><ArrowUpRight className="h-3.5 w-3.5 text-slate-300 hover:text-primary transition-colors" /></Link>
            </div>
            <div className="flex flex-col gap-2 flex-1">
              {[
                { label: "承認待ち", count: data?.workflow.pendingApprovals ?? 0,  color: "text-slate-800" },
                { label: "申請中",   count: data?.workflow.submittedRequests ?? 0,  color: "text-slate-600" },
                { label: "完了済み", count: data?.workflow.completedRequests ?? 0,  color: "text-slate-700" },
              ].map((item, i) => (
                <Link key={i} href="/workflow" className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#D8EDE4]/50 transition-colors">
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
          <div
            id="todays-focus"
            tabIndex={-1}
            className={cn(
              "bg-white rounded-2xl shadow-sm p-3 flex flex-col gap-2 h-full outline-none scroll-mt-4 transition-shadow",
              focusHighlight && "ring-2 ring-rose-400 ring-offset-2",
            )}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-slate-400" />
                <span className={`text-xs font-bold text-slate-800`}>今日のフォーカス</span>
                {!loading && todos.length > 0 && (
                  <span className="text-[10px] font-bold text-slate-400 tabular-nums">{todos.length}件</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {urgentCount > 0 && (
                  <span className="text-[9px] font-bold text-rose-500 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5">急ぎ{urgentCount}</span>
                )}
                <Link href="/bi"><ArrowUpRight className="h-3.5 w-3.5 text-slate-300 hover:text-primary transition-colors" /></Link>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 px-2">
                  <Skeleton className="h-3 w-3 rounded shrink-0" /><Skeleton className="h-2.5 flex-1" />
                </div>
              )) : visibleTodos.length ? visibleTodos.map((todo) => {
                const isCompleted = todo.status === "completed";
                const isUrgent = isUrgentTodo(todo);
                return (
                  <div key={todo.id} className={`flex items-center gap-2 py-1.5 px-2 rounded-lg group cursor-pointer transition-colors ${isUrgent ? "hover:bg-rose-50" : "hover:bg-[#D8EDE4]/50"}`}>
                    <div className={`h-3.5 w-3.5 rounded shrink-0 border flex items-center justify-center transition-colors ${isCompleted ? "border-slate-300 bg-slate-100" : "border-slate-200 group-hover:border-slate-300"}`}>
                      {isCompleted && <Check className="h-2 w-2 text-slate-500" strokeWidth={3} />}
                    </div>
                    <span className={`text-sm flex-1 truncate ${isCompleted ? "line-through text-slate-300" : isUrgent ? "text-slate-800 font-semibold" : "text-slate-700"}`}>
                      {todo.title}
                    </span>
                    {isUrgent && (
                      <span className="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded px-1 py-0.5 shrink-0">
                        優先
                      </span>
                    )}
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
          <ListWidgetCard
            itemHeightPx={60}
            items={data?.announcements ?? []}
            loading={loading}
            listClassName="gap-2"
            loadingSkeleton={
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-1.5 py-2 border-b border-slate-50 last:border-0">
                    <Skeleton className="h-3 w-3/4" /><Skeleton className="h-2.5 w-full" />
                  </div>
                ))}
              </div>
            }
            empty={<p className="text-xs text-slate-400 py-4 text-center">お知らせはありません</p>}
            header={(
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">お知らせ</span>
                  {!loading && data?.announcements && data.announcements.length > 0 && (
                    <span className="text-[10px] font-bold text-slate-600 bg-white border border-slate-100 rounded-full px-2 py-0.5 tabular-nums shadow-sm">{data.announcements.length}</span>
                  )}
                </div>
                <Link href="/circulation"><ArrowUpRight className="h-3.5 w-3.5 text-slate-300 hover:text-primary transition-colors" /></Link>
              </div>
            )}
          >
            {(ann) => (
              <Link key={ann.id} href={`/circulation/${ann.id}`}
                className="group flex gap-2 py-1.5 border-b border-slate-50 last:border-0 hover:bg-[#D8EDE4]/50 -mx-1 px-1 rounded-lg transition-colors shrink-0">
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
          </ListWidgetCard>
        );

      case "customers":
        return !isVisible("customers") ? null : (
          <ListWidgetCard
            itemHeightPx={46}
            items={data?.recentCustomers ?? []}
            loading={loading}
            loadingSkeleton={
              <div className="flex flex-col gap-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1"><Skeleton className="h-3 w-24" /><Skeleton className="h-2.5 w-16" /></div>
                  </div>
                ))}
              </div>
            }
            empty={<p className="text-xs text-slate-400 py-4">顧客データはありません</p>}
            header={(
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
                <span className="text-xs font-bold text-slate-800">最近の顧客</span>
                <Link href="/crm"><ArrowUpRight className="h-3.5 w-3.5 text-slate-300 hover:text-primary transition-colors" /></Link>
              </div>
            )}
          >
            {(customer) => {
              const avatar = getCustomerAvatarColor(customer.id);
              return (
                <Link key={customer.id} href={`/crm/${customer.id}`}
                  className="flex items-center gap-3 py-1.5 hover:bg-[#D8EDE4]/50 -mx-1 px-1 rounded-xl transition-colors group shrink-0">
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
              );
            }}
          </ListWidgetCard>
        );

      case "trend":
        return !isVisible("trend") ? null : (
          <div className="bg-white rounded-2xl shadow-sm p-3 flex flex-col gap-2 h-full min-h-0 w-full">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-xs font-bold text-slate-800`}>売上トレンド</span>
                <span className={`text-[11px] text-primary/80 opacity-70 hidden sm:inline truncate`}>直近7ヶ月 / 万円</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 text-[11px] text-primary/80`}>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm inline-block" style={{ background: "var(--brand-gradient)" }} />受注額</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm inline-block" style={{ background: `linear-gradient(180deg, var(--brand-accent) 0%, var(--brand-mid) 100%)` }} />パイプライン</span>
                </div>
              </div>
            </div>
            {loading ? (
              <Skeleton className="flex-1 min-h-[180px] w-full" />
            ) : (
              <ResponsiveTrendChart data={getTrendChartData(data?.monthlyTrend)} brandColors={brandColors} />
            )}
          </div>
        );

      case "deals": {
        if (!isVisible("deals")) return null;
        const dealsHeader = (
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800">
                {dealsTab === "deals" ? "商談パイプライン" : "未フォローアップ"}
              </span>
              {dealsTab === "unfollowed" && !unfollowedLoading && unfollowedLeads.length > 0 && (
                <span
                  className="text-[10px] font-bold rounded-full px-1.5 py-0.5 border"
                  style={{ color: brandColors.dark, background: brandColors.accent + "40", borderColor: brandColors.mid }}
                >{unfollowedLeads.length}件</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-slate-100 text-[10px] font-medium">
                <button
                  type="button"
                  onClick={() => setDealsTab("deals")}
                  className={cn("px-2 py-1 transition-colors rounded-l-lg", dealsTab === "deals" ? "text-white" : "text-slate-400 hover:text-slate-600")}
                  style={dealsTab === "deals" ? { background: "var(--brand-gradient)" } : undefined}
                >商談</button>
                <button
                  type="button"
                  onClick={() => setDealsTab("unfollowed")}
                  className={cn("px-2 py-1 transition-colors relative rounded-r-lg", dealsTab === "unfollowed" ? "text-white" : "text-slate-400 hover:text-slate-600")}
                  style={dealsTab === "unfollowed" ? { background: "var(--brand-gradient)" } : undefined}
                >
                  未フォロー
                  {dealsTab !== "unfollowed" && !unfollowedLoading && unfollowedLeads.length > 0 && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-rose-500" />
                  )}
                </button>
              </div>
              <Link href={dealsTab === "deals" ? "/deals" : "/crm?tab=unfollowed"}>
                <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 hover:text-primary transition-colors" />
              </Link>
            </div>
          </div>
        );

        if (dealsTab === "deals") {
          return (
            <ListWidgetCard
              items={data?.recentDeals ?? []}
              itemHeightPx={50}
              loading={loading}
              loadingSkeleton={
                <div className="flex flex-col gap-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="py-2 space-y-1.5">
                      <Skeleton className="h-3 w-32" /><Skeleton className="h-3 w-20" />
                    </div>
                  ))}
                </div>
              }
              empty={<p className="text-xs text-slate-400 py-4">進行中の商談はありません</p>}
              header={dealsHeader}
            >
              {(deal) => {
                const colorSeed = deal.customerId ?? deal.customerName;
                const avatar = getCustomerAvatarColor(colorSeed);
                const initial = deal.customerName !== "—" ? deal.customerName.charAt(0) : deal.title.charAt(0);
                return (
                  <Link key={deal.id} href="/deals"
                    className="flex items-center justify-between gap-2 py-1.5 px-1 rounded-xl hover:bg-[#D8EDE4]/50 transition-colors shrink-0">
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
                );
              }}
            </ListWidgetCard>
          );
        }

        return (
          <ListWidgetCard
            items={unfollowedLeads}
            itemHeightPx={52}
            loading={unfollowedLoading}
            loadingSkeleton={
              <div className="flex flex-col gap-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="py-2 space-y-1.5">
                    <Skeleton className="h-3 w-32" /><Skeleton className="h-3 w-20" />
                  </div>
                ))}
              </div>
            }
            empty={
              <div className="flex flex-col items-center justify-center gap-1.5 py-4">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <p className="text-[11px] text-slate-400">全員フォローアップ済みです</p>
              </div>
            }
            header={dealsHeader}
          >
            {(lead) => {
              const avatar = getCustomerAvatarColor(lead.id);
              return (
                <div key={lead.id} className="flex items-center gap-2 py-1.5 px-1 rounded-xl shrink-0">
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-bold shadow-sm"
                    style={{ background: avatar.avatarGradient }}
                  >
                    {lead.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/crm/${lead.id}`} className="text-xs font-semibold text-slate-800 truncate hover:text-primary block">{lead.name}</Link>
                    <p className="text-[11px] text-slate-400 truncate">
                      担当: {lead.assigned_to_profile?.display_name ?? "不明"}
                      {lead.days_since_update != null && (
                        <span className="ml-1" style={{ color: brandColors.dark }}>{lead.days_since_update}日前</span>
                      )}
                    </p>
                  </div>
                  {lead.assigned_to && (
                    <button
                      type="button"
                      onClick={() => { setInquiryTarget(lead); setInquiryContent(`${lead.name} 様の件ですが、フォローアップの状況を教えてください。`); }}
                      className="shrink-0 text-[10px] font-medium px-2 py-1 rounded-lg flex items-center gap-1 border transition-colors"
                      style={{ color: brandColors.dark, background: brandColors.accent + "30", borderColor: brandColors.mid }}
                      onMouseEnter={e => (e.currentTarget.style.background = brandColors.accent + "60")}
                      onMouseLeave={e => (e.currentTarget.style.background = brandColors.accent + "30")}
                    >
                      <MessageSquare className="h-3 w-3" />問い合わせ
                    </button>
                  )}
                </div>
              );
            }}
          </ListWidgetCard>
        );
      }

      case "quotes":
        return !isVisible("quotes") ? null : (
          <ListWidgetCard
            itemHeightPx={46}
            items={data?.recentEstimates ?? []}
            loading={loading}
            loadingSkeleton={
              <div className="flex flex-col gap-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="py-2 space-y-1.5">
                    <Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            }
            empty={<p className="text-xs text-slate-400 py-4">見積データはありません</p>}
            header={(
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800">最近の見積</span>
                <Link href="/quotes"><ArrowUpRight className="h-3.5 w-3.5 text-slate-300 hover:text-primary transition-colors" /></Link>
              </div>
            )}
          >
            {(est) => (
              <Link key={est.id} href={`/quotes/${est.id}`}
                className="flex items-center justify-between gap-2 py-2 px-1 rounded-xl hover:bg-[#D8EDE4]/50 transition-colors shrink-0">
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
          </ListWidgetCard>
        );

      case "production":
        return !isVisible("production") ? null : (
          <div className="bg-white rounded-2xl shadow-sm p-3 flex flex-col gap-2 h-full">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
              <span className={`text-xs font-bold text-slate-800`}>生産サマリー</span>
              <Link href="/contracts"><ArrowUpRight className="h-3.5 w-3.5 text-slate-300 hover:text-primary transition-colors" /></Link>
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
                  className="flex items-center justify-between py-2 px-1 rounded-xl hover:bg-[#D8EDE4]/50 transition-colors">
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
          <div className="bg-white rounded-2xl shadow-sm p-3 flex flex-col gap-2 h-full">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
              <span className={`text-xs font-bold text-slate-800`}>進行中の工事</span>
              <Link href="/constructions"><ArrowUpRight className="h-3.5 w-3.5 text-slate-300 hover:text-primary transition-colors" /></Link>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(100px,1fr))] gap-x-2 gap-y-1 flex-1 min-h-0 overflow-y-auto content-start">
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-1 w-full">
                  <Skeleton className="h-14 w-full max-w-[160px] rounded-t-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              )) : data?.constructions.length ? data.constructions.map((c) => {
                const customer = c.customer as { id?: string; name?: string } | null;
                const progress = Math.min(100, Math.max(0, c.progress ?? 0));
                const isPreparing = c.status === "preparing";
                const gradId = `gauge-grad-${c.id}`;
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
                            <stop offset="0%" style={{ stopColor: "var(--brand-light)" }} />
                            <stop offset="100%" style={{ stopColor: "var(--brand-dark)" }} />
                          </linearGradient>
                        </defs>
                        <path
                          d={`M 12 50 A ${radius} ${radius} 0 0 1 88 50`}
                          fill="none"
                          stroke={brandColors.accent}
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
                        {isPreparing && progress === 0 ? (
                          <text
                            x="50"
                            y="47"
                            textAnchor="middle"
                            style={{ fill: "var(--brand-dark)" }}
                            fontSize="12"
                            fontWeight="700"
                          >
                            準備中
                          </text>
                        ) : (
                          <text
                            x="50"
                            y="47"
                            textAnchor="middle"
                            style={{ fill: "var(--brand-dark)" }}
                            fontSize="18"
                            fontWeight="700"
                            className="tabular-nums"
                          >
                            {progress}
                            <tspan fontSize="11" fontWeight="700">%</tspan>
                          </text>
                        )}
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

      case "unfollowed":
        return null;

      default:
        return null;
    }
  };

  const sortableIds = widgets.filter((w) => w.id !== "kpi" && w.visible).map((w) => w.id);
  const { gridRef, stackFullWidth, defaultCols } = useWidgetGridLayout();

  return (
    <div className="@container p-3 md:p-4 xl:p-5 2xl:p-6 space-y-3 md:space-y-4 min-h-screen min-w-0">

      {/* ToDo期限通知バナー（No.27） */}
      {!loading && urgentCount > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
            <p className="text-sm text-rose-900 truncate">
              期限が今日（または優先）のToDoが <span className="font-bold">{urgentCount}件</span> あります。今日のフォーカスを確認してください。
            </p>
          </div>
          <button
            type="button"
            onClick={goToTodaysFocus}
            className="text-xs font-medium text-rose-700 hover:underline shrink-0"
          >
            確認する
          </button>
        </div>
      )}

      {/* フォローアップ問い合わせダイアログ */}
      <Dialog open={!!inquiryTarget} onOpenChange={(o) => { if (!o) { setInquiryTarget(null); setInquiryContent(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              フォローアップ問い合わせ
            </DialogTitle>
          </DialogHeader>
          {inquiryTarget && (
            <div className="space-y-3">
              <div
                className="rounded-lg px-3 py-2 text-sm"
                style={{ background: brandColors.accent + "40", color: brandColors.dark }}
              >
                <p className="font-medium text-foreground">{inquiryTarget.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  担当: {inquiryTarget.assigned_to_profile?.display_name ?? "不明"}
                  {inquiryTarget.days_since_update != null && (
                    <span className="ml-2">最終更新: {inquiryTarget.days_since_update}日前</span>
                  )}
                </p>
              </div>
              <Textarea
                value={inquiryContent}
                onChange={(e) => setInquiryContent(e.target.value)}
                placeholder="担当者へのメッセージを入力..."
                rows={4}
                className="resize-none"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setInquiryTarget(null); setInquiryContent(""); }}>キャンセル</Button>
            <Button
              onClick={handleSendInquiry}
              disabled={inquirySending || !inquiryContent.trim()}
              className="gap-1.5"
            >
              <Send className="h-4 w-4" />
              {inquirySending ? "送信中..." : "送信する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">ダッシュボード</h1>
          <p className="text-sm mt-1 text-muted-foreground">{format(now, "yyyy年M月d日（EEEE）", { locale: ja })}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-1">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowBombPreview(true)}
            title="爆弾アラートをプレビュー"
          >
            💣
          </Button>
          <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Settings2 className="h-4 w-4" />
              表示設定
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-3 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">表示設定</p>
            </div>

            {/* カラーテーマ セクション */}
            <div className="flex items-center justify-between px-2 mb-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">テーマカラー</p>
              <button
                onClick={resetColor}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                title="デフォルトに戻す"
              >
                <RotateCcw className="h-3 w-3" />リセット
              </button>
            </div>

            {/* グラデーション */}
            <div
              className={`flex items-center gap-3 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${brandMode === "gradient" ? "bg-muted/60" : "hover:bg-muted/30"}`}
              onClick={() => switchMode("gradient")}
            >
              <label className="relative cursor-pointer group shrink-0" onClick={(e) => e.stopPropagation()}>
                <span
                  className={`h-9 w-9 rounded-full block shadow-sm transition-all group-hover:scale-105 ${brandMode === "gradient" ? "scale-105" : ""}`}
                  style={{ background: (() => { const c = computeBrandFromHex(gradientHex); return `linear-gradient(135deg, ${c.light} 0%, ${c.dark} 100%)`; })() }}
                />
                <input type="color" value={gradientHex} onChange={(e) => { switchMode("gradient"); setGradientColor(e.target.value); }} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
              </label>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium leading-tight">グラデーション</p>
                <p className="text-[11px] text-muted-foreground uppercase">{gradientHex.toUpperCase()}</p>
              </div>
              {brandMode === "gradient" && <span className="h-1.5 w-1.5 rounded-full bg-foreground shrink-0" />}
            </div>

            {/* 単色 */}
            <div
              className={`flex items-center gap-3 px-2 py-1.5 rounded-lg cursor-pointer transition-colors mb-1 ${brandMode === "solid" ? "bg-muted/60" : "hover:bg-muted/30"}`}
              onClick={() => switchMode("solid")}
            >
              <label className="relative cursor-pointer group shrink-0" onClick={(e) => e.stopPropagation()}>
                <span
                  className={`h-9 w-9 rounded-full block shadow-sm transition-all group-hover:scale-105 ${brandMode === "solid" ? "scale-105" : ""}`}
                  style={{ background: solidHex }}
                />
                <input type="color" value={solidHex} onChange={(e) => { switchMode("solid"); setSolidColor(e.target.value); }} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
              </label>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium leading-tight">単色</p>
                <p className="text-[11px] text-muted-foreground uppercase">{solidHex.toUpperCase()}</p>
              </div>
              {brandMode === "solid" && <span className="h-1.5 w-1.5 rounded-full bg-foreground shrink-0" />}
            </div>

            <div className="border-t border-border/60 mb-3" />

            {/* KPI セクション（No.56: 表示ON/OFF + 上下ボタンで並び替え） */}
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">KPI指標（並び替え可）</p>
            <div className="space-y-0.5 mb-3">
              {kpiWidgets.map((w, i) => (
                <div key={w.id} className="flex items-center justify-between gap-1 py-1 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <span className={`text-sm flex-1 min-w-0 truncate ${w.visible ? "text-foreground" : "text-muted-foreground"}`}>{w.label}</span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveKpi(w.id, -1)}
                      disabled={i === 0}
                      className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      title="上へ移動"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveKpi(w.id, 1)}
                      disabled={i === kpiWidgets.length - 1}
                      className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      title="下へ移動"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <Switch checked={w.visible} onCheckedChange={() => toggleVisible(w.id)} className="scale-90" />
                </div>
              ))}
            </div>

            <div className="border-t border-border/60 mb-3" />

            {/* ウィジェット セクション */}
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">ウィジェット</p>
            <div className="space-y-0.5">
              {widgets.filter((w) => !w.id.startsWith("kpi-")).map((w) => (
                <div key={w.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <span className={`text-sm ${w.visible ? "text-foreground" : "text-muted-foreground"}`}>{w.label}</span>
                  <Switch checked={w.visible} onCheckedChange={() => toggleVisible(w.id)} className="scale-90" />
                </div>
              ))}
            </div>
          </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* KPI row — 個別表示制御 + ユーザー設定順（No.56） */}
      {orderedKpis.some((k) => isVisible(k.id)) && (
        <KpiRow
          loading={loading}
          items={orderedKpis.filter((k) => isVisible(k.id))}
          columns={4}
        />
      )}

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
                  cols={wc?.cols}
                  defaultCols={defaultCols}
                  stackFullWidth={stackFullWidth}
                  height={wc?.height}
                  onResize={resizeWidget}
                >
                  {card}
                </SortableWidget>
              );
            })}
      </WidgetGrid>

      {/* 爆弾アラートプレビュー */}
      {showBombPreview && (
        <BombAlert
          urgentCount={10}
          preview
          onDismiss={() => setShowBombPreview(false)}
        />
      )}
    </div>
  );
}
