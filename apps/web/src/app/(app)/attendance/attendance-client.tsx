"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { LogIn, LogOut, Check, X, ChevronLeft, ChevronRight, Clock, Sun, Coffee, Pencil, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { clockIn, clockOut, approveAttendance, rejectAttendance, updateLeaveType, recordLeaveDay, upsertAttendanceEntry } from "@/lib/actions/attendance";
import { fetchAttendanceEntriesRange, LIST_STALE_MS, QK } from "@/lib/queries/portal";
import { createClient } from "@/lib/supabase/client";
import type { Company } from "@/lib/database.types";
import { AnalogClock } from "@/components/shared/analog-clock";
import {
  parseDateKey,
  periodContaining,
  periodDates,
  periodLabel,
  shiftPeriod,
  type AttendancePeriod,
} from "@/lib/attendance-period";

type Entry = Awaited<ReturnType<typeof fetchAttendanceEntriesRange>>[number];

type AttSettings = {
  start_time?: string;
  end_time?: string;
  break_minutes?: number;
  leave_types?: string[];
  closing_day?: number;
};

type MemberOption = { id: string; display_name: string | null; department?: string | null };

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

export function closingDayFromCompany(c: Company | null): number {
  const att = (c?.settings as Record<string, AttSettings> | undefined)?.attendance_settings;
  const v = Number(att?.closing_day ?? 0);
  return Number.isFinite(v) ? Math.min(28, Math.max(0, Math.floor(v))) : 0;
}

function isoToHM(iso: string | null | undefined): string {
  return iso ? format(parseISO(iso), "HH:mm") : "";
}

function calcWorkMinutes(clockIn: string, clockOut: string, breakMins: number): number {
  const rawMins = differenceInMinutes(parseISO(clockOut), parseISO(clockIn));
  if (rawMins <= 0) return 0;
  // 実働時間が休憩時間以下の場合は控除しない（短時間・テスト打刻で負にならないよう）
  if (rawMins <= breakMins) return rawMins;
  return rawMins - breakMins;
}

function minutesToHM(mins: number): string {
  if (mins < 0) return "-";
  if (mins === 0) return "0h";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
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
    closing_day: att.closing_day ?? 0,
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
  const queryClient = useQueryClient();
  const initialClock = todayClockState(initialEntries, initialUserId ?? user?.id);
  const [now, setNow] = useState(new Date());
  const attSettings = attSettingsFromCompany(initialCompany);
  const closingDay = closingDayFromCompany(initialCompany);
  const [selectedLeaveType, setSelectedLeaveType] = useState(initialClock.leaveType);

  // 締め期間（会社設定の締め日で区切る）
  const todayPeriod = useMemo(() => periodContaining(new Date(), closingDay), [closingDay]);
  const [period, setPeriod] = useState<AttendancePeriod>(todayPeriod);
  const isCurrentMonth = period.start === todayPeriod.start;

  // 表示対象メンバー（管理者のみ切替可。既定は自分）
  const [targetUserId, setTargetUserId] = useState<string>(initialUserId ?? user?.id ?? "");
  const effectiveTargetId = targetUserId || user?.id || "";
  const { data: members = [] } = useQuery({
    queryKey: ["attendance", "members"],
    queryFn: async () => {
      const { data } = await createClient()
        .from("profiles")
        .select("id, display_name, department")
        .order("display_name");
      return (data ?? []) as MemberOption[];
    },
    staleTime: 5 * 60_000,
    enabled: !!user?.id && isAdmin,
  });

  const { data: entries = [], isPending: loading } = useQuery({
    queryKey: QK.attendanceRange(period.start, period.end, "all"),
    queryFn: () => fetchAttendanceEntriesRange(period.start, period.end),
    staleTime: LIST_STALE_MS,
    initialData: isCurrentMonth ? initialEntries : undefined,
    enabled: !!user?.id,
  });
  const clockedIn = todayClockState(entries, user?.id).clockedIn;

  // 修正入力ダイアログ
  const [editing, setEditing] = useState<{ date: string; entry: Entry | null } | null>(null);
  const [editIn, setEditIn] = useState("");
  const [editOut, setEditOut] = useState("");
  const [editLeave, setEditLeave] = useState("none");
  const [editReason, setEditReason] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const openEdit = (date: string, entry: Entry | null) => {
    setEditing({ date, entry });
    setEditIn(isoToHM(entry?.clock_in_at));
    setEditOut(isoToHM(entry?.clock_out_at));
    setEditLeave(entry?.leave_type && entry.leave_type !== "none" ? entry.leave_type : "none");
    setEditReason("");
  };

  const saveEdit = async () => {
    if (!editing) return;
    setEditSaving(true);
    try {
      await upsertAttendanceEntry({
        work_date: editing.date,
        user_id: effectiveTargetId,
        clock_in: editIn || null,
        clock_out: editOut || null,
        leave_type: editLeave,
        reason: editReason,
      });
      toast.success(`${editing.date} の勤怠を保存しました`);
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setEditSaving(false);
    }
  };
  const scheduledMins = calcScheduledMins(
    attSettings.start_time ?? "09:00",
    attSettings.end_time ?? "18:00",
    attSettings.break_minutes ?? 60
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const load = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["attendance"] }),
    queryClient.invalidateQueries({ queryKey: ["today-attendance"] }),
  ]);

  const handleClockIn = async () => {
    try {
      await clockIn();
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
  const clockedOut = !!todayEntry?.clock_out_at;
  const isOnLeaveToday = !!todayEntry?.leave_type && isFullDayLeave(todayEntry.leave_type);
  const isLeaveModeSelected = isFullDayLeave(selectedLeaveType);

  const myEntries = entries.filter(e => e.user_id === effectiveTargetId);
  const totalDays = myEntries.filter(e => e.clock_in_at || (e.leave_type && e.leave_type !== "none")).length;
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
                      {clockedOut ? "退勤済" : clockedIn ? "勤務中" : "未出勤"}
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
              <div className="flex flex-col justify-center gap-2.5 px-4 py-4 border-b md:border-b-0 md:border-r border-border/60 md:w-60 shrink-0">
                {/* 勤務区分セレクト */}
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">勤務区分</p>
                  <Select value={selectedLeaveType} onValueChange={setSelectedLeaveType} disabled={isOnLeaveToday || clockedOut}>
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

                {/* 今日の打刻サマリー */}
                {todayEntry?.clock_in_at && !isOnLeaveToday && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs tabular-nums">
                    <LogIn className="h-3 w-3 text-emerald-500 shrink-0" />
                    <span className="font-medium">{format(parseISO(todayEntry.clock_in_at), "HH:mm")}</span>
                    <span className="text-muted-foreground/50">→</span>
                    {todayEntry.clock_out_at ? (
                      <>
                        <LogOut className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="font-medium">{format(parseISO(todayEntry.clock_out_at), "HH:mm")}</span>
                        <span className="ml-auto text-muted-foreground">
                          {minutesToHM(calcWorkMinutes(todayEntry.clock_in_at, todayEntry.clock_out_at, attSettings.break_minutes ?? 60))}
                        </span>
                      </>
                    ) : (
                      <span className="ml-auto text-emerald-600 font-medium animate-pulse">
                        {minutesToHM(Math.max(0, differenceInMinutes(now, parseISO(todayEntry.clock_in_at))))}
                      </span>
                    )}
                  </div>
                )}

                {/* アクションボタン */}
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
                    <Button
                      onClick={handleClockIn}
                      disabled={clockedIn || clockedOut}
                      size="sm"
                      variant={clockedIn ? "outline" : "default"}
                      className="gap-1.5 flex-1"
                    >
                      <LogIn className="h-4 w-4" />出勤
                    </Button>
                    <Button
                      onClick={handleClockOut}
                      disabled={!clockedIn}
                      size="sm"
                      variant={clockedIn ? "default" : "outline"}
                      className={`gap-1.5 flex-1 ${clockedIn ? "bg-rose-500 hover:bg-rose-600 border-rose-500" : ""}`}
                    >
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
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            勤怠記録
          </h2>
          {closingDay > 0 && (
            <span className="text-[11px] text-muted-foreground">{closingDay}日締め</span>
          )}
          {isAdmin && members.length > 0 && (
            <Select value={effectiveTargetId} onValueChange={setTargetUserId}>
              <SelectTrigger className="h-7 w-44 text-xs">
                <SelectValue placeholder="社員を選択" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.display_name ?? "（名称未設定）"}{m.id === user?.id ? "（自分）" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center gap-0.5 ml-auto">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPeriod(p => shiftPeriod(p, -1, closingDay))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium tabular-nums shrink-0 whitespace-nowrap text-center min-w-[6.5rem] px-1">
              {periodLabel(period, closingDay)}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPeriod(p => shiftPeriod(p, 1, closingDay))} disabled={isCurrentMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isCurrentMonth && (
              <Button variant="outline" size="sm" className="h-7 text-xs ml-1" onClick={() => setPeriod(todayPeriod)}>
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
                  <TableHead className="w-[7.5rem]">日付</TableHead>
                  <TableHead>出勤</TableHead>
                  <TableHead>退勤</TableHead>
                  <TableHead>実労働</TableHead>
                  <TableHead>残業</TableHead>
                  <TableHead>区分</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                        <TableCell />
                      </TableRow>
                    ))
                  : periodDates(period).map((dateKey) => {
                      const d = parseDateKey(dateKey);
                      const dow = d.getDay();
                      const isFuture = dateKey > todayJST;
                      const isToday = dateKey === todayJST;
                      const e = myEntries.find((x) => x.work_date === dateKey) ?? null;
                      const isLeave = !!e?.leave_type && isFullDayLeave(e.leave_type);
                      const worked = e?.clock_in_at && e?.clock_out_at
                        ? calcWorkMinutes(e.clock_in_at, e.clock_out_at, attSettings.break_minutes ?? 60)
                        : null;
                      const overtime = worked !== null ? Math.max(0, worked - scheduledMins) : null;
                      const missing = !isFuture && !e && dow !== 0 && dow !== 6;
                      const incomplete = !!e && !isLeave && !!e.clock_in_at && !e.clock_out_at && !isToday;
                      const rowTone = isLeave
                        ? "bg-amber-50/40 dark:bg-amber-950/10"
                        : dow === 0
                        ? "bg-rose-50/40 dark:bg-rose-950/10"
                        : dow === 6
                        ? "bg-sky-50/40 dark:bg-sky-950/10"
                        : "";
                      const dateTone = dow === 0 ? "text-rose-600" : dow === 6 ? "text-sky-600" : "";
                      return (
                        <TableRow
                          key={dateKey}
                          className={`glass-row ${rowTone} ${isFuture ? "opacity-50" : ""} ${isToday ? "ring-1 ring-inset ring-primary/30" : ""}`}
                        >
                          <TableCell className={`text-sm tabular-nums whitespace-nowrap ${dateTone}`}>
                            {format(d, "M/d")}
                            <span className="ml-1 text-xs">({WEEKDAY_JA[dow]})</span>
                            {isToday && <Badge variant="outline" className="ml-1.5 h-4 px-1 text-[10px]">今日</Badge>}
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">
                            {isLeave ? <span className="text-amber-600 text-xs">休暇</span> : e?.clock_in_at ? format(parseISO(e.clock_in_at), "HH:mm") : <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">
                            {isLeave ? <span className="text-amber-600 text-xs">休暇</span> : e?.clock_out_at ? format(parseISO(e.clock_out_at), "HH:mm") : incomplete ? <span className="text-rose-600 text-xs font-medium">退勤未打刻</span> : <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">{isLeave ? <span className="text-muted-foreground">-</span> : worked !== null ? minutesToHM(worked) : <span className="text-muted-foreground">-</span>}</TableCell>
                          <TableCell className="text-sm tabular-nums">
                            {isLeave ? <span className="text-muted-foreground">-</span> : overtime !== null && overtime > 0
                              ? <span className="text-amber-600 font-medium">{minutesToHM(overtime)}</span>
                              : <span className="text-muted-foreground">-</span>
                            }
                          </TableCell>
                          <TableCell>
                            {isLeave ? (
                              <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 border-0 hover:bg-amber-100">
                                {e?.leave_type}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {e?.leave_type && e.leave_type !== "none" ? e.leave_type : "-"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {e ? (
                              <Badge className={
                                e.status === "approved"
                                  ? "text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                  : e.status === "rejected"
                                  ? "text-xs bg-red-100 text-red-600 hover:bg-red-100"
                                  : "text-xs bg-amber-100 text-amber-700 hover:bg-amber-100"
                              }>
                                {e.status === "approved" ? "承認" : e.status === "rejected" ? "却下" : "保留"}
                              </Badge>
                            ) : missing ? (
                              <span className="text-[11px] text-rose-600">未打刻</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {/* 自己承認禁止: 自分のレコードは操作不可 */}
                              {isAdmin && e && e.status === "pending" && e.user_id !== user?.id && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => handleApprove(e.id)} className="h-7 px-2" title="承認"><Check className="h-3 w-3" /></Button>
                                  <Button size="sm" variant="outline" onClick={() => handleReject(e.id)} className="h-7 px-2" title="却下"><X className="h-3 w-3" /></Button>
                                </>
                              )}
                              {!isFuture && (effectiveTargetId === user?.id || isAdmin) && e?.status !== "approved" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className={`h-7 px-2 ${missing || incomplete ? "text-rose-600 hover:text-rose-700" : "text-muted-foreground"}`}
                                  onClick={() => openEdit(dateKey, e)}
                                  title={e ? "修正" : "入力"}
                                >
                                  <Pencil className="h-3 w-3" />
                                  <span className="ml-1 text-[11px]">{e ? "修正" : "入力"}</span>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
              </TableBody>
            </Table>
          </div>
        </Card>
        <p className="text-[11px] text-muted-foreground">
          打刻し忘れ・押し間違いは「入力 / 修正」から時刻を直接入力できます。修正した記録は再度承認待ちになります。
        </p>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>勤怠の{editing?.entry ? "修正" : "入力"}</DialogTitle>
            <DialogDescription>
              {editing ? format(parseDateKey(editing.date), "yyyy年M月d日（EEE）", { locale: ja }) : ""}
              {effectiveTargetId !== user?.id && (
                <> ・ {members.find((m) => m.id === effectiveTargetId)?.display_name ?? "メンバー"}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>勤務区分</Label>
              <Select value={editLeave} onValueChange={setEditLeave}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {leaveOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!isFullDayLeave(editLeave) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>出勤</Label>
                  <Input type="time" value={editIn} onChange={(e) => setEditIn(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>退勤</Label>
                  <Input type="time" value={editOut} onChange={(e) => setEditOut(e.target.value)} />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>理由（任意）</Label>
              <Textarea
                rows={2}
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="例）退勤の打刻を忘れたため"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={editSaving}>キャンセル</Button>
            <Button onClick={saveEdit} disabled={editSaving || (!isFullDayLeave(editLeave) && !editIn && !editOut)}>
              {editSaving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
