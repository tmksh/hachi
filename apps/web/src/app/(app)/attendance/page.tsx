"use client";

import { useState, useEffect, useCallback } from "react";
import { format, parseISO, addMonths, subMonths, differenceInMinutes } from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { LogIn, LogOut, Check, X, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getAttendanceEntries, clockIn, clockOut, approveAttendance, rejectAttendance, updateLeaveType } from "@/lib/actions/attendance";
import { getCompany } from "@/lib/actions/profiles";
import { AnalogClock } from "@/components/shared/analog-clock";

type Entry = Awaited<ReturnType<typeof getAttendanceEntries>>[number];

type AttSettings = {
  start_time?: string;
  end_time?: string;
  break_minutes?: number;
  leave_types?: string[];
};

function calcWorkMinutes(clockIn: string, clockOut: string, breakMins: number): number {
  const mins = differenceInMinutes(parseISO(clockOut), parseISO(clockIn)) - breakMins;
  return Math.max(0, mins);
}

function minutesToHM(mins: number): string {
  if (mins <= 0) return "-";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function calcScheduledMins(startTime: string, endTime: string, breakMins: number): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm) - breakMins);
}

export default function AttendancePage() {
  const { user, isAdmin } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [clockedIn, setClockedIn] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [now, setNow] = useState(new Date());
  const [attSettings, setAttSettings] = useState<AttSettings>({
    start_time: "09:00",
    end_time: "18:00",
    break_minutes: 60,
    leave_types: ["有給休暇", "夏季休暇", "慶弔休暇", "特別休暇", "代休", "半日休暇（午前）", "半日休暇（午後）"],
  });
  const [selectedLeaveType, setSelectedLeaveType] = useState("none");

  const month = format(currentDate, "yyyy-MM");
  const isCurrentMonth = format(new Date(), "yyyy-MM") === month;
  const scheduledMins = calcScheduledMins(
    attSettings.start_time ?? "09:00",
    attSettings.end_time ?? "18:00",
    attSettings.break_minutes ?? 60
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    getCompany().then((c) => {
      const att = (c.settings as Record<string, AttSettings>)?.attendance_settings;
      if (att) {
        setAttSettings({
          start_time: att.start_time ?? "09:00",
          end_time: att.end_time ?? "18:00",
          break_minutes: att.break_minutes ?? 60,
          leave_types: att.leave_types?.length ? att.leave_types : [
            "有給休暇", "夏季休暇", "慶弔休暇", "特別休暇", "代休", "半日休暇（午前）", "半日休暇（午後）",
          ],
        });
      }
    }).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    getAttendanceEntries({ month }).then(data => {
      setEntries(data as Entry[]);
      if (isCurrentMonth) {
        const today = format(new Date(), "yyyy-MM-dd");
        const todayEntry = data.find((e: Entry) => e.work_date === today && e.user_id === user?.id);
        if (todayEntry?.clock_in_at && !todayEntry?.clock_out_at) {
          setClockedIn(true);
          setSelectedLeaveType(todayEntry.leave_type ?? "none");
        } else {
          setClockedIn(false);
        }
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [month, user?.id, isCurrentMonth]);

  useEffect(() => { if (user) load(); }, [user, load]);

  const handleClockIn = async () => {
    try {
      await clockIn();
      setClockedIn(true);
      toast.success("出勤しました");
      load();
    } catch { toast.error("出勤に失敗"); }
  };

  const handleClockOut = async () => {
    try {
      // 退勤前に休暇区分を反映
      if (selectedLeaveType !== "none") {
        const today = format(new Date(), "yyyy-MM-dd");
        const todayEntry = entries.find(e => e.work_date === today && e.user_id === user?.id);
        if (todayEntry) await updateLeaveType(todayEntry.id, selectedLeaveType);
      }
      await clockOut();
      setClockedIn(false);
      toast.success("退勤しました");
      load();
    } catch { toast.error("退勤に失敗"); }
  };

  const handleApprove = async (id: string) => {
    try { await approveAttendance(id); toast.success("承認しました"); load(); } catch { toast.error("失敗"); }
  };
  const handleReject = async (id: string) => {
    try { await rejectAttendance(id); toast.success("却下しました"); load(); } catch { toast.error("失敗"); }
  };

  const myEntries = entries.filter(e => e.user_id === user?.id);
  const totalDays = myEntries.length;
  const approvedDays = myEntries.filter(e => e.status === "approved").length;
  const totalWorkMins = myEntries.reduce((sum, e) => {
    if (!e.clock_in_at || !e.clock_out_at) return sum;
    return sum + calcWorkMinutes(e.clock_in_at, e.clock_out_at, attSettings.break_minutes ?? 60);
  }, 0);
  const totalOvertimeMins = myEntries.reduce((sum, e) => {
    if (!e.clock_in_at || !e.clock_out_at) return sum;
    const worked = calcWorkMinutes(e.clock_in_at, e.clock_out_at, attSettings.break_minutes ?? 60);
    return sum + Math.max(0, worked - scheduledMins);
  }, 0);

  const leaveOptions = [
    { value: "none", label: "通常勤務" },
    ...(attSettings.leave_types ?? []).map(lt => ({ value: lt, label: lt })),
  ];

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
                {/* 所定時間インジケーター */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>所定 {attSettings.start_time} – {attSettings.end_time}</span>
                </div>
              </div>

              {/* 操作エリア */}
              <div className="flex flex-col justify-center gap-3 py-4 px-4 md:p-8 md:w-72">
                <p className="text-xs text-muted-foreground font-medium">打刻操作</p>
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">休暇区分</p>
                  <Select value={selectedLeaveType} onValueChange={setSelectedLeaveType}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {leaveOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleClockIn} disabled={clockedIn} size="lg" className="gap-2 w-full">
                  <LogIn className="h-5 w-5" />出勤
                </Button>
                <Button variant="outline" onClick={handleClockOut} disabled={!clockedIn} size="lg" className="gap-2 w-full">
                  <LogOut className="h-5 w-5" />退勤
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 月次サマリー */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "出勤日数", value: `${totalDays}日` },
          { label: "承認済", value: `${approvedDays}日`, highlight: true },
          { label: "実労働時間", value: minutesToHM(totalWorkMins) },
          { label: "残業時間", value: minutesToHM(totalOvertimeMins), warn: totalOvertimeMins > 0 },
        ].map(({ label, value, highlight, warn }) => (
          <Card key={label} variant="inset">
            <CardContent className="px-4 py-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`text-lg font-bold tabular-nums mt-0.5 ${highlight ? "text-emerald-600" : warn ? "text-amber-600" : ""}`}>
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 勤怠記録 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">勤怠記録</h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(d => subMonths(d, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium tabular-nums w-20 text-center">
              {format(currentDate, "yyyy年M月", { locale: ja })}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(d => addMonths(d, 1))} disabled={isCurrentMonth}>
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
                  <TableHead>実労働</TableHead>
                  <TableHead>残業</TableHead>
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
                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      </TableRow>
                    ))
                  : entries.length === 0
                  ? (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 9 : 7} className="text-center py-10 text-muted-foreground">
                          {format(currentDate, "yyyy年M月", { locale: ja })}の記録はありません
                        </TableCell>
                      </TableRow>
                    )
                  : entries.map((e) => {
                      const worked = e.clock_in_at && e.clock_out_at
                        ? calcWorkMinutes(e.clock_in_at, e.clock_out_at, attSettings.break_minutes ?? 60)
                        : null;
                      const overtime = worked !== null ? Math.max(0, worked - scheduledMins) : null;
                      return (
                        <TableRow key={e.id} className="glass-row">
                          <TableCell className="text-sm tabular-nums">{e.work_date}</TableCell>
                          {isAdmin && <TableCell className="text-sm">{(e as Entry & { user?: { display_name: string } }).user?.display_name ?? "-"}</TableCell>}
                          <TableCell className="text-sm tabular-nums">{e.clock_in_at ? format(parseISO(e.clock_in_at), "HH:mm") : "-"}</TableCell>
                          <TableCell className="text-sm tabular-nums">{e.clock_out_at ? format(parseISO(e.clock_out_at), "HH:mm") : "-"}</TableCell>
                          <TableCell className="text-sm tabular-nums">{worked !== null ? minutesToHM(worked) : "-"}</TableCell>
                          <TableCell className="text-sm tabular-nums">
                            {overtime !== null && overtime > 0
                              ? <span className="text-amber-600 font-medium">{minutesToHM(overtime)}</span>
                              : <span className="text-muted-foreground">-</span>
                            }
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {e.leave_type && e.leave_type !== "none" ? e.leave_type : "-"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              e.status === "approved"
                                ? "text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                : e.status === "rejected"
                                ? "text-xs bg-red-100 text-red-600 hover:bg-red-100"
                                : "text-xs bg-amber-100 text-amber-700 hover:bg-amber-100"
                            }>
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
                      );
                    })}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
