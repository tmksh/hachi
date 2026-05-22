"use client";

import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useState, useEffect, useRef, useCallback, type CSSProperties } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useWidgets } from "@/hooks/use-widgets";
import { useKpiColor } from "@/hooks/use-kpi-color";
import { WidgetCustomizer } from "@/components/shared/widget-customizer";
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
  FileText,
  Receipt,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getDashboardData } from "@/lib/actions/dashboard";
import { clockIn as clockInAction, clockOut as clockOutAction, getTodayAttendance } from "@/lib/actions/attendance";
import { AnalogClock } from "@/components/shared/analog-clock";
import { SortableWidget } from "@/components/shared/sortable-widget";
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


function kpiBtnStyle(color: string): CSSProperties {
  return { background: color };
}

const KPI_PRESETS = [
  "#1a7a52", "#34d399", "#38bdf8", "#818cf8",
  "#c084fc", "#fb7185", "#fb923c", "#fbbf24",
  "#2dd4bf", "#60a5fa",
];

function KpiColorBar({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="hidden sm:flex items-center gap-1.5 bg-background/60 border border-border/50 rounded-lg px-2 py-1">
      {KPI_PRESETS.map((c) => (
        <button
          key={c}
          title={c}
          onClick={() => onChange(c)}
          className={`h-5 w-5 rounded-full transition-all duration-150 hover:scale-110 active:scale-95 ${color === c ? "ring-2 ring-offset-1 ring-foreground/40 scale-110" : ""}`}
          style={{ background: c }}
        />
      ))}
      {/* カスタムピッカー */}
      <button
        title="カスタムカラー"
        onClick={() => inputRef.current?.click()}
        className={`h-5 w-5 rounded-full bg-gradient-to-br from-pink-300 via-purple-300 to-blue-300 flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${!KPI_PRESETS.includes(color) ? "ring-2 ring-offset-1 ring-foreground/40 scale-110" : ""}`}
      >
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-white drop-shadow" fill="currentColor">
          <path d="M10.5 1.5a1.5 1.5 0 0 0-2.12 0L2.5 7.38A2 2 0 0 0 2 8.8V10h1.2a2 2 0 0 0 1.42-.59l5.88-5.88a1.5 1.5 0 0 0 0-2.03z" />
        </svg>
      </button>
      <input ref={inputRef} type="color" className="sr-only" value={color} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function formatYen(n: number) {
  if (n >= 100_000_000) return `¥${(n / 100_000_000).toFixed(1)}億`;
  if (n >= 10_000) return `¥${(n / 10_000).toFixed(0)}万`;
  return `¥${n.toLocaleString()}`;
}

function WidgetHeader({ title, href }: { title: string; href: string }) {
  return (
    <CardHeader>
      <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      <Link href={href}>
        <span className="inline-flex h-7 w-7 items-center justify-center rounded text-primary hover:bg-primary/10 transition-colors">
          <ExternalLink className="h-4 w-4" />
        </span>
      </Link>
    </CardHeader>
  );
}

const KPI_ITEMS = [
  { label: "受注額", key: "wonValue" as const, href: "/deals", icon: TrendingUp, format: formatYen },
  { label: "パイプライン", key: "pipelineValue" as const, href: "/deals", icon: BarChart3, format: formatYen },
  { label: "顧客数", key: "customerCount" as const, href: "/crm", icon: Users, format: (n: number) => String(n) },
  { label: "進行案件", key: "activeConstructions" as const, href: "/constructions", icon: Briefcase, format: (n: number) => String(n) },
];

export default function DashboardPage() {
  const [clockedIn, setClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const { widgets, hydrated, toggleVisible, moveUp, moveDown, reorder, resizeWidget, setWidgetWidth, initWidths, reset } = useWidgets();
  const { color: kpiColor, setColor: setKpiColor, reset: resetKpiColor } = useKpiColor();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorder(String(active.id), String(over.id));
    }
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

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">ダッシュボード</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(now, "yyyy年M月d日（EEEE）", { locale: ja })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* KPI カラースウォッチ（ヘッダー行） */}
          <KpiColorBar color={kpiColor} onChange={setKpiColor} />
          <WidgetCustomizer
            widgets={widgets}
            onToggle={toggleVisible}
            onMoveUp={moveUp}
            onMoveDown={moveDown}
            onReset={() => { reset(); resetKpiColor(); }}
            kpiColor={kpiColor}
            onKpiColorChange={setKpiColor}
          />
        </div>
      </div>

      {/* ── Row 1: KPI cards ────────────────────────────────── */}
      {isVisible("kpi") && (
        <Card className="stat-card transition-[box-shadow,background-color] duration-200 py-0">
          <CardContent className="py-2">
            <div className="grid grid-cols-2 lg:grid-cols-4">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="px-4 first:pl-0 last:pr-0 space-y-1.5">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                ))
              ) : (
                KPI_ITEMS.map((kpi) => {
                  const value = data?.kpis[kpi.key] ?? 0;
                  const Icon = kpi.icon;
                  return (
                    <Link
                      key={kpi.label}
                      href={kpi.href}
                      className="block px-4 first:pl-0 last:pr-0 rounded-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_12px_2px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_0_12px_2px_rgba(255,255,255,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">{kpi.label}</span>
                        <div className="neumorph-icon h-8 w-8" style={{ background: kpiColor }}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <p className="text-2xl font-bold tabular-nums tracking-tight">{kpi.format(value)}</p>
                    </Link>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Sortable widget grid (attendance / ai-focus / workflow / mail / customers / constructions) ── */}
      {(() => {
        const todos = data?.todos ?? [];
        const visibleTodos = todos.slice(0, 5);
        const totalCount = todos.length;
        const urgentCount = todos.filter((t) => t.priority === "high" && t.status !== "completed").length;

        const renderCard = (id: string) => {
          switch (id) {
            case "attendance":
              return !isVisible("attendance") ? null : (
                <Card className="overflow-hidden h-full">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">勤怠打刻</CardTitle>
                    <Link href="/attendance">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded text-primary hover:bg-primary/10 transition-colors">
                        <ExternalLink className="h-4 w-4" />
                      </span>
                    </Link>
                  </CardHeader>
                  <CardContent className="pt-3 pb-4 px-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full transition-all duration-500 ${clockedIn ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" : "bg-muted-foreground/30"}`} />
                        <span className="text-xs font-medium text-muted-foreground">{clockedIn ? "勤務中" : "未出勤"}</span>
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">{format(now, "M月d日（EEE）", { locale: ja })}</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 mb-3">
                      <AnalogClock size={92} />
                      <p className="text-sm font-semibold tabular-nums text-muted-foreground tracking-widest">{format(now, "HH:mm")}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{clockInTime ? `出勤 ${format(clockInTime, "HH:mm")}〜` : "出勤打刻をしてください"}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" onClick={handleClockIn} disabled={clockedIn} className="gap-1.5 h-9 neumorph-btn-primary" style={kpiBtnStyle(kpiColor)}>
                        <LogIn className="h-3.5 w-3.5" />出勤
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleClockOut} disabled={!clockedIn} className="gap-1.5 h-9 neumorph-btn">
                        <LogOut className="h-3.5 w-3.5" />退勤
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );

            case "ai-focus":
              return !isVisible("ai-focus") ? null : (
                <Card className="overflow-hidden relative h-full">
                  <CardHeader className="relative">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-semibold">今日のフォーカス</CardTitle>
                    </div>
                    <Link href="/bi">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded text-primary hover:bg-primary/10 transition-colors">
                        <ExternalLink className="h-4 w-4" />
                      </span>
                    </Link>
                  </CardHeader>
                  <CardContent className="relative h-full flex flex-col py-4 px-5 gap-4">
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : totalCount > 0 ? (
                      <div className="flex items-end justify-between gap-3">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-bold tabular-nums leading-none text-foreground">{totalCount}</span>
                          <span className="text-xs text-muted-foreground">件のタスク</span>
                        </div>
                        {urgentCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200/70 px-2 py-0.5 rounded-full">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                            急ぎ {urgentCount}件
                          </span>
                        )}
                      </div>
                    ) : null}
                    <div className="flex-1 -mx-1 space-y-0.5">
                      {loading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="flex items-center gap-3 px-2 py-2">
                            <Skeleton className="h-4 w-4 rounded-full" />
                            <Skeleton className="h-3 w-40" />
                          </div>
                        ))
                      ) : visibleTodos.length ? (
                        visibleTodos.map((todo) => {
                          const isCompleted = todo.status === "completed";
                          const isUrgent = todo.priority === "high" && !isCompleted;
                          return (
                            <div key={todo.id} className={`group relative flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${isUrgent ? "hover:bg-rose-50/50" : "hover:bg-muted/50"}`}>
                              {isUrgent && <span aria-hidden className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-rose-400" />}
                              <div className={`relative h-4 w-4 rounded-full flex items-center justify-center shrink-0 transition-all ${isCompleted ? "bg-primary border-2 border-primary" : "border-2 border-muted-foreground/30 group-hover:border-primary/60"}`}>
                                {isCompleted && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                              </div>
                              <span className={`text-xs flex-1 truncate ${isCompleted ? "line-through text-muted-foreground" : "text-foreground"}`}>{todo.title}</span>
                              {isUrgent && <span className="text-[10px] font-semibold tracking-wider text-rose-600 bg-rose-100/80 px-1.5 py-0.5 rounded-full shrink-0">急</span>}
                            </div>
                          );
                        })
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                          <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center ring-4 ring-emerald-50/50">
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          </div>
                          <p className="text-xs font-medium text-foreground">今日のタスクは完了しました</p>
                          <p className="text-[11px] text-muted-foreground">お疲れさまです</p>
                        </div>
                      )}
                    </div>
                    {!loading && totalCount > visibleTodos.length && (
                      <Link href="/bi" className="text-[11px] text-muted-foreground hover:text-primary transition-colors text-center">
                        残り {totalCount - visibleTodos.length} 件 →
                      </Link>
                    )}
                  </CardContent>
                </Card>
              );

            case "workflow":
              return !isVisible("workflow") ? null : (
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">ワークフロー</CardTitle>
                    <Link href="/workflow">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded text-primary hover:bg-primary/10 transition-colors">
                        <ExternalLink className="h-4 w-4" />
                      </span>
                    </Link>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {[
                      { label: "承認待ち", href: "/workflow", color: "bg-amber-100 text-amber-800 hover:bg-amber-100", count: data?.workflow.pendingApprovals ?? 0 },
                      { label: "申請中",   href: "/workflow", color: "", count: data?.workflow.submittedRequests ?? 0 },
                      { label: "完了済み", href: "/workflow", color: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100", count: data?.workflow.completedRequests ?? 0 },
                    ].map((item, i) => (
                      <Link key={i} href={item.href} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                        <span className="text-xs">{item.label}</span>
                        {loading ? <Skeleton className="h-4 w-6" /> : (
                          <Badge className={`text-xs ${item.color || ""}`} variant={item.color ? "default" : "secondary"}>{item.count}</Badge>
                        )}
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              );

            case "mail":
              return !isVisible("mail") ? null : (
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                      お知らせ
                      {!loading && data?.announcements && data.announcements.length > 0 && (
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/10 text-[10px] h-4 px-1.5">{data.announcements.length}</Badge>
                      )}
                    </CardTitle>
                    <Link href="/circulation">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded text-primary hover:bg-primary/10 transition-colors">
                        <ExternalLink className="h-4 w-4" />
                      </span>
                    </Link>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="px-2 py-2 space-y-1">
                            <Skeleton className="h-3 w-32" />
                            <Skeleton className="h-3 w-48" />
                          </div>
                        ))
                      ) : data?.announcements.length ? (
                        data.announcements.map((ann) => (
                          <Link key={ann.id} href={`/circulation/${ann.id}`}
                            className="flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-white/30 transition-colors group">
                            <div className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${ann.is_urgent ? "bg-rose-500" : ann.pinned ? "bg-primary" : "bg-transparent"}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{ann.title}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{ann.body}</p>
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{format(new Date(ann.published_at), "M/d", { locale: ja })}</span>
                          </Link>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground px-2 py-2">お知らせはありません</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );

            case "trend":
              return !isVisible("trend") ? null : (
                <Card className="h-full">
                  <WidgetHeader title="売上トレンド" href="/deals" />
                  <CardContent className="pt-2">
                    <p className="text-[11px] text-muted-foreground mb-3">直近7ヶ月 / 受注額・パイプライン（万円）</p>
                    {loading ? (
                      <Skeleton className="h-[220px] w-full" />
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={data?.monthlyTrend ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="10%" barGap={2}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                          <Tooltip
                            cursor={false}
                            contentStyle={{
                              borderRadius: 10,
                              fontSize: 12,
                              border: "1px solid hsl(var(--border))",
                              background: "hsl(var(--card))",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                            }}
                            formatter={(v, name) => [`¥${v}万`, name ?? ""]}
                          />
                          <Bar dataKey="パイプライン" fill="#d4d4d8" radius={[4, 4, 0, 0]} maxBarSize={36} activeBar={false} />
                          <Bar dataKey="受注額" fill={kpiColor} radius={[4, 4, 0, 0]} maxBarSize={36} activeBar={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              );

            case "deals":
              return !isVisible("deals") ? null : (
                <Card className="h-full">
                  <WidgetHeader title="商談パイプライン" href="/deals" />
                  <CardContent>
                    <div className="space-y-1">
                      {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="px-2 py-2 space-y-1">
                            <Skeleton className="h-3 w-32" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                        ))
                      ) : data?.recentDeals.length ? (
                        data.recentDeals.map((deal) => (
                          <Link
                            key={deal.id}
                            href="/deals"
                            className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium truncate">{deal.title}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{deal.customerName}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-semibold tabular-nums">{formatYen(deal.value ?? 0)}</p>
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 mt-0.5">{deal.stageLabel}</Badge>
                            </div>
                          </Link>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground px-2 py-2">進行中の商談はありません</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );

            case "quotes":
              return !isVisible("quotes") ? null : (
                <Card className="h-full">
                  <WidgetHeader title="最近の見積" href="/quotes" />
                  <CardContent>
                    <div className="space-y-1">
                      {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="px-2 py-2 space-y-1">
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-3 w-16" />
                          </div>
                        ))
                      ) : data?.recentEstimates.length ? (
                        data.recentEstimates.map((est) => (
                          <Link
                            key={est.id}
                            href={`/quotes/${est.id}`}
                            className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{est.estimateNo}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{est.title}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-semibold tabular-nums">{formatYen(est.total ?? 0)}</p>
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 mt-0.5">{est.statusLabel}</Badge>
                            </div>
                          </Link>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground px-2 py-2">見積データはありません</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );

            case "production":
              return !isVisible("production") ? null : (
                <Card className="h-full">
                  <WidgetHeader title="生産サマリー" href="/contracts" />
                  <CardContent className="space-y-2">
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
                      <Link
                        key={item.label}
                        href={item.href}
                        className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <item.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-xs font-medium">{item.label}</p>
                            <p className="text-[11px] text-muted-foreground">{item.sub}</p>
                          </div>
                        </div>
                        {loading ? (
                          <Skeleton className="h-5 w-8" />
                        ) : (
                          <Badge variant="secondary" className="text-xs tabular-nums">{item.count}</Badge>
                        )}
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              );

            case "customers":
              return !isVisible("customers") ? null : (
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">最近の顧客</CardTitle>
                    <Link href="/crm">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded text-primary hover:bg-primary/10 transition-colors">
                        <ExternalLink className="h-4 w-4" />
                      </span>
                    </Link>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="flex items-center gap-2.5 px-2 py-2">
                            <Skeleton className="h-7 w-7 rounded-full" />
                            <div className="space-y-1 flex-1">
                              <Skeleton className="h-3 w-24" />
                              <Skeleton className="h-3 w-16" />
                            </div>
                          </div>
                        ))
                      ) : data?.recentCustomers.length ? (
                        data.recentCustomers.map((customer) => (
                          <Link key={customer.id} href={`/crm/${customer.id}`}
                            className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/30 transition-colors">
                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-[11px] font-semibold text-primary">{customer.name.charAt(0)}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{customer.name}</p>
                              <p className="text-[11px] text-muted-foreground">{customer.company_name || "個人"}</p>
                            </div>
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{customer.status}</Badge>
                          </Link>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground px-2 py-2">顧客データはありません</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );

            case "constructions":
              return !isVisible("constructions") ? null : (
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">進行中の工事</CardTitle>
                    <Link href="/constructions">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded text-primary hover:bg-primary/10 transition-colors">
                        <ExternalLink className="h-4 w-4" />
                      </span>
                    </Link>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="px-2 py-2 space-y-2">
                            <Skeleton className="h-3 w-40" />
                            <Skeleton className="h-1.5 w-full" />
                          </div>
                        ))
                      ) : data?.constructions.length ? (
                        data.constructions.map((c) => (
                          <Link key={c.id} href={`/constructions/${c.id}`}
                            className="block px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <HardHat className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs font-medium">{c.title}</span>
                              </div>
                              <span className="text-xs font-semibold tabular-nums">{c.progress}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                              <div className="bg-primary" style={{ width: `${c.progress}%`, height: "100%", borderRadius: "9999px", transition: "width 0.3s" }} />
                            </div>
                          </Link>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground px-2 py-2">進行中の工事はありません</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );

            default:
              return null;
          }
        };

        const sortableIds = widgets
          .filter((w) => w.id !== "kpi" && w.visible)
          .map((w) => w.id);

        return (
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
        );
      })()}

    </div>
  );
}
