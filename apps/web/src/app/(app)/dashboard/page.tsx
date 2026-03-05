"use client";

import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWidgets } from "@/hooks/use-widgets";
import { WidgetCustomizer } from "@/components/shared/widget-customizer";
import {
  LogIn,
  LogOut,
  Mail,
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

export default function DashboardPage() {
  const [clockedIn, setClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const { widgets, hydrated, toggleVisible, moveUp, moveDown, reset } = useWidgets();

  const now = new Date();

  const handleClockIn = () => {
    setClockedIn(true);
    setClockInTime(new Date());
    toast.success("出勤しました", { description: format(new Date(), "HH:mm", { locale: ja }) });
  };
  const handleClockOut = () => {
    setClockedIn(false);
    toast.success("退勤しました", { description: format(new Date(), "HH:mm", { locale: ja }) });
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "売上",     value: "¥115M",  change: "+5.2%", positive: true,  icon: TrendingUp },
            { label: "粗利率",   value: "22.8%",  change: "+1.2%", positive: true,  icon: BarChart3 },
            { label: "顧客数",   value: "156",    change: "+12",   positive: true,  icon: Users },
            { label: "進行案件", value: "24",     change: "-2",    positive: false, icon: Briefcase },
          ].map((kpi, i) => (
            <Card key={i} className="stat-card transition-[box-shadow,background-color] duration-200">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{kpi.label}</span>
                  <kpi.icon className="h-4 w-4 text-muted-foreground/60" />
                </div>
                <p className="text-2xl font-bold tabular-nums tracking-tight">{kpi.value}</p>
                <p className={`text-xs mt-1 font-medium ${kpi.positive ? "text-emerald-600" : "text-rose-500"}`}>
                  {kpi.change} <span className="text-muted-foreground font-normal">前月比</span>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Row 2: Attendance (left) + AI focus + Workflow (right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_220px] gap-4">

        {/* Attendance */}
        {isVisible("attendance") && (
          <Card className="overflow-hidden">
            <div className={`h-1 w-full transition-colors duration-500 ${clockedIn ? "bg-emerald-400" : "bg-muted/60"}`} />
            <CardContent className="pt-4 pb-5 px-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full transition-all duration-500 ${clockedIn ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" : "bg-muted-foreground/30"}`} />
                  <span className="text-xs font-medium text-muted-foreground">{clockedIn ? "勤務中" : "未出勤"}</span>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{format(now, "M月d日（EEE）", { locale: ja })}</span>
              </div>
              <p className="text-4xl font-bold tabular-nums tracking-tight leading-none text-center py-3">
                {format(now, "HH:mm")}
              </p>
              <p className="text-xs text-muted-foreground text-center mb-4 tabular-nums">
                {clockInTime ? `出勤 ${format(clockInTime, "HH:mm")}〜` : "出勤打刻をしてください"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" onClick={handleClockIn} disabled={clockedIn} className="gap-1.5 h-9">
                  <LogIn className="h-3.5 w-3.5" />出勤
                </Button>
                <Button size="sm" variant="outline" onClick={handleClockOut} disabled={!clockedIn} className="gap-1.5 h-9">
                  <LogOut className="h-3.5 w-3.5" />退勤
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Focus */}
        {isVisible("ai-focus") && (
          <Card className="overflow-hidden">
            <CardContent className="h-full flex flex-col justify-between py-5 px-5 gap-4">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold mb-1">今日のフォーカス</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    今日は<span className="text-primary font-semibold">3件</span>の対応を優先してください。
                    推定所要時間は約<span className="font-medium text-foreground">2.5時間</span>です。
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { label: "見積書提出（佐藤邸）", done: false, urgent: true },
                  { label: "田中ビル進捗確認",    done: true,  urgent: false },
                  { label: "安全点検レポート",     done: false, urgent: false },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${item.done ? "bg-primary border-primary" : "border-muted-foreground/30"}`}>
                      {item.done && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    <span className={`text-xs flex-1 ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.label}</span>
                    {item.urgent && !item.done && (
                      <Badge className="text-[9px] h-4 px-1 bg-rose-100 text-rose-600 hover:bg-rose-100">急</Badge>
                    )}
                  </div>
                ))}
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
                <FileText className="h-4 w-4 text-primary" />
                ワークフロー
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "承認待ち", count: "3件", color: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
                { label: "申請中",   count: "2件", color: "" },
                { label: "完了済み", count: "12件", color: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" },
              ].map((item, i) => (
                <Link key={i} href="/workflow"
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/30 transition-colors">
                  <span className="text-xs">{item.label}</span>
                  <Badge className={`text-xs ${item.color || ""}`} variant={item.color ? "default" : "secondary"}>
                    {item.count}
                  </Badge>
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

      {/* ── Row 3: Mail + Customers + Constructions ─────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Mail */}
        {isVisible("mail") && (
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                メール
              </CardTitle>
              <Badge className="bg-primary/10 text-primary hover:bg-primary/10 text-[10px] h-4 px-1.5">3</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {[
                  { from: "田中太郎", subject: "工事現場の進捗について", time: "10:30", unread: true },
                  { from: "鈴木花子", subject: "契約書の確認依頼",       time: "09:15", unread: true },
                  { from: "佐藤一郎", subject: "資材の見積もり",         time: "昨日",  unread: false },
                ].map((mail, i) => (
                  <Link key={i} href="/mail"
                    className="flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-white/30 transition-colors group">
                    <div className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${mail.unread ? "bg-primary" : "bg-transparent"}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs truncate ${mail.unread ? "font-semibold" : "font-medium"}`}>{mail.from}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{mail.subject}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{mail.time}</span>
                  </Link>
                ))}
              </div>
              <Link href="/mail">
                <Button variant="outline" size="sm" className="w-full mt-2 text-xs gap-1 h-7">
                  すべてのメール <ChevronRight className="h-3 w-3" />
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
                {[
                  { id: "1", name: "山田太郎", company: "山田建設",   status: "商談中",   value: "¥5,000万" },
                  { id: "2", name: "田中花子", company: "田中工務店", status: "見積提出", value: "¥3,200万" },
                  { id: "3", name: "佐藤次郎", company: "個人",       status: "初回面談", value: "¥1,800万" },
                ].map((customer) => (
                  <Link key={customer.id} href={`/crm/${customer.id}`}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/30 transition-colors">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-semibold text-primary">{customer.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{customer.name}</p>
                      <p className="text-[11px] text-muted-foreground">{customer.company}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 mb-0.5 block">{customer.status}</Badge>
                      <p className="text-[10px] text-muted-foreground tabular-nums">{customer.value}</p>
                    </div>
                  </Link>
                ))}
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
                {[
                  { id: "1", name: "山田邸リノベーション", progress: 75, color: "bg-emerald-500" },
                  { id: "2", name: "田中ビル外壁工事",     progress: 45, color: "bg-blue-500" },
                  { id: "3", name: "佐藤邸新築工事",       progress: 20, color: "bg-violet-500" },
                ].map((c) => (
                  <Link key={c.id} href={`/constructions/${c.id}`}
                    className="block px-2 py-2 rounded-lg hover:bg-white/30 transition-colors space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <HardHat className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium">{c.name}</span>
                      </div>
                      <span className="text-xs font-semibold tabular-nums">{c.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${c.color}`} style={{ width: `${c.progress}%` }} />
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

    </div>
  );
}
