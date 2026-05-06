"use client";

import { useState, useEffect, useCallback } from "react";
import { format, parseISO, addMonths, subMonths } from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { LogIn, LogOut, Check, X, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getAttendanceEntries, clockIn, clockOut, approveAttendance, rejectAttendance } from "@/lib/actions/attendance";
import { AnalogClock } from "@/components/shared/analog-clock";

type Entry = Awaited<ReturnType<typeof getAttendanceEntries>>[number];
const LEAVE_LABELS: Record<string, string> = { none: "-", overtime: "残業", dayoff: "休日", morning_leave: "午前休", afternoon_leave: "午後休" };

export default function AttendancePage() {
  const { user, isAdmin } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [clockedIn, setClockedIn] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [now, setNow] = useState(new Date());

  const month = format(currentDate, "yyyy-MM");
  const isCurrentMonth = format(new Date(), "yyyy-MM") === month;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    getAttendanceEntries({ month }).then(data => {
      setEntries(data as Entry[]);
      if (isCurrentMonth) {
        const today = format(new Date(), "yyyy-MM-dd");
        const todayEntry = data.find((e: Entry) => e.work_date === today && e.user_id === user?.id);
        if (todayEntry?.clock_in_at && !todayEntry?.clock_out_at) setClockedIn(true);
        else setClockedIn(false);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [month, user?.id, isCurrentMonth]);

  useEffect(() => { if (user) load(); }, [user, load]);

  const handleClockIn = async () => { try { await clockIn(); setClockedIn(true); toast.success("出勤しました"); load(); } catch { toast.error("出勤に失敗"); } };
  const handleClockOut = async () => { try { await clockOut(); setClockedIn(false); toast.success("退勤しました"); load(); } catch { toast.error("退勤に失敗"); } };
  const handleApprove = async (id: string) => { try { await approveAttendance(id); toast.success("承認しました"); load(); } catch { toast.error("失敗"); } };
  const handleReject = async (id: string) => { try { await rejectAttendance(id); toast.success("却下しました"); load(); } catch { toast.error("失敗"); } };

  const totalDays = entries.filter(e => e.user_id === user?.id).length;
  const approvedDays = entries.filter(e => e.user_id === user?.id && e.status === "approved").length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="勤怠管理" description="出退勤の管理と記録" />

      {/* 打刻カード */}
      {isCurrentMonth && (
        <Card className="overflow-hidden py-0">
          <CardContent className="p-0">
            <div className="flex flex-col md:flex-row">
              {/* 時計エリア */}
              <div className="flex flex-col items-center justify-center gap-3 md:gap-4 py-5 px-4 md:p-8 flex-1 bg-gradient-to-br from-primary/5 to-transparent border-b md:border-b-0 md:border-r border-border/60">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full transition-colors ${clockedIn ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/40"}`} />
                  <span className={`text-xs font-medium ${clockedIn ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {clockedIn ? "勤務中" : "未出勤"}
                  </span>
                </div>
                <AnalogClock size={110} />
                <div className="text-center">
                  <p className="text-2xl md:text-3xl font-bold tabular-nums tracking-tight">{format(now, "HH:mm")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{format(now, "yyyy年M月d日（EEE）", { locale: ja })}</p>
                </div>
              </div>
              {/* 操作エリア */}
              <div className="flex flex-col justify-center gap-2 md:gap-3 py-4 px-4 md:p-8 md:w-64">
                <p className="text-xs text-muted-foreground font-medium">打刻操作</p>
                <Button
                  onClick={handleClockIn}
                  disabled={clockedIn}
                  size="lg"
                  className="gap-2 w-full"
                >
                  <LogIn className="h-5 w-5" />出勤
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClockOut}
                  disabled={!clockedIn}
                  size="lg"
                  className="gap-2 w-full"
                >
                  <LogOut className="h-5 w-5" />退勤
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 勤怠記録 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold">勤怠記録</h2>
            {!loading && (
              <div className="flex gap-1.5">
                <Badge variant="secondary" className="text-xs font-normal">出勤 {totalDays}日</Badge>
                <Badge className="text-xs font-normal bg-emerald-100 text-emerald-700 hover:bg-emerald-100">承認済 {approvedDays}日</Badge>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(d => subMonths(d, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium tabular-nums w-20 text-center">
              {format(currentDate, "yyyy年M月", { locale: ja })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCurrentDate(d => addMonths(d, 1))}
              disabled={isCurrentMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isCurrentMonth && (
              <Button variant="outline" size="sm" className="h-7 text-xs ml-1" onClick={() => setCurrentDate(new Date())}>
                今月
              </Button>
            )}
          </div>
        </div>

        <Card variant="inset">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日付</TableHead>
                  {isAdmin && <TableHead>社員</TableHead>}
                  <TableHead>出勤</TableHead>
                  <TableHead>退勤</TableHead>
                  <TableHead>区分</TableHead>
                  <TableHead>ステータス</TableHead>
                  {isAdmin && <TableHead>操作</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        {isAdmin && <TableCell><Skeleton className="h-4 w-24" /></TableCell>}
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      </TableRow>
                    ))
                  : entries.length === 0
                  ? (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 7 : 5} className="text-center py-10 text-muted-foreground">
                          {format(currentDate, "yyyy年M月", { locale: ja })}の記録はありません
                        </TableCell>
                      </TableRow>
                    )
                  : entries.map((e) => (
                      <TableRow key={e.id} className="glass-row">
                        <TableCell className="text-sm tabular-nums">{e.work_date}</TableCell>
                        {isAdmin && <TableCell className="text-sm">{(e as Entry & { user?: { display_name: string } }).user?.display_name ?? "-"}</TableCell>}
                        <TableCell className="text-sm tabular-nums">{e.clock_in_at ? format(parseISO(e.clock_in_at), "HH:mm") : "-"}</TableCell>
                        <TableCell className="text-sm tabular-nums">{e.clock_out_at ? format(parseISO(e.clock_out_at), "HH:mm") : "-"}</TableCell>
                        <TableCell><span className="text-xs text-muted-foreground">{LEAVE_LABELS[e.leave_type ?? "none"]}</span></TableCell>
                        <TableCell>
                          <Badge
                            className={
                              e.status === "approved"
                                ? "text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                : e.status === "rejected"
                                ? "text-xs bg-red-100 text-red-600 hover:bg-red-100"
                                : "text-xs bg-amber-100 text-amber-700 hover:bg-amber-100"
                            }
                          >
                            {e.status === "approved" ? "承認" : e.status === "rejected" ? "却下" : "保留"}
                          </Badge>
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            {e.status === "pending" && (
                              <div className="flex gap-1">
                                <Button size="sm" variant="outline" onClick={() => handleApprove(e.id)} className="h-7 px-2"><Check className="h-3 w-3" /></Button>
                                <Button size="sm" variant="outline" onClick={() => handleReject(e.id)} className="h-7 px-2"><X className="h-3 w-3" /></Button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
