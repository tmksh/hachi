"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { format, parseISO, addMonths, subMonths, differenceInMinutes } from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { LogIn, LogOut, Check, X, ChevronLeft, ChevronRight, Clock, Sun, Coffee } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getAttendanceEntries, clockIn, clockOut, approveAttendance, rejectAttendance, updateLeaveType, recordLeaveDay } from "@/lib/actions/attendance";
import type { Company } from "@/lib/database.types";
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

/** 終日休暇 (打刻不要) かを判定。半日休暇は「打刻あり」扱い。 */
function isFullDayLeave(leaveType: string): boolean {
  if (leaveType === "none" || !leaveType) return false;
  if (leaveType.includes("半日")) return false;
  if (leaveType === "morning_leave" || leaveType === "afternoon_leave") return false;
  return true;
}

const DEFAULT_LEAVE_TYPES = ["有給休暇", "夏季休暇", "慶弔休暇", "特別休暇", "代休", "半日休暇（午前）", "半日休暇（午後）"];

function attSettingsFromCompany(c: Company | null): AttSettings {
  const att = (c?.settings as Record<string, AttSettings> | undefined)?.attendance_settings;
  if (!att) {
    return { start_time: "09:00", end_time: "18:00", break_minutes: 60, leave_types: DEFAULT_LEAVE_TYPES };
  }
  return {
    start_time: att.start_time ?? "09:00",
    end_time: att.end_time ?? "18:00",
    break_minutes: att.break_minutes ?? 60,
    leave_types: att.leave_types?.length ? att.leave_types : DEFAULT_LEAVE_TYPES,
  };
}

function todayClockState(entries: Entry[], userId: string | undefined) {
  const todayJST = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()).replace(/\//g, "-");
  const todayEntry = entries.find((e) => e.work_date === todayJST && e.user_id === userId);
  if (todayEntry?.clock_in_at && !todayEntry?.clock_out_at) {
    return { clockedIn: true, leaveType: todayEntry.leave_type ?? "none" };
  }
  return { clockedIn: false, leaveType: "none" };
}

export function AttendanceClient({
  initialCompany,
  initialEntries,
  initialUserId,
}: {
  initialCompany: Company | null;
  initialEntries: Entry[];
  initialUserId: string | null;
}) {
  const { user, isAdmin } = useAuth();
  const initialClock = todayClockState(initialEntries, initialUserId ?? user?.id);
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [loading, setLoading] = useState(false);
  const [clockedIn, setClockedIn] = useState(initialClock.clockedIn);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [now, setNow] = useState(new Date());
  const [attSettings, setAttSettings] = useState<AttSettings>(attSettingsFromCompany(initialCompany));
  const [selectedLeaveType, setSelectedLeaveType] = useState(initialClock.leaveType);

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

  const load = useCallback(() => {
    setLoading(true);
    getAttendanceEntries({ month }).then(data => {
      setEntries(data as Entry[]);
      if (isCurrentMonth) {
        const todayJST = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replace(/\//g, "-");
        const todayEntry = data.find((e: Entry) => e.work_date === todayJST && e.user_id === user?.id);
        if (todayEntry?.clock_in_at && !todayEntry?.clock_out_at) {
          setClockedIn(true);
          setSelectedLeaveType(todayEntry.leave_type ?? "none");
        } else {
          setClockedIn(false);
        }
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [month, user?.id, isCurrentMonth]);

  const skippedInitialLoad = useRef(true);
  useEffect(() => {
    if (!user) return;
    if (skippedInitialLoad.current && month === format(new Date(), "yyyy-MM")) {
      skippedInitialLoad.current = false;
      return;
    }
    load();
  }, [user, load, month]);

  const handleClockIn = async () => {
    try {
      await clockIn();
      setClockedIn(true);
      toast.success("出勤しました");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "出勤に失敗しました");
    }
  };

  const handleClockOut = async () => {
    try {
      // 退勤前に休暇区分を反映
      if (selectedLeaveType !== "none") {
        const todayJST = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replace(/\//g, "-");
        const todayEntry = entries.find(e => e.work_date === todayJST && e.user_id === user?.id);
        if (todayEntry) await updateLeaveType(todayEntry.id, selectedLeaveType);
      }
      await clockOut();
      setClockedIn(false);
      toast.success("退勤しました");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "退勤に失敗しました");
    }
  };

  const handleRecordLeave = async () => {
    try {
      await recordLeaveDay(selectedLeaveType);
      toast.success(`${selectedLeaveType}として記録しました`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "休暇の記録に失敗しました");
    }
  };

  const handleApprove = async (id: string) => {
    try { await approveAttendance(id); toast.success("承認しました"); load(); } catch { toast.error("失敗"); }
  };
  const handleReject = async (id: string) => {
    try { await rejectAttendance(id); toast.success("却下しました"); load(); } catch { toast.error("失敗"); }
  };

  const todayJST = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replace(/\//g, "-");
  const todayEntry = entries.find(e => e.work_date === todayJST && e.user_id === user?.id);
  const isOnLeaveToday = !!todayEntry?.leave_type && isFullDayLeave(todayEntry.leave_type);
  const isLeaveModeSelected = isFullDayLeave(selectedLeaveType);

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
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="勤怠管理" description="出退勤の管理と記録" />

      {/* 打刻カード＋月次サマリー */}
      <Card className="overflow-hidden py-0">
        <CardContent className="p-0">
          <div className="flex flex-col md:flex-row md:items-center">
            {/* 時計エリア */}
            {isCurrentMonth && (
              <div className="flex items-center gap-5 px-6 py-5 bg-gradient-to-br from-primary/5 to-transparent border-b md:border-b-0 md:border-r border-border/60 shrink-0">
                <AnalogClock size={96} />
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full shrink-0 transition-colors ${clockedIn ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/40"}`} />
                    <span className={`text-sm font-medium ${clockedIn ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {clockedIn ? "勤務中" : "未出勤"}
                    </span>
                  </div>
                  <p className="text-3xl font-bold tabular-nums tracking-tight leading-none">{format(now, "HH:mm")}</p>
                  <p className="text-sm text-muted-foreground whitespace-nowrap">{format(now, "yyyy年M月d日（EEE）", { locale: ja })}</p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span className="whitespace-nowrap">所定 {attSettings.start_time} – {attSettings.end_time}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 操作エリア */}
            {isCurrentMonth && (
              <div className="flex flex-col justify-center gap-2 px-4 py-4 border-b md:border-b-0 md:border-r border-border/60 md:w-56 shrink-0">
                <div className="space-y-1.5">
                  <p className="text-[11px] text-muted-foreground font-medium">勤務区分</p>
                  <Select value={selectedLeaveType} onValueChange={setSelectedLeaveType} disabled={isOnLeaveToday}>
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

                {isOnLeaveToday ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-center gap-2 dark:bg-amber-950/30 dark:border-amber-900">
                    <Sun className="h-4 w-4 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400">本日は休暇です</p>
                      <p className="text-[11px] text-amber-600/80">{todayEntry?.leave_type}</p>
                    </div>
                  </div>
                ) : isLeaveModeSelected ? (
                  <Button onClick={handleRecordLeave} size="sm" className="gap-1.5 w-full">
                    <Coffee className="h-4 w-4" />休暇として記録
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button onClick={handleClockIn} disabled={clockedIn} size="sm" className="gap-1.5 flex-1">
                      <LogIn className="h-4 w-4" />出勤
                    </Button>
                    <Button variant="outline" onClick={handleClockOut} disabled={!clockedIn} size="sm" className="gap-1.5 flex-1">
                      <LogOut className="h-4 w-4" />退勤
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* 月次サマリー */}
            <div
              className={`grid grid-cols-2 gap-px bg-border/40 ${
                isCurrentMonth ? "md:grid-cols-4 md:shrink-0 md:ml-auto" : "flex-1 md:grid-cols-4"
              }`}
            >
              {[
                { label: "出勤日数",    value: `${totalDays}日`,                 cls: "" },
                { label: "承認済",      value: `${approvedDays}日`,              cls: "text-emerald-600" },
                { label: "実労働時間",  value: minutesToHM(totalWorkMins),       cls: "" },
                { label: "残業時間",    value: minutesToHM(totalOvertimeMins),   cls: totalOvertimeMins > 0 ? "text-amber-600" : "" },
              ].map(({ label, value, cls }) => (
                <div key={label} className="bg-card px-3 py-2.5 md:px-4 md:py-3 flex flex-col justify-center md:min-w-[5.5rem]">
                  <p className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">{label}</p>
                  <p className={`text-base font-bold tabular-nums mt-0.5 ${cls}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 勤怠記録 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">勤怠記録</h2>
          <div className="flex items-center gap-0.5 ml-auto">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(d => subMonths(d, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium tabular-nums shrink-0 whitespace-nowrap text-center min-w-[6.5rem] px-1">
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
                      const isLeave = !!e.leave_type && isFullDayLeave(e.leave_type);
                      const worked = e.clock_in_at && e.clock_out_at
                        ? calcWorkMinutes(e.clock_in_at, e.clock_out_at, attSettings.break_minutes ?? 60)
                        : null;
                      const overtime = worked !== null ? Math.max(0, worked - scheduledMins) : null;
                      return (
                        <TableRow key={e.id} className={`glass-row ${isLeave ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}>
                          <TableCell className="text-sm tabular-nums">{e.work_date}</TableCell>
                          {isAdmin && <TableCell className="text-sm">{(e as Entry & { user?: { display_name: string } }).user?.display_name ?? "-"}</TableCell>}
                          <TableCell className="text-sm tabular-nums">
                            {isLeave ? <span className="text-amber-600 text-xs">休暇</span> : e.clock_in_at ? format(parseISO(e.clock_in_at), "HH:mm") : "-"}
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">
                            {isLeave ? <span className="text-amber-600 text-xs">休暇</span> : e.clock_out_at ? format(parseISO(e.clock_out_at), "HH:mm") : "-"}
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">{isLeave ? <span className="text-muted-foreground">-</span> : worked !== null ? minutesToHM(worked) : "-"}</TableCell>
                          <TableCell className="text-sm tabular-nums">
                            {isLeave ? <span className="text-muted-foreground">-</span> : overtime !== null && overtime > 0
                              ? <span className="text-amber-600 font-medium">{minutesToHM(overtime)}</span>
                              : <span className="text-muted-foreground">-</span>
                            }
                          </TableCell>
                          <TableCell>
                            {isLeave ? (
                              <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 border-0 hover:bg-amber-100">
                                {e.leave_type}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {e.leave_type && e.leave_type !== "none" ? e.leave_type : "-"}
                              </span>
                            )}
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
