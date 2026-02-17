"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { useAuth } from "@/hooks/use-auth";
import {
  LogIn,
  LogOut,
  Calendar,
  Mail,
  FileText,
  TrendingUp,
  Users,
  Briefcase,
  HardHat,
  Clock,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function DashboardPage() {
  const { profile, isAdmin } = useAuth();
  const [clockedIn, setClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<Date | null>(null);

  const now = new Date();

  const handleClockIn = () => {
    setClockedIn(true);
    setClockInTime(new Date());
    toast.success("出勤しました", {
      description: format(new Date(), "HH:mm", { locale: ja }),
    });
  };

  const handleClockOut = () => {
    setClockedIn(false);
    toast.success("退勤しました", {
      description: format(new Date(), "HH:mm", { locale: ja }),
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title={`おはようございます${profile?.display_name ? `、${profile.display_name}さん` : ""}`}
        description={format(now, "yyyy年M月d日（EEEE）", { locale: ja })}
      />

      {/* AI Focus Area */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              今日は<span className="text-primary font-semibold">3件</span>の対応に集中しましょう
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              推定所要時間: 約2.5時間
            </p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 hidden sm:flex">
            詳細を見る
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Left sidebar widgets */}
        <div className="space-y-4">
          {/* Attendance */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                勤怠
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-center">
                <p className="text-2xl font-semibold tabular-nums">
                  {format(now, "HH:mm")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(now, "yyyy/MM/dd", { locale: ja })}
                </p>
              </div>
              {clockInTime && (
                <p className="text-xs text-center text-muted-foreground">
                  出勤: {format(clockInTime, "HH:mm")}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  onClick={handleClockIn}
                  disabled={clockedIn}
                  className="gap-1.5"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  出勤
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClockOut}
                  disabled={!clockedIn}
                  className="gap-1.5"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  退勤
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick links */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                メール
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { from: "田中太郎", subject: "工事現場の進捗について", time: "10:30" },
                  { from: "鈴木花子", subject: "契約書の確認依頼", time: "09:15" },
                  { from: "佐藤一郎", subject: "資材の見積もり", time: "昨日" },
                ].map((mail, i) => (
                  <Link
                    key={i}
                    href="/mail"
                    className="flex items-start gap-2 p-2 rounded-lg hover:bg-accent transition-colors group"
                  >
                    <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{mail.from}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {mail.subject}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {mail.time}
                    </span>
                  </Link>
                ))}
              </div>
              <Link href="/mail">
                <Button variant="ghost" size="sm" className="w-full mt-2 text-xs gap-1">
                  すべてのメール
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Workflow */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                ワークフロー
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Link
                  href="/workflow"
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors"
                >
                  <span className="text-xs">承認待ち</span>
                  <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-xs">
                    3件
                  </Badge>
                </Link>
                <Link
                  href="/workflow"
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors"
                >
                  <span className="text-xs">申請中</span>
                  <Badge variant="secondary" className="text-xs">2件</Badge>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main content area */}
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "売上",
                value: "¥115M",
                change: "+5.2%",
                positive: true,
                icon: TrendingUp,
              },
              {
                label: "粗利率",
                value: "22.8%",
                change: "+1.2%",
                positive: true,
                icon: BarChart3,
              },
              {
                label: "顧客数",
                value: "156",
                change: "+12",
                positive: true,
                icon: Users,
              },
              {
                label: "進行案件",
                value: "24",
                change: "-2",
                positive: false,
                icon: Briefcase,
              },
            ].map((kpi, i) => (
              <Card key={i} className="group hover:shadow-md transition-shadow">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">{kpi.label}</span>
                    <kpi.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xl font-semibold tabular-nums">{kpi.value}</p>
                  <p
                    className={`text-xs mt-1 ${
                      kpi.positive ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {kpi.change} 前月比
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Recent Customers */}
            <Card>
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">最近の顧客</CardTitle>
                <Link href="/crm">
                  <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                    一覧 <ChevronRight className="h-3 w-3" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: "山田太郎", company: "山田建設", status: "商談中", value: "¥5,000万" },
                    { name: "田中花子", company: "田中工務店", status: "見積提出", value: "¥3,200万" },
                    { name: "佐藤次郎", company: "個人", status: "初回面談", value: "¥1,800万" },
                  ].map((customer, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer"
                    >
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-medium text-primary">
                          {customer.name.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{customer.name}</p>
                        <p className="text-xs text-muted-foreground">{customer.company}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="secondary" className="text-xs mb-0.5">
                          {customer.status}
                        </Badge>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {customer.value}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Constructions */}
            <Card>
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">進行中の工事</CardTitle>
                <Link href="/constructions">
                  <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                    一覧 <ChevronRight className="h-3 w-3" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: "山田邸リノベーション", progress: 75 },
                    { name: "田中ビル外壁工事", progress: 45 },
                    { name: "佐藤邸新築工事", progress: 20 },
                  ].map((construction, i) => (
                    <div key={i} className="space-y-1.5 p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <HardHat className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{construction.name}</span>
                        </div>
                        <span className="text-xs font-medium tabular-nums">
                          {construction.progress}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${construction.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
