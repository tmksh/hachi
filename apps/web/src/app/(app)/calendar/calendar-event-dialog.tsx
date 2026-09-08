"use client";

import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { TimeSelect } from "@/components/ui/time-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Clock, MapPin, Tag, FileText, Pencil, Trash2, Users } from "lucide-react";
import { updateCalendarEvent, deleteCalendarEvent } from "@/lib/actions/calendar";
import { MemberShareSelect } from "@/components/calendar/member-share-select";
import type { CalendarEvent } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import type { MappedGoogleEvent } from "@/lib/google-calendar";
import { tokyoWallTimeToISO } from "@/lib/tokyo-date";
import { CAL_QK, CALENDAR_STALE_MS, fetchCalendarEvents, fetchCompanyMembers, type CalendarMember } from "@/lib/queries/calendar";

export type CalendarEventRow = Awaited<ReturnType<typeof fetchCalendarEvents>>[number];
export type CalendarAnyEvent = (CalendarEventRow | MappedGoogleEvent) & {
  _isGoogle?: true;
  _htmlLink?: string;
  _memberId?: string;
  _memberColor?: string;
};

const CAT_DOT: Record<string, string> = {
  sales: "bg-blue-500",
  construction: "bg-emerald-500",
  task: "bg-amber-500",
  facility: "bg-violet-500",
  equipment: "bg-orange-500",
  google: "bg-sky-400",
};

const CAT_CHIP: Record<string, string> = {
  sales: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
  construction: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  task: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  facility: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
  equipment: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30",
  google: "bg-sky-50 text-sky-700 border-sky-200",
};

const CAT_LABELS: Record<string, string> = {
  sales: "営業",
  construction: "工事",
  task: "タスク",
  facility: "施設",
  equipment: "機材",
};

export function EventDialog({
  event,
  googleToken,
  onOpenChange,
  onSaved,
  onDeleted,
}: {
  event: CalendarAnyEvent | null;
  googleToken: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [category, setCategory] = useState<string>("");
  const [location, setLocation] = useState("");
  const [sharedWith, setSharedWith] = useState<string[]>([]);

  const { data: members = [] } = useQuery({
    queryKey: CAL_QK.members,
    queryFn: fetchCompanyMembers,
    staleTime: CALENDAR_STALE_MS,
  });
  const memberNames = Object.fromEntries(members.map((m: CalendarMember) => [m.id, m.display_name]));

  useEffect(() => {
    if (!event) return;
    setMode("view");
    setTitle(event.title ?? "");
    setDescription(event.description ?? "");
    const s = parseISO(event.start_at);
    const e = event.end_at ? parseISO(event.end_at) : s;
    setStartDate(format(s, "yyyy-MM-dd"));
    setStartTime(format(s, "HH:mm"));
    setEndDate(format(e, "yyyy-MM-dd"));
    setEndTime(format(e, "HH:mm"));
    setAllDay(!!event.all_day);
    setCategory(event.category ?? "");
    setLocation(event.location ?? "");
    setSharedWith(((event as { shared_with?: string[] | null }).shared_with ?? []) as string[]);
  }, [event]);

  const open = !!event;

  const handleSave = async () => {
    if (!event) return;
    if (!title.trim() || !startDate) {
      toast.error("タイトルと開始日を入力してください");
      return;
    }
    setSaving(true);
    try {
      const start_at = allDay
        ? tokyoWallTimeToISO(startDate, "00:00")
        : tokyoWallTimeToISO(startDate, startTime);
      const end_at = allDay
        ? tokyoWallTimeToISO(endDate || startDate, "00:00")
        : tokyoWallTimeToISO(endDate || startDate, endTime);

      await updateCalendarEvent(event.id, {
        title: title.trim(),
        description: description || null,
        start_at,
        end_at,
        all_day: allDay,
        category: (category || null) as CalendarEvent["category"],
        location: location || null,
        shared_with: sharedWith,
      });

      const gId = (event as { google_event_id?: string }).google_event_id;
      if (googleToken && gId) {
        const { updateGoogleCalendarEvent } = await import("@/lib/google-calendar");
        await updateGoogleCalendarEvent(googleToken, gId, {
          title: title.trim(),
          description: description || null,
          location: location || null,
          start_at,
          end_at,
          all_day: allDay,
        });
      }

      toast.success("予定を更新しました");
      onSaved();
    } catch {
      toast.error("更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    if (!confirm("この予定を削除しますか？")) return;
    setDeleting(true);
    try {
      const gId = (event as { google_event_id?: string }).google_event_id;
      if (googleToken && gId) {
        const { deleteGoogleCalendarEvent } = await import("@/lib/google-calendar");
        await deleteGoogleCalendarEvent(googleToken, gId);
      }
      await deleteCalendarEvent(event.id);
      toast.success("予定を削除しました");
      onDeleted();
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  };

  if (!event) {
    return (
      <Dialog open={false} onOpenChange={onOpenChange}>
        <DialogContent />
      </Dialog>
    );
  }

  const isGoogle = !!(event as MappedGoogleEvent)._isGoogle;
  const htmlLink = (event as MappedGoogleEvent)._htmlLink;

  const startDt = parseISO(event.start_at);
  const endDt = event.end_at ? parseISO(event.end_at) : startDt;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">
            {mode === "view" ? "予定の詳細" : "予定を編集"}
          </DialogTitle>
        </DialogHeader>

        {mode === "view" ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <span
                className={cn(
                  "h-3 w-3 rounded-full mt-1.5 shrink-0",
                  CAT_DOT[event.category ?? ""] || "bg-gray-400",
                )}
              />
              <h3 className="text-lg font-semibold leading-snug">
                {event.title}
              </h3>
            </div>

            <div className="space-y-2 text-sm pl-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span className="tabular-nums">
                  {format(startDt, "yyyy/M/d（E）", { locale: ja })}
                  {event.all_day
                    ? " ・ 終日"
                    : ` ${format(startDt, "HH:mm")} - ${format(endDt, "HH:mm")}`}
                </span>
              </div>
              {event.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{event.location}</span>
                </div>
              )}
              {event.category && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Tag className="h-3.5 w-3.5" />
                  <Badge
                    variant="outline"
                    className={cn("text-[10px]", CAT_CHIP[event.category])}
                  >
                    {CAT_LABELS[event.category]}
                  </Badge>
                </div>
              )}
              {sharedWith.length > 0 && (
                <div className="flex items-start gap-2 text-muted-foreground">
                  <Users className="h-3.5 w-3.5 mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {sharedWith.map((id) => (
                      <Badge key={id} variant="secondary" className="text-[10px]">
                        {memberNames[id] ?? "メンバー"}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {event.description && (
                <div className="flex items-start gap-2 text-muted-foreground">
                  <FileText className="h-3.5 w-3.5 mt-0.5" />
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {event.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">タイトル *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="ev-all-day"
                checked={allDay}
                onCheckedChange={(v) => setAllDay(!!v)}
              />
              <Label htmlFor="ev-all-day" className="text-xs cursor-pointer">
                終日
              </Label>
            </div>
            <div className={cn("grid gap-3", allDay ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs">開始日 *</Label>
                <DatePicker value={startDate} onChange={setStartDate} placeholder="開始日を選択" />
              </div>
              {!allDay && (
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs">開始時刻</Label>
                  <TimeSelect value={startTime} onChange={setStartTime} />
                </div>
              )}
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs">終了日</Label>
                <DatePicker value={endDate} onChange={setEndDate} placeholder="終了日を選択" />
              </div>
              {!allDay && (
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs">終了時刻</Label>
                  <TimeSelect value={endTime} onChange={setEndTime} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">カテゴリ</Label>
                <Select
                  value={category || "_none"}
                  onValueChange={(v) => setCategory(v === "_none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">なし</SelectItem>
                    <SelectItem value="sales">営業</SelectItem>
                    <SelectItem value="construction">工事</SelectItem>
                    <SelectItem value="task">タスク</SelectItem>
                    <SelectItem value="facility">施設</SelectItem>
                    <SelectItem value="equipment">機材</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">場所</Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">メンバーに共有</Label>
              <MemberShareSelect value={sharedWith} onChange={setSharedWith} />
              <p className="text-[11px] text-muted-foreground">
                共有したメンバーのカレンダーにも予定が表示され、お知らせで通知されます
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">説明</Label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {isGoogle ? (
            <div className="flex w-full items-center justify-between">
              <div />
              <div className="flex items-center gap-2">
                {htmlLink && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={htmlLink} target="_blank" rel="noopener noreferrer">
                      Google で開く
                    </a>
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
                  閉じる
                </Button>
              </div>
            </div>
          ) : mode === "view" ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/10"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {deleting ? "削除中..." : "削除"}
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  閉じる
                </Button>
                <Button size="sm" onClick={() => setMode("edit")}>
                  <Pencil className="h-4 w-4 mr-1" />
                  編集
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/10"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {deleting ? "削除中..." : "削除"}
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMode("view")}
                  disabled={saving}
                >
                  キャンセル
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "保存中..." : "保存"}
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
