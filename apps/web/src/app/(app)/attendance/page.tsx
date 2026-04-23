"use client";

import { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LogIn, LogOut, Check, X } from "lucide-react";
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
  const month = format(new Date(), "yyyy-MM");

  const load = useCallback(() => {
    setLoading(true);
    getAttendanceEntries({ month }).then(data => {
      setEntries(data as Entry[]);
      const today = format(new Date(), "yyyy-MM-dd");
      const todayEntry = data.find((e: Entry) => e.work_date === today && e.user_id === user?.id);
      if (todayEntry?.clock_in_at && !todayEntry?.clock_out_at) setClockedIn(true);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [month, user?.id]);

  useEffect(() => { if (user) load(); }, [user, load]);

  const handleClockIn = async () => { try { await clockIn(); setClockedIn(true); toast.success("出勤しました"); load(); } catch { toast.error("出勤に失敗"); } };
  const handleClockOut = async () => { try { await clockOut(); setClockedIn(false); toast.success("退勤しました"); load(); } catch { toast.error("退勤に失敗"); } };
  const handleApprove = async (id: string) => { try { await approveAttendance(id); toast.success("承認しました"); load(); } catch { toast.error("失敗"); } };
  const handleReject = async (id: string) => { try { await rejectAttendance(id); toast.success("却下しました"); load(); } catch { toast.error("失敗"); } };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-xl font-semibold">勤怠管理</h1>
      <Card><CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${clockedIn ? "bg-emerald-400" : "bg-muted-foreground/30"}`} /><span className="text-sm">{clockedIn ? "勤務中" : "未出勤"}</span></div>
          <span className="text-sm text-muted-foreground">{format(new Date(), "yyyy年M月d日（EEE）", { locale: ja })}</span>
        </div>
        <div className="flex flex-col items-center gap-2 py-3">
          <AnalogClock size={120} />
          <p className="text-lg font-semibold tabular-nums text-muted-foreground tracking-widest">
            {format(new Date(), "HH:mm")}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Button onClick={handleClockIn} disabled={clockedIn} className="gap-1.5"><LogIn className="h-4 w-4" />出勤</Button>
          <Button variant="outline" onClick={handleClockOut} disabled={!clockedIn} className="gap-1.5"><LogOut className="h-4 w-4" />退勤</Button>
        </div>
      </CardContent></Card>
      <Card><CardHeader className="pb-3"><CardTitle className="text-sm">{format(new Date(), "yyyy年M月", { locale: ja })}の勤怠記録</CardTitle></CardHeader>
        <CardContent><div className="overflow-x-auto">
          <Table><TableHeader><TableRow><TableHead>日付</TableHead>{isAdmin && <TableHead>社員</TableHead>}<TableHead>出勤</TableHead><TableHead>退勤</TableHead><TableHead>区分</TableHead><TableHead>ステータス</TableHead>{isAdmin && <TableHead>操作</TableHead>}</TableRow></TableHeader>
            <TableBody>
              {loading ? Array.from({length:5}).map((_,i)=><TableRow key={i}><TableCell><Skeleton className="h-4 w-20"/></TableCell><TableCell><Skeleton className="h-4 w-16"/></TableCell><TableCell><Skeleton className="h-4 w-16"/></TableCell><TableCell><Skeleton className="h-4 w-16"/></TableCell><TableCell><Skeleton className="h-5 w-16"/></TableCell></TableRow>) : entries.length === 0 ? <TableRow><TableCell colSpan={isAdmin ? 7 : 5} className="text-center py-8 text-muted-foreground">記録なし</TableCell></TableRow> : entries.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm">{e.work_date}</TableCell>
                  {isAdmin && <TableCell className="text-sm">{(e as Entry & { user?: { display_name: string } }).user?.display_name ?? "-"}</TableCell>}
                  <TableCell className="text-sm tabular-nums">{e.clock_in_at ? format(parseISO(e.clock_in_at), "HH:mm") : "-"}</TableCell>
                  <TableCell className="text-sm tabular-nums">{e.clock_out_at ? format(parseISO(e.clock_out_at), "HH:mm") : "-"}</TableCell>
                  <TableCell><span className="text-xs">{LEAVE_LABELS[e.leave_type ?? "none"]}</span></TableCell>
                  <TableCell><Badge variant={e.status === "approved" ? "default" : e.status === "rejected" ? "destructive" : "secondary"} className="text-xs">{e.status === "approved" ? "承認" : e.status === "rejected" ? "却下" : "保留"}</Badge></TableCell>
                  {isAdmin && <TableCell>
                    {e.status === "pending" && <div className="flex gap-1"><Button size="sm" variant="outline" onClick={()=>handleApprove(e.id)} className="h-7 px-2"><Check className="h-3 w-3" /></Button><Button size="sm" variant="outline" onClick={()=>handleReject(e.id)} className="h-7 px-2"><X className="h-3 w-3" /></Button></div>}
                  </TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div></CardContent>
      </Card>
    </div>
  );
}
