"use client";

import { useState, useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isToday,
  isSameMonth,
  isSaturday,
  isSunday,
} from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { LEAVE_TYPES } from "@/lib/constants";
import {
  LogIn,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Download,
  Check,
  X,
  Edit2,
  MessageSquare,
  Clock,
  Send,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";

type AttendanceRecord = {
  id: string;
  userId: string;
  userName: string;
  date: Date;
  clockIn: Date | null;
  clockOut: Date | null;
  leaveType: keyof typeof LEAVE_TYPES;
  status: "pending" | "approved" | "rejected";
  note: string;
  modifiedBy: string | null;
  modifiedReason: string | null;
  comments: { id: string; userName: string; message: string; createdAt: Date }[];
};

// Generate mock data
function generateMockData(month: Date): AttendanceRecord[] {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const days = eachDayOfInterval({ start, end });

  return days
    .filter((d) => !isSunday(d))
    .map((date, i) => ({
      id: `att-${i}`,
      userId: "user-1",
      userName: "山田太郎",
      date,
      clockIn: isSaturday(date) ? null : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 8 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60)),
      clockOut: isSaturday(date) ? null : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 17 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 60)),
      leaveType: isSaturday(date) ? "dayoff" as const : "none" as const,
      status: (Math.random() > 0.2 ? "approved" : "pending") as "approved" | "pending",
      note: "",
      modifiedBy: null,
      modifiedReason: null,
      comments: [],
    }));
}

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];

export default function AttendancePage() {
  const { profile, isAdmin } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState("calendar");
  const [editDialog, setEditDialog] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [userRole, setUserRole] = useState<"employee" | "manager">("employee");

  const records = useMemo(() => generateMockData(currentMonth), [currentMonth]);

  const start = startOfMonth(currentMonth);
  const end = endOfMonth(currentMonth);
  const allDays = eachDayOfInterval({ start, end });

  // Pad start to Monday
  const startPad = (getDay(start) + 6) % 7;
  const calendarDays: (Date | null)[] = [
    ...Array(startPad).fill(null),
    ...allDays,
  ];

  const selectedRecord = selectedDate
    ? records.find(
        (r) =>
          format(r.date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd"),
      )
    : null;

  const pendingCount = records.filter((r) => r.status === "pending").length;

  const handleClockIn = () => {
    toast.success("出勤を記録しました", {
      description: format(new Date(), "HH:mm"),
    });
  };

  const handleClockOut = () => {
    toast.success("退勤を記録しました", {
      description: format(new Date(), "HH:mm"),
    });
  };

  const handleExportCSV = () => {
    const headers = ["日付", "氏名", "出勤", "退勤", "休暇種別", "勤務時間", "ステータス"];
    const rows = records.map((r) => [
      format(r.date, "yyyy/MM/dd"),
      r.userName,
      r.clockIn ? format(r.clockIn, "HH:mm") : "",
      r.clockOut ? format(r.clockOut, "HH:mm") : "",
      LEAVE_TYPES[r.leaveType],
      r.clockIn && r.clockOut
        ? ((r.clockOut.getTime() - r.clockIn.getTime()) / 3600000).toFixed(1)
        : "",
      r.status === "approved" ? "承認済み" : "承認待ち",
    ]);

    const csv = "\uFEFF" + [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `勤怠_${format(currentMonth, "yyyyMM")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSVをダウンロードしました");
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="勤怠管理">
        {/* Role switcher for demo */}
        <Select value={userRole} onValueChange={(v) => setUserRole(v as "employee" | "manager")}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="employee">一般ユーザー</SelectItem>
            <SelectItem value="manager">上長・管理者</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="calendar">勤怠申請</TabsTrigger>
          <TabsTrigger value="pending" className="gap-1.5">
            承認待ち
            {pendingCount > 0 && (
              <Badge className="bg-red-500 text-white text-[10px] h-4 min-w-4 px-1">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="list">勤怠一覧</TabsTrigger>
        </TabsList>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
            {/* Left: Clock + Calendar */}
            <div className="space-y-4">

              {/* Clock-in card */}
              <Card className="overflow-hidden">
                <div className={`h-1 w-full transition-colors duration-500 bg-primary/40`} />
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(), "yyyy年M月d日（EEEE）", { locale: ja })}
                      </p>
                      <p className="text-3xl font-bold tabular-nums tracking-tight mt-0.5">
                        {format(new Date(), "HH:mm")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleClockIn} className="gap-1.5 h-9">
                        <LogIn className="h-3.5 w-3.5" />
                        出勤
                      </Button>
                      <Button variant="outline" onClick={handleClockOut} className="gap-1.5 h-9">
                        <LogOut className="h-3.5 w-3.5" />
                        退勤
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Monthly calendar */}
              <Card>
                <CardContent className="px-4 pt-4 pb-3">
                  {/* Month nav */}
                  <div className="flex items-center justify-between mb-3">
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-semibold">
                      {format(currentMonth, "yyyy年M月", { locale: ja })}
                    </span>
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Weekday headers */}
                  <div className="grid grid-cols-7 border-b border-white/20 pb-1 mb-1">
                    {WEEKDAYS.map((day, i) => (
                      <div key={day} className={cn(
                        "text-center text-[11px] font-semibold py-1",
                        i === 5 && "text-sky-500",
                        i === 6 && "text-rose-500",
                        i < 5 && "text-muted-foreground",
                      )}>
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-px">
                    {calendarDays.map((day, i) => {
                      if (!day) return <div key={`pad-${i}`} className="aspect-[1/1.2]" />;

                      const record = records.find(r => format(r.date, "yyyy-MM-dd") === format(day, "yyyy-MM-dd"));
                      const isSelected = selectedDate && format(day, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
                      const sat = isSaturday(day);
                      const sun = isSunday(day);
                      const tod = isToday(day);

                      return (
                        <button
                          key={format(day, "yyyy-MM-dd")}
                          onClick={() => setSelectedDate(isSelected ? null : day)}
                          className={cn(
                            "aspect-[1/1.2] rounded-xl p-1.5 text-left transition-all duration-150 flex flex-col",
                            "hover:bg-white/30",
                            isSelected && "bg-primary/10 ring-1 ring-primary/40",
                            tod && !isSelected && "ring-1 ring-primary/30",
                          )}
                        >
                          <span className={cn(
                            "inline-flex items-center justify-center h-5 w-5 rounded-full text-[11px] font-medium mb-0.5",
                            tod ? "bg-primary text-primary-foreground font-bold" : "",
                            !tod && sat ? "text-sky-500" : "",
                            !tod && sun ? "text-rose-500" : "",
                            !tod && !sat && !sun ? "text-foreground" : "",
                          )}>
                            {format(day, "d")}
                          </span>
                          {record?.clockIn && !sat && !sun && (
                            <div className="flex flex-col gap-px">
                              <span className="text-[9px] text-emerald-600 tabular-nums leading-none font-medium">
                                {format(record.clockIn, "HH:mm")}
                              </span>
                              {record.clockOut && (
                                <span className="text-[9px] text-sky-600 tabular-nums leading-none">
                                  {format(record.clockOut, "HH:mm")}
                                </span>
                              )}
                            </div>
                          )}
                          {record?.status === "pending" && (
                            <span className="mt-auto h-1 w-1 rounded-full bg-amber-400 self-end" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-3 pt-2 border-t border-white/20">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-[10px] text-muted-foreground">出勤</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-sky-500" />
                      <span className="text-[10px] text-muted-foreground">退勤</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      <span className="text-[10px] text-muted-foreground">承認待ち</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Day detail panel */}
            <div className="space-y-3">
              {selectedDate ? (
                <>
                  {/* Date header */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">
                      {format(selectedDate, "M月d日（EEEE）", { locale: ja })}
                    </p>
                    {selectedRecord && <StatusBadge status={selectedRecord.status} />}
                  </div>

                  {/* Clock times */}
                  <Card>
                    <CardContent className="py-4 px-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                            出勤
                          </p>
                          <p className="text-2xl font-bold tabular-nums tracking-tight">
                            {selectedRecord?.clockIn ? format(selectedRecord.clockIn, "HH:mm") : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-sky-500 inline-block" />
                            退勤
                          </p>
                          <p className="text-2xl font-bold tabular-nums tracking-tight">
                            {selectedRecord?.clockOut ? format(selectedRecord.clockOut, "HH:mm") : "—"}
                          </p>
                        </div>
                      </div>
                      {selectedRecord?.clockIn && selectedRecord?.clockOut && (
                        <div className="mt-3 pt-3 border-t border-white/20">
                          <p className="text-xs text-muted-foreground">勤務時間</p>
                          <p className="text-base font-semibold tabular-nums mt-0.5">
                            {((selectedRecord.clockOut.getTime() - selectedRecord.clockIn.getTime()) / 3600000).toFixed(1)}h
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Leave type */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">休暇種別</Label>
                    <Select defaultValue={selectedRecord?.leaveType ?? "none"}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(LEAVE_TYPES).map(([key, label]) => (
                          <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Manager actions */}
                  {userRole === "manager" && selectedRecord?.status === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 gap-1.5" onClick={() => toast.success("承認しました")}>
                        <Check className="h-3.5 w-3.5" />承認
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-destructive"
                        onClick={() => toast.info("差戻しました")}>
                        <X className="h-3.5 w-3.5" />差戻し
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditDialog(true)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}

                  {/* Comment */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" />コメント
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {selectedRecord?.comments.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-3">コメントはありません</p>
                      )}
                      <div className="flex gap-2 mt-1">
                        <Textarea
                          placeholder="コメントを入力..."
                          className="text-xs min-h-[56px] resize-none"
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                        />
                        <Button size="icon" className="shrink-0 h-8 w-8 self-end" disabled={!newComment.trim()}
                          onClick={() => { toast.success("コメントを追加しました"); setNewComment(""); }}>
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                  <div className="h-12 w-12 rounded-2xl bg-muted/30 flex items-center justify-center">
                    <CalendarDays className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">日付を選択してください</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Pending Tab */}
        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardContent className="py-4">
              <div className="space-y-2">
                {records
                  .filter((r) => r.status === "pending")
                  .map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-medium text-primary">
                            {record.userName.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{record.userName}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(record.date, "M/d（EEEE）", { locale: ja })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-xs text-muted-foreground">
                          <p>
                            出勤: {record.clockIn ? format(record.clockIn, "HH:mm") : "—"}
                          </p>
                          <p>
                            退勤: {record.clockOut ? format(record.clockOut, "HH:mm") : "—"}
                          </p>
                        </div>
                        {userRole === "manager" && (
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => toast.success("承認しました")}
                            >
                              <Check className="h-3 w-3" />
                              承認
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 text-xs"
                              onClick={() => toast.info("差戻しました")}
                            >
                              <X className="h-3 w-3" />
                              差戻し
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* List Tab */}
        <TabsContent value="list" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">
                  {format(currentMonth, "yyyy年 M月", { locale: ja })}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportCSV}>
                <Download className="h-3.5 w-3.5" />
                CSV出力
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">日付</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">出勤</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">退勤</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">休暇</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">勤務時間</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">ステータス</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => {
                      const hours =
                        record.clockIn && record.clockOut
                          ? (
                              (record.clockOut.getTime() - record.clockIn.getTime()) /
                              3600000
                            ).toFixed(1)
                          : null;

                      return (
                        <tr
                          key={record.id}
                          className={cn(
                            "border-b last:border-0 hover:bg-accent/50 transition-colors",
                            isSaturday(record.date) && "text-blue-500",
                            isSunday(record.date) && "text-red-500",
                          )}
                        >
                          <td className="py-2 px-3 text-xs">
                            {format(record.date, "M/d（E）", { locale: ja })}
                          </td>
                          <td className="py-2 px-3 text-xs tabular-nums">
                            {record.clockIn ? format(record.clockIn, "HH:mm") : "—"}
                          </td>
                          <td className="py-2 px-3 text-xs tabular-nums">
                            {record.clockOut ? format(record.clockOut, "HH:mm") : "—"}
                          </td>
                          <td className="py-2 px-3 text-xs">
                            {record.leaveType !== "none" && (
                              <Badge variant="secondary" className="text-[10px]">
                                {LEAVE_TYPES[record.leaveType]}
                              </Badge>
                            )}
                          </td>
                          <td className="py-2 px-3 text-xs tabular-nums">
                            {hours ? `${hours}h` : "—"}
                          </td>
                          <td className="py-2 px-3">
                            <StatusBadge status={record.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>勤怠修正</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">出勤時刻</Label>
                <Input type="time" className="h-9" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">退勤時刻</Label>
                <Input type="time" className="h-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">
                修正理由 <span className="text-destructive">*</span>
              </Label>
              <Textarea placeholder="修正理由を入力してください" className="min-h-[80px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>
              キャンセル
            </Button>
            <Button
              onClick={() => {
                setEditDialog(false);
                toast.success("勤怠を修正しました");
              }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
