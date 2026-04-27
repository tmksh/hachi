"use client";

import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useWidgets } from "@/hooks/use-widgets";
import { WidgetCustomizer } from "@/components/shared/widget-customizer";
import {
  LogIn,
  LogOut,
  Megaphone,
  FileText,
  TrendingUp,
  Users,
  Briefcase,
  HardHat,
  ChevronRight,
  BarChart3,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getDashboardData } from "@/lib/actions/dashboard";
import { clockIn as clockInAction, clockOut as clockOutAction, getTodayAttendance } from "@/lib/actions/attendance";
import { AnalogClock } from "@/components/shared/analog-clock";

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
}

function formatYen(n: number) {
  if (n >= 100_000_000) return `¥${(n / 100_000_000).toFixed(1)}億`;
  if (n >= 10_000) return `¥${(n / 10_000).toFixed(0)}万`;
  return `¥${n.toLocaleString()}`;
}

const KPI_SWATCHES = [
  { color: "#34d399", label: "エメラルド" },
  { color: "#38bdf8", label: "スカイ" },
  { color: "#818cf8", label: "インディゴ" },
  { color: "#c084fc", label: "パープル" },
  { color: "#fb7185", label: "ローズ" },
  { color: "#fb923c", label: "オレンジ" },
  { color: "#fbbf24", label: "アンバー" },
  { color: "#2dd4bf", label: "ティール" },
  { color: "#60a5fa", label: "ブルー" },
  { color: "#a3e635", label: "ライム" },
  { color: "#f472b6", label: "ピンク" },
  { color: "#22d3ee", label: "シアン" },
] as const;

export default function DashboardPage() {
  const [clockedIn, setClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const [kpiColor, setKpiColor] = useState<string | null>(null);
  const { widgets, hydrated, toggleVisible, moveUp, moveDown, reset } = useWidgets();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

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

  const primaryRgb = kpiColor ? hexToRgb(kpiColor) : null;

  useEffect(() => {
    const root = document.documentElement;
    const rgb = kpiColor ? hexToRgb(kpiColor) : null;
    if (rgb && kpiColor) {
      root.style.setProperty("--primary", kpiColor);
      root.style.setProperty("--color-primary", kpiColor);
      root.style.setProperty("--primary-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
      root.style.setProperty(
        "--primary-dark-rgb",
        `${Math.round(rgb.r * 0.55)}, ${Math.round(rgb.g * 0.55)}, ${Math.round(rgb.b * 0.55)}`,
      );
    } else {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--color-primary");
      root.style.removeProperty("--primary-rgb");
      root.style.removeProperty("--primary-dark-rgb");
    }
    return () => {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--color-primary");
      root.style.removeProperty("--primary-rgb");
      root.style.removeProperty("--primary-dark-rgb");
    };
  }, [kpiColor]);

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

        {/* Color swatches */}
        <div className="flex items-center gap-1">
          {KPI_SWATCHES.map(({ color, label }) => (
            <button
              key={color}
              title={label}
              onClick={() => setKpiColor(kpiColor === color ? null : color)}
              className={`flex flex-col items-center gap-0.5 transition-all duration-150 ${
                kpiColor === color ? "scale-110" : "opacity-55 hover:opacity-90 hover:scale-105"
              }`}
            >
              <span
                className={`h-7 w-7 rounded block ${kpiColor === color ? "ring-2 ring-offset-1 ring-foreground/40" : ""}`}
                style={{ backgroundColor: color }}
              />
              <span className="text-[8px] text-muted-foreground tabular-nums leading-none">{color}</span>
            </button>
          ))}

          {/* Custom color picker */}
          <label
            title="カスタムカラー"
            className={`flex flex-col items-center gap-0.5 cursor-pointer transition-all duration-150 ${
              kpiColor && !KPI_SWATCHES.some((s) => s.color === kpiColor)
                ? "scale-110"
                : "opacity-55 hover:opacity-90 hover:scale-105"
            }`}
          >
            <span
              className={`h-7 w-7 rounded flex items-center justify-center border border-dashed border-foreground/30 overflow-hidden relative ${
                kpiColor && !KPI_SWATCHES.some((s) => s.color === kpiColor)
                  ? "ring-2 ring-offset-1 ring-foreground/40"
                  : ""
              }`}
              style={
                kpiColor && !KPI_SWATCHES.some((s) => s.color === kpiColor)
                  ? { backgroundColor: kpiColor }
                  : {}
              }
            >
              {(!kpiColor || KPI_SWATCHES.some((s) => s.color === kpiColor)) && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-foreground/40">
                  <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M6 1 A5 5 0 0 1 11 6" stroke="#fb7185" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M11 6 A5 5 0 0 1 6 11" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M6 11 A5 5 0 0 1 1 6" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M1 6 A5 5 0 0 1 6 1" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              )}
              <input
                type="color"
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                value={kpiColor && !KPI_SWATCHES.some((s) => s.color === kpiColor) ? kpiColor : "#ffffff"}
                onChange={(e) => setKpiColor(e.target.value)}
              />
            </span>
            <span className="text-[8px] text-muted-foreground tabular-nums leading-none">
              {kpiColor && !KPI_SWATCHES.some((s) => s.color === kpiColor) ? kpiColor : "カスタム"}
            </span>
          </label>
        </div>

        <WidgetCustomizer
          widgets={widgets}
          onToggle={toggleVisible}
          onMoveUp={moveUp}
          onMoveDown={moveDown}
          onReset={reset}
        />
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
                [
                  {
                    label: "受注額",
                    value: formatYen(data?.kpis.wonValue ?? 0),
                    icon: TrendingUp,
                  },
                  {
                    label: "パイプライン",
                    value: formatYen(data?.kpis.pipelineValue ?? 0),
                    icon: BarChart3,
                  },
                  {
                    label: "顧客数",
                    value: String(data?.kpis.customerCount ?? 0),
                    icon: Users,
                  },
                  {
                    label: "進行案件",
                    value: String(data?.kpis.activeConstructions ?? 0),
                    icon: Briefcase,
                  },
                ].map((kpi, i) => (
                  <div key={i} className="px-4 rounded-lg transition-all duration-300 cursor-default hover:-translate-y-0.5 hover:shadow-[0_0_12px_2px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_0_12px_2px_rgba(255,255,255,0.06)]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{kpi.label}</span>
                      {kpiColor ? (
                        <div
                          className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 shadow-md"
                          style={{ backgroundColor: kpiColor }}
                        >
                          <kpi.icon className="h-4 w-4 text-white" />
                        </div>
                      ) : (
                        <div className="neumorph-icon h-8 w-8">
                          <kpi.icon className="h-4 w-4 text-primary" />
                        </div>
                      )}
                    </div>
                    <p className="text-2xl font-bold tabular-nums tracking-tight">{kpi.value}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Row 2: Attendance (left) + AI focus + Workflow (right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_220px] gap-4">

        {/* Attendance */}
        {isVisible("attendance") && (
          <Card className="overflow-hidden">
            <CardContent className="pt-4 pb-5 px-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full transition-all duration-500 ${
                      clockedIn
                        ? primaryRgb
                          ? ""
                          : "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]"
                        : "bg-muted-foreground/30"
                    }`}
                    style={
                      clockedIn && primaryRgb
                        ? {
                            backgroundColor: kpiColor!,
                            boxShadow: `0 0 6px rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.7)`,
                          }
                        : {}
                    }
                  />
                  <span className="text-xs font-medium text-muted-foreground">{clockedIn ? "勤務中" : "未出勤"}</span>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{format(now, "M月d日（EEE）", { locale: ja })}</span>
              </div>

              {/* Analog clock + digital time */}
              <div className="flex flex-col items-center gap-2 mb-4">
                <AnalogClock size={92} />
                <p className="text-sm font-semibold tabular-nums text-muted-foreground tracking-widest">
                  {format(now, "HH:mm")}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {clockInTime ? `出勤 ${format(clockInTime, "HH:mm")}〜` : "出勤打刻をしてください"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" onClick={handleClockIn} disabled={clockedIn} className="gap-1.5 h-9 neumorph-btn-primary">
                  <LogIn className="h-3.5 w-3.5" />出勤
                </Button>
                <Button size="sm" variant="outline" onClick={handleClockOut} disabled={!clockedIn} className="gap-1.5 h-9 neumorph-btn">
                  <LogOut className="h-3.5 w-3.5" />退勤
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Focus / Todos */}
        {isVisible("ai-focus") && (
          <Card className="overflow-hidden">
            <CardContent className="h-full flex flex-col justify-between py-5 px-5 gap-4">
              <div className="flex items-start gap-3">
                <div className="neumorph-icon h-9 w-9 shrink-0">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold mb-1">今日のフォーカス</p>
                  <span className="text-xs text-muted-foreground leading-relaxed block">
                    {loading ? (
                      <Skeleton className="h-3 w-48" />
                    ) : (
                      <>
                        今日は<span className="text-primary font-semibold">{data?.todos.length ?? 0}件</span>の対応を優先してください。
                      </>
                    )}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <Skeleton className="h-4 w-4 rounded-full" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  ))
                ) : data?.todos.length ? (
                  data.todos.slice(0, 5).map((todo) => (
                    <div key={todo.id} className="flex items-center gap-2.5">
                      <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${todo.status === "completed" ? "bg-primary border-primary" : "border-muted-foreground/30"}`}>
                        {todo.status === "completed" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                      <span className={`text-xs flex-1 ${todo.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{todo.title}</span>
                      {todo.priority === "high" && todo.status !== "completed" && (
                        <Badge className="text-[9px] h-4 px-1 bg-rose-100 text-rose-600 hover:bg-rose-100">急</Badge>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">タスクはありません</p>
                )}
              </div>
              <Link href="/bi">
                <Button variant="outline" size="sm" className="w-full text-xs gap-1 h-7">
                  詳細を見る <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Workflow */}
        {isVisible("workflow") && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <div className="neumorph-icon h-7 w-7">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                </div>
                ワークフロー
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "承認待ち", href: "/workflow", color: "bg-amber-100 text-amber-800 hover:bg-amber-100", count: data?.workflow.pendingApprovals ?? 0 },
                { label: "申請中",   href: "/workflow", color: "", count: data?.workflow.submittedRequests ?? 0 },
                { label: "完了済み", href: "/workflow", color: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100", count: data?.workflow.completedRequests ?? 0 },
              ].map((item, i) => (
                <Link key={i} href={item.href}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/30 transition-colors">
                  <span className="text-xs">{item.label}</span>
                  {loading ? (
                    <Skeleton className="h-4 w-6" />
                  ) : (
                    <Badge className={`text-xs ${item.color || ""}`} variant={item.color ? "default" : "secondary"}>
                      {item.count}
                    </Badge>
                  )}
                </Link>
              ))}
              <Link href="/workflow">
                <Button variant="outline" size="sm" className="w-full text-xs gap-1 h-7 mt-1">
                  すべて見る <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Row 3: Announcements + Customers + Constructions ─────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Announcements */}
        {isVisible("mail") && (
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <div className="neumorph-icon h-7 w-7">
                  <Megaphone className="h-3.5 w-3.5 text-primary" />
                </div>
                お知らせ
              </CardTitle>
              {!loading && data?.announcements && data.announcements.length > 0 && (
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10 text-[10px] h-4 px-1.5">{data.announcements.length}</Badge>
              )}
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
                      <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                        {format(new Date(ann.published_at), "M/d", { locale: ja })}
                      </span>
                    </Link>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground px-2 py-2">お知らせはありません</p>
                )}
              </div>
              <Link href="/circulation">
                <Button variant="outline" size="sm" className="w-full mt-2 text-xs gap-1 h-7">
                  すべてのお知らせ <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Customers */}
        {isVisible("customers") && (
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">最近の顧客</CardTitle>
              <Link href="/crm">
                <Button variant="outline" size="sm" className="text-xs h-7 gap-1">
                  一覧 <ChevronRight className="h-3 w-3" />
                </Button>
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
        )}

        {/* Constructions */}
        {isVisible("constructions") && (
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">進行中の工事</CardTitle>
              <Link href="/constructions">
                <Button variant="outline" size="sm" className="text-xs h-7 gap-1">
                  一覧 <ChevronRight className="h-3 w-3" />
                </Button>
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
                  data.constructions.map((c, i: number) => {
                    const colors = ["bg-emerald-500", "bg-blue-500", "bg-violet-500", "bg-amber-500", "bg-rose-500"];
                    const barColor = colors[i % colors.length];
                    return (
                      <Link key={c.id} href={`/constructions/${c.id}`}
                        className="block px-2 py-2 rounded-lg hover:bg-white/30 transition-colors space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <HardHat className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-medium">{c.title}</span>
                          </div>
                          <span className="text-xs font-semibold tabular-nums">{c.progress}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                          <div
                            className={primaryRgb && i === 0 ? "" : barColor}
                            style={{
                              width: `${c.progress}%`,
                              height: "100%",
                              borderRadius: "9999px",
                              transition: "all 0.3s",
                              ...(primaryRgb && i === 0 ? { backgroundColor: kpiColor! } : {}),
                            }}
                          />
                        </div>
                      </Link>
                    );
                  })
                ) : (
                  <p className="text-xs text-muted-foreground px-2 py-2">進行中の工事はありません</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

    </div>
  );
}
