"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  parseISO,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isToday,
  startOfDay,
  endOfDay,
} from "date-fns";
import { ja } from "date-fns/locale";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  ListTodo,
  Clock,
  MapPin,
  Tag,
  FileText,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  getCalendarEvents,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/actions/calendar";
import type { CalendarEvent } from "@/lib/database.types";
import { cn } from "@/lib/utils";

type Ev = Awaited<ReturnType<typeof getCalendarEvents>>[number];
type View = "day" | "week" | "month";

const CATEGORIES = ["sales", "construction", "task", "facility", "equipment"] as const;

const CAT_DOT: Record<string, string> = {
  sales: "bg-blue-500",
  construction: "bg-emerald-500",
  task: "bg-amber-500",
  facility: "bg-violet-500",
  equipment: "bg-orange-500",
};

const CAT_CHIP: Record<string, string> = {
  sales: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
  construction: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  task: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  facility: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
  equipment: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30",
};

const CAT_LABELS: Record<string, string> = {
  sales: "営業",
  construction: "工事",
  task: "タスク",
  facility: "施設",
  equipment: "機材",
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<View>("month");
  const [hiddenCats, setHiddenCats] = useState<Set<string>>(new Set());
  const [events, setEvents] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeEvent, setActiveEvent] = useState<Ev | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const openEvent = useCallback((ev: Ev) => setActiveEvent(ev), []);
  const refreshEvents = useCallback(() => setReloadKey((k) => k + 1), []);
  const newEventHref = (d: Date) =>
    `/calendar/new?date=${format(d, "yyyy-MM-dd")}`;

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (view === "day") {
      return { rangeStart: startOfDay(currentDate), rangeEnd: endOfDay(currentDate) };
    }
    if (view === "week") {
      return {
        rangeStart: startOfWeek(currentDate, { weekStartsOn: 0 }),
        rangeEnd: endOfWeek(currentDate, { weekStartsOn: 0 }),
      };
    }
    const ms = startOfMonth(currentDate);
    const me = endOfMonth(currentDate);
    return {
      rangeStart: startOfWeek(ms, { weekStartsOn: 0 }),
      rangeEnd: endOfWeek(me, { weekStartsOn: 0 }),
    };
  }, [currentDate, view]);

  useEffect(() => {
    setLoading(true);
    getCalendarEvents({ start: rangeStart.toISOString(), end: rangeEnd.toISOString() })
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [rangeStart, rangeEnd, reloadKey]);

  const visibleEvents = useMemo(
    () => events.filter((e) => !hiddenCats.has(e.category ?? "")),
    [events, hiddenCats]
  );

  const toggleCat = (c: string) => {
    setHiddenCats((prev) => {
      const n = new Set(prev);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });
  };

  const goToday = () => {
    const d = new Date();
    setCurrentDate(d);
    setSelectedDate(d);
  };
  const goPrev = () => {
    setCurrentDate(
      view === "day"
        ? subDays(currentDate, 1)
        : view === "week"
        ? subWeeks(currentDate, 1)
        : subMonths(currentDate, 1)
    );
  };
  const goNext = () => {
    setCurrentDate(
      view === "day"
        ? addDays(currentDate, 1)
        : view === "week"
        ? addWeeks(currentDate, 1)
        : addMonths(currentDate, 1)
    );
  };

  const titleText =
    view === "day"
      ? format(currentDate, "yyyy年M月d日（E）", { locale: ja })
      : view === "week"
      ? `${format(startOfWeek(currentDate, { weekStartsOn: 0 }), "M月d日", { locale: ja })} - ${format(endOfWeek(currentDate, { weekStartsOn: 0 }), "M月d日", { locale: ja })}`
      : format(currentDate, "yyyy年M月", { locale: ja });

  const selectedDateEvents = useMemo(
    () => visibleEvents.filter((e) => isSameDay(parseISO(e.start_at), selectedDate)),
    [visibleEvents, selectedDate]
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">カレンダー</h1>
          <p className="text-xs text-muted-foreground mt-0.5">スケジュール管理</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday} className="h-8">
            今日
          </Button>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="text-lg font-semibold tracking-tight ml-1">{titleText}</h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border p-0.5 bg-background">
            {(["day", "week", "month"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1 text-xs rounded transition-colors",
                  view === v
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {v === "day" ? "日" : v === "week" ? "週" : "月"}
              </button>
            ))}
          </div>
          <Link href={newEventHref(selectedDate)}>
            <Button size="sm" className="gap-1.5 h-8">
              <Plus className="h-4 w-4" /> 作成
            </Button>
          </Link>
        </div>
      </div>

      {/* Main 3-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_280px] gap-4">
        {/* Left sidebar */}
        <aside className="space-y-3">
          <MiniCalendar
            selected={selectedDate}
            onSelect={(d) => {
              setSelectedDate(d);
              setCurrentDate(d);
            }}
          />
          <Card>
            <CardContent className="py-3 px-4 space-y-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold">カテゴリ</h3>
                <button
                  className="text-[11px] text-primary hover:underline"
                  onClick={() =>
                    setHiddenCats(
                      hiddenCats.size === CATEGORIES.length ? new Set() : new Set(CATEGORIES)
                    )
                  }
                >
                  {hiddenCats.size === CATEGORIES.length ? "全て表示" : "全て非表示"}
                </button>
              </div>
              {CATEGORIES.map((c) => {
                const count = events.filter((e) => e.category === c).length;
                const active = !hiddenCats.has(c);
                return (
                  <label
                    key={c}
                    className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/40 rounded-md px-1.5 py-1.5"
                  >
                    <Checkbox
                      checked={active}
                      onCheckedChange={() => toggleCat(c)}
                      className="h-3.5 w-3.5"
                    />
                    <span className={cn("h-2 w-2 rounded-full", CAT_DOT[c])} />
                    <span className="flex-1">{CAT_LABELS[c]}</span>
                    <span className="text-muted-foreground tabular-nums">{count}</span>
                  </label>
                );
              })}
            </CardContent>
          </Card>
        </aside>

        {/* Main calendar */}
        <div className="min-w-0">
          {loading ? (
            <Skeleton className="h-[600px] w-full" />
          ) : view === "month" ? (
            <MonthView
              date={currentDate}
              selected={selectedDate}
              onSelect={setSelectedDate}
              events={visibleEvents}
              onEventClick={openEvent}
            />
          ) : view === "week" ? (
            <WeekView
              date={currentDate}
              selected={selectedDate}
              onSelect={setSelectedDate}
              events={visibleEvents}
              onEventClick={openEvent}
            />
          ) : (
            <DayView
              date={currentDate}
              events={visibleEvents}
              onEventClick={openEvent}
            />
          )}
        </div>

        {/* Right tasks panel */}
        <aside>
          <Card>
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">タスク</h3>
                </div>
                <Link href={newEventHref(selectedDate)}>
                  <button className="text-muted-foreground hover:text-foreground">
                    <Plus className="h-4 w-4" />
                  </button>
                </Link>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {format(selectedDate, "M月d日（E）", { locale: ja })} ・ {selectedDateEvents.length}件
              </p>
              <div className="space-y-1">
                {selectedDateEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-10">
                    予定はありません
                  </p>
                ) : (
                  selectedDateEvents.map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() => openEvent(ev)}
                      className="w-full flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors text-left"
                    >
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full mt-1.5 shrink-0",
                          CAT_DOT[ev.category ?? ""] || "bg-gray-400"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{ev.title}</p>
                        <p className="text-[10px] text-muted-foreground tabular-nums">
                          {ev.all_day
                            ? "終日"
                            : format(parseISO(ev.start_at), "HH:mm")}
                          {ev.category && (
                            <span className="ml-1.5">・{CAT_LABELS[ev.category]}</span>
                          )}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <EventDialog
        event={activeEvent}
        onOpenChange={(open) => {
          if (!open) setActiveEvent(null);
        }}
        onSaved={() => {
          setActiveEvent(null);
          refreshEvents();
        }}
        onDeleted={() => {
          setActiveEvent(null);
          refreshEvents();
        }}
      />
    </div>
  );
}

/* ──────────────────── Mini Calendar ──────────────────── */
function MiniCalendar({
  selected,
  onSelect,
}: {
  selected: Date;
  onSelect: (d: Date) => void;
}) {
  const [miniMonth, setMiniMonth] = useState(selected);
  const ms = startOfMonth(miniMonth);
  const me = endOfMonth(miniMonth);
  const gs = startOfWeek(ms, { weekStartsOn: 0 });
  const ge = endOfWeek(me, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gs, end: ge });

  return (
    <Card>
      <CardContent className="py-3 px-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold">
            {format(miniMonth, "yyyy年M月", { locale: ja })}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setMiniMonth(subMonths(miniMonth, 1))}
              className="p-1 hover:bg-muted rounded"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <button
              onClick={() => setMiniMonth(addMonths(miniMonth, 1))}
              className="p-1 hover:bg-muted rounded"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
            <div
              key={d}
              className={cn(
                "text-[10px] text-center py-1 font-medium",
                i === 0
                  ? "text-rose-500"
                  : i === 6
                  ? "text-blue-500"
                  : "text-muted-foreground"
              )}
            >
              {d}
            </div>
          ))}
          {days.map((d) => {
            const inMonth = isSameMonth(d, miniMonth);
            const isSel = isSameDay(d, selected);
            const today = isToday(d);
            const weekday = d.getDay();
            return (
              <button
                key={d.toISOString()}
                onClick={() => onSelect(d)}
                className={cn(
                  "text-[11px] h-6 w-6 mx-auto rounded-full flex items-center justify-center transition-colors tabular-nums",
                  !inMonth && "text-muted-foreground/40",
                  isSel
                    ? "bg-primary text-primary-foreground"
                    : today
                    ? "text-primary font-bold"
                    : inMonth &&
                      (weekday === 0
                        ? "text-rose-500"
                        : weekday === 6
                        ? "text-blue-500"
                        : ""),
                  !isSel && "hover:bg-primary/10"
                )}
              >
                {format(d, "d")}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ──────────────────── Month View ──────────────────── */
function MonthView({
  date,
  selected,
  onSelect,
  events,
  onEventClick,
}: {
  date: Date;
  selected: Date;
  onSelect: (d: Date) => void;
  events: Ev[];
  onEventClick: (ev: Ev) => void;
}) {
  const ms = startOfMonth(date);
  const me = endOfMonth(date);
  const gs = startOfWeek(ms, { weekStartsOn: 0 });
  const ge = endOfWeek(me, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gs, end: ge });

  return (
    <Card className="overflow-hidden py-0">
      <div className="grid grid-cols-7 border-b">
        {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
          <div
            key={d}
            className={cn(
              "px-2 py-2 text-center text-xs font-medium border-r last:border-r-0",
              i === 0
                ? "text-rose-500"
                : i === 6
                ? "text-blue-500"
                : "text-muted-foreground"
            )}
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const inMonth = isSameMonth(d, date);
          const today = isToday(d);
          const isSel = isSameDay(d, selected);
          const weekday = d.getDay();
          const dayEvents = events.filter((e) =>
            isSameDay(parseISO(e.start_at), d)
          );
          const isLastRow = i >= days.length - 7;
          const isLastCol = (i + 1) % 7 === 0;
          return (
            <button
              key={d.toISOString()}
              onClick={() => onSelect(d)}
              className={cn(
                "min-h-[100px] p-1.5 text-left transition-colors relative",
                !isLastCol && "border-r",
                !isLastRow && "border-b",
                !inMonth && "bg-muted/30",
                isSel && "bg-primary/5 ring-1 ring-primary/30 ring-inset",
                "hover:bg-muted/40"
              )}
            >
              <div
                className={cn(
                  "text-xs mb-1 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full tabular-nums",
                  today
                    ? "bg-primary text-primary-foreground font-bold"
                    : !inMonth
                    ? "text-muted-foreground/50"
                    : weekday === 0
                    ? "text-rose-500"
                    : weekday === 6
                    ? "text-blue-500"
                    : ""
                )}
              >
                {format(d, "d")}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((ev) => (
                  <span
                    key={ev.id}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(ev);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        onEventClick(ev);
                      }
                    }}
                    className={cn(
                      "block text-[10px] px-1.5 py-0.5 rounded truncate border text-left cursor-pointer hover:brightness-95 hover:shadow-sm",
                      CAT_CHIP[ev.category ?? ""] ||
                        "bg-muted text-foreground border-border"
                    )}
                  >
                    {!ev.all_day && (
                      <span className="tabular-nums mr-1 font-medium">
                        {format(parseISO(ev.start_at), "HH:mm")}
                      </span>
                    )}
                    {ev.title}
                  </span>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-muted-foreground px-1.5">
                    +{dayEvents.length - 3}件
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/* ──────────────────── Week View ──────────────────── */
function WeekView({
  date,
  selected,
  onSelect,
  events,
  onEventClick,
}: {
  date: Date;
  selected: Date;
  onSelect: (d: Date) => void;
  events: Ev[];
  onEventClick: (ev: Ev) => void;
}) {
  const ws = startOfWeek(date, { weekStartsOn: 0 });
  const we = endOfWeek(date, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: ws, end: we });

  return (
    <Card className="overflow-hidden py-0">
      <div className="grid grid-cols-7 border-b">
        {days.map((d) => {
          const today = isToday(d);
          const isSel = isSameDay(d, selected);
          const weekday = d.getDay();
          return (
            <button
              key={d.toISOString()}
              onClick={() => onSelect(d)}
              className={cn(
                "flex flex-col items-center gap-1 py-3 border-r last:border-r-0 transition-colors",
                isSel && "bg-primary/5",
                "hover:bg-muted/40"
              )}
            >
              <span
                className={cn(
                  "text-[10px] font-medium",
                  weekday === 0
                    ? "text-rose-500"
                    : weekday === 6
                    ? "text-blue-500"
                    : "text-muted-foreground"
                )}
              >
                {format(d, "E", { locale: ja })}
              </span>
              <span
                className={cn(
                  "text-lg font-semibold tabular-nums h-8 w-8 rounded-full flex items-center justify-center",
                  today && "bg-primary text-primary-foreground"
                )}
              >
                {format(d, "d")}
              </span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-7 min-h-[500px]">
        {days.map((d) => {
          const dayEvents = events
            .filter((e) => isSameDay(parseISO(e.start_at), d))
            .sort((a, b) => a.start_at.localeCompare(b.start_at));
          return (
            <div
              key={d.toISOString()}
              className="border-r last:border-r-0 p-2 space-y-1"
            >
              {dayEvents.length === 0 ? (
                <span className="text-[10px] text-muted-foreground/50">-</span>
              ) : (
                dayEvents.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => onEventClick(ev)}
                    className={cn(
                      "w-full text-left text-[10px] px-1.5 py-1 rounded border cursor-pointer hover:brightness-95 hover:shadow-sm transition",
                      CAT_CHIP[ev.category ?? ""] ||
                        "bg-muted text-foreground border-border"
                    )}
                  >
                    {!ev.all_day && (
                      <div className="tabular-nums font-medium">
                        {format(parseISO(ev.start_at), "HH:mm")}
                      </div>
                    )}
                    <div className="truncate">{ev.title}</div>
                  </button>
                ))
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ──────────────────── Day View ──────────────────── */
function DayView({
  date,
  events,
  onEventClick,
}: {
  date: Date;
  events: Ev[];
  onEventClick: (ev: Ev) => void;
}) {
  const dayEvents = events
    .filter((e) => isSameDay(parseISO(e.start_at), date))
    .sort((a, b) => a.start_at.localeCompare(b.start_at));

  return (
    <Card>
      <CardContent className="py-4 px-5">
        <h3 className="text-sm font-semibold mb-4">
          {format(date, "yyyy年M月d日（E）", { locale: ja })}
        </h3>
        {dayEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">
            この日は予定がありません
          </p>
        ) : (
          <div className="space-y-2">
            {dayEvents.map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => onEventClick(ev)}
                className="w-full text-left flex items-start gap-3 p-3 rounded-md border hover:bg-muted/40 transition-colors cursor-pointer"
              >
                <div className="flex flex-col items-center min-w-[56px]">
                  <span className="text-[10px] text-muted-foreground">開始</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {ev.all_day ? "終日" : format(parseISO(ev.start_at), "HH:mm")}
                  </span>
                </div>
                <div
                  className={cn(
                    "w-1 self-stretch rounded",
                    CAT_DOT[ev.category ?? ""] || "bg-gray-400"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{ev.title}</p>
                  {ev.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ev.description}
                    </p>
                  )}
                  {ev.category && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] mt-1",
                        CAT_CHIP[ev.category]
                      )}
                    >
                      {CAT_LABELS[ev.category]}
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ──────────────────── Event Dialog ──────────────────── */
function EventDialog({
  event,
  onOpenChange,
  onSaved,
  onDeleted,
}: {
  event: Ev | null;
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
      await updateCalendarEvent(event.id, {
        title: title.trim(),
        description: description || null,
        start_at: `${startDate}T${startTime}:00`,
        end_at: `${endDate || startDate}T${endTime}:00`,
        all_day: allDay,
        category: (category || null) as CalendarEvent["category"],
        location: location || null,
      });
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
                  CAT_DOT[event.category ?? ""] || "bg-gray-400"
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">開始日 *</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">開始時刻</Label>
                <Input
                  type="time"
                  value={startTime}
                  disabled={allDay}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">終了日</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">終了時刻</Label>
                <Input
                  type="time"
                  value={endTime}
                  disabled={allDay}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
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
          {mode === "view" ? (
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
