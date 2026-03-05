"use client";

import { useState, useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { ja } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, ChevronRight, Plus, HardHat, Handshake, Users, AlertTriangle, Check } from "lucide-react";

type EventType = "construction" | "meeting" | "deal" | "deadline";

interface CalendarEvent {
  id: string;
  title: string;
  type: EventType;
  date: Date;
  time: string;
  description: string;
}

const EVENT_CONFIG: Record<EventType, { label: string; chip: string; dot: string; icon: React.ElementType }> = {
  construction: { label: "工事",  chip: "bg-blue-500/85 text-white",    dot: "bg-blue-500",    icon: HardHat },
  deal:         { label: "商談",  chip: "bg-emerald-500/85 text-white", dot: "bg-emerald-500", icon: Handshake },
  meeting:      { label: "会議",  chip: "bg-violet-500/85 text-white",  dot: "bg-violet-500",  icon: Users },
  deadline:     { label: "締切",  chip: "bg-rose-500/85 text-white",    dot: "bg-rose-500",    icon: AlertTriangle },
};

function createMockEvents(): CalendarEvent[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return [
    { id: "1",  title: "山田邸リノベーション現場確認", type: "construction", date: new Date(y,m,3),             time: "09:00", description: "2階部分の内装確認。施主立ち合いあり。" },
    { id: "2",  title: "田中工務店との商談",           type: "deal",         date: new Date(y,m,5),             time: "14:00", description: "新規ビル建設案件のヒアリング。予算規模5,000万円。" },
    { id: "3",  title: "週次定例会議",                 type: "meeting",      date: new Date(y,m,7),             time: "10:00", description: "各部門の進捗報告と課題共有。" },
    { id: "4",  title: "見積書提出期限",               type: "deadline",     date: new Date(y,m,8),             time: "17:00", description: "佐藤邸新築工事の見積書提出期限。" },
    { id: "5",  title: "外壁塗装工事開始",             type: "construction", date: new Date(y,m,10),            time: "08:00", description: "田中ビル外壁塗装工事の着工日。" },
    { id: "6",  title: "鈴木様ご来社",                 type: "deal",         date: new Date(y,m,12),            time: "13:00", description: "住宅リフォームの相談。" },
    { id: "7",  title: "安全衛生委員会",               type: "meeting",      date: new Date(y,m,14),            time: "15:00", description: "月次安全衛生委員会。事故防止対策の確認。" },
    { id: "8",  title: "契約書締結期限",               type: "deadline",     date: new Date(y,m,15),            time: "18:00", description: "山田邸追加工事の契約書締結期限。" },
    { id: "9",  title: "現場検査",                     type: "construction", date: new Date(y,m,18),            time: "10:00", description: "佐藤邸基礎工事の中間検査。" },
    { id: "10", title: "月末経営会議",                 type: "meeting",      date: new Date(y,m,22),            time: "09:00", description: "月次決算報告と来月の事業計画。" },
    { id: "11", title: "請求書発行期限",               type: "deadline",     date: new Date(y,m,25),            time: "12:00", description: "今月分の請求書一括発行期限。" },
    { id: "12", title: "高橋商事との商談",             type: "deal",         date: new Date(y,m,now.getDate()), time: "11:00", description: "倉庫建設案件の詳細打ち合わせ。" },
    { id: "13", title: "配管工事完了検査",             type: "construction", date: new Date(y,m,now.getDate()), time: "15:30", description: "田中ビル配管工事の完了検査。" },
  ];
}

const WEEKDAYS_SUN = ["日","月","火","水","木","金","土"];
const WEEKDAYS_MINI = ["月","火","水","木","金","土","日"];

// ── Mini calendar (left panel) ───────────────────────────────────────────────
function MiniCalendar({ current, selected, onSelect, onPrev, onNext }: {
  current: Date; selected: Date | null;
  onSelect: (d: Date) => void; onPrev: () => void; onNext: () => void;
}) {
  const monthStart = startOfMonth(current);
  const monthEnd   = endOfMonth(current);
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 }); // Mon start
  const calEnd     = endOfWeek(monthEnd,     { weekStartsOn: 1 });
  const days: Date[] = [];
  let d = calStart;
  while (d <= calEnd) { days.push(d); d = addDays(d, 1); }

  return (
    <div className="frost-card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold">{format(current, "yyyy年M月", { locale: ja })}</span>
        <div className="flex gap-0.5">
          <button onClick={onPrev} className="h-5 w-5 rounded flex items-center justify-center hover:bg-white/30 transition-colors">
            <ChevronLeft className="h-3 w-3" />
          </button>
          <button onClick={onNext} className="h-5 w-5 rounded flex items-center justify-center hover:bg-white/30 transition-colors">
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS_MINI.map((w, i) => (
          <div key={w} className={`text-center text-[10px] font-semibold py-0.5 ${i === 5 ? "text-sky-500" : i === 6 ? "text-rose-500" : "text-muted-foreground"}`}>
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {days.map((day, i) => {
          const inMonth = isSameMonth(day, current);
          const tod = isToday(day);
          const sel = selected && isSameDay(day, selected);
          const dow = (day.getDay() + 6) % 7; // Mon=0
          return (
            <button
              key={i}
              onClick={() => onSelect(day)}
              className={`h-6 w-6 mx-auto rounded-full flex items-center justify-center text-[11px] transition-colors
                ${!inMonth ? "opacity-30" : ""}
                ${tod ? "bg-primary text-primary-foreground font-bold" : ""}
                ${sel && !tod ? "bg-primary/20 ring-1 ring-primary/50" : ""}
                ${!tod && !sel ? "hover:bg-white/35" : ""}
                ${!tod && dow === 5 ? "text-sky-500" : ""}
                ${!tod && dow === 6 ? "text-rose-500" : ""}
              `}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Category filter ───────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<EventType, string> = {
  construction: "bg-blue-500",
  deal:         "bg-emerald-500",
  meeting:      "bg-violet-500",
  deadline:     "bg-rose-500",
};

// ── Main component ────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<EventType>>(
    new Set(["construction", "deal", "meeting", "deadline"])
  );
  const events = useMemo(() => createMockEvents(), []);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd   = endOfMonth(currentMonth);
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd     = endOfWeek(monthEnd,     { weekStartsOn: 0 });
  const calDays: Date[] = [];
  let d = calStart;
  while (d <= calEnd) { calDays.push(d); d = addDays(d, 1); }

  const visibleEvents = events.filter((e) => activeFilters.has(e.type));
  const getEventsForDate = (dt: Date) => visibleEvents.filter((e) => isSameDay(e.date, dt));

  const toggleFilter = (type: EventType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  // Upcoming / selected events for right panel
  const today = new Date();
  const panelEvents = selectedDate
    ? getEventsForDate(selectedDate)
    : [...visibleEvents]
        .filter((e) => e.date >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(0, 10);

  const categoryCounts = (Object.keys(EVENT_CONFIG) as EventType[]).reduce((acc, t) => {
    acc[t] = events.filter((e) => e.type === t).length;
    return acc;
  }, {} as Record<EventType, number>);

  return (
    <div className="p-4 md:p-6 flex flex-col gap-4 h-[calc(100vh-40px)]">

      {/* ── Top toolbar ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <Button variant="outline" size="sm" className="h-8 px-3 text-xs"
          onClick={() => { setCurrentMonth(new Date()); setSelectedDate(null); }}>
          今日
        </Button>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h1 className="text-lg font-semibold tracking-tight">
          {format(currentMonth, "yyyy年M月", { locale: ja })}
        </h1>
        <div className="flex-1" />
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          作成
        </Button>
      </div>

      {/* ── Three-column layout ──────────────────────────────────── */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* Left: mini calendar + category filter */}
        <div className="w-[200px] shrink-0 flex flex-col gap-3">
          <MiniCalendar
            current={currentMonth}
            selected={selectedDate}
            onSelect={(d) => { setSelectedDate(isSameDay(d, selectedDate ?? new Date(0)) ? null : d); setCurrentMonth(d); }}
            onPrev={() => setCurrentMonth(subMonths(currentMonth, 1))}
            onNext={() => setCurrentMonth(addMonths(currentMonth, 1))}
          />

          {/* Category filter */}
          <div className="frost-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold">カテゴリ</span>
              <button
                className="text-[10px] text-primary hover:underline"
                onClick={() => setActiveFilters(
                  activeFilters.size === 4
                    ? new Set()
                    : new Set(["construction", "deal", "meeting", "deadline"])
                )}
              >
                {activeFilters.size === 4 ? "全て非表示" : "全て表示"}
              </button>
            </div>
            <div className="space-y-2">
              {(Object.entries(EVENT_CONFIG) as [EventType, typeof EVENT_CONFIG[EventType]][]).map(([type, cfg]) => (
                <button
                  key={type}
                  onClick={() => toggleFilter(type)}
                  className="w-full flex items-center gap-2.5 py-0.5 group"
                >
                  <div className={`h-4 w-4 rounded flex items-center justify-center transition-colors flex-shrink-0
                    ${activeFilters.has(type) ? CATEGORY_COLORS[type] : "bg-muted/40 border border-muted"}`}>
                    {activeFilters.has(type) && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                  <span className="text-xs flex-1 text-left">{cfg.label}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{categoryCounts[type]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center: main calendar grid */}
        <div className="flex-1 min-w-0 flex flex-col frost-card rounded-2xl overflow-hidden">
          {/* Weekday header */}
          <div className="grid grid-cols-7 border-b border-white/20 flex-shrink-0">
            {WEEKDAYS_SUN.map((w, i) => (
              <div key={w} className={`py-2 text-center text-xs font-semibold tracking-wide
                ${i === 0 ? "text-rose-500" : i === 6 ? "text-sky-500" : "text-muted-foreground"}`}>
                {w}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 flex-1 overflow-hidden"
            style={{ gridTemplateRows: `repeat(${calDays.length / 7}, 1fr)` }}>
            {calDays.map((day, idx) => {
              const dayEvts = getEventsForDate(day);
              const inMonth = isSameMonth(day, currentMonth);
              const tod = isToday(day);
              const sel = selectedDate ? isSameDay(day, selectedDate) : false;
              const dow = day.getDay();
              const isLastRow = idx >= calDays.length - 7;
              const isLastCol = idx % 7 === 6;

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(sel ? null : day)}
                  className={`flex flex-col p-1.5 text-left transition-colors duration-100 overflow-hidden
                    border-r border-b border-white/12
                    ${isLastCol ? "border-r-0" : ""}
                    ${isLastRow ? "border-b-0" : ""}
                    ${!inMonth ? "opacity-40" : ""}
                    ${sel ? "bg-white/20" : "hover:bg-white/12"}
                  `}
                >
                  <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium mb-0.5 flex-shrink-0
                    ${tod ? "bg-primary text-primary-foreground font-bold" : ""}
                    ${!tod && dow === 0 ? "text-rose-500" : ""}
                    ${!tod && dow === 6 ? "text-sky-500" : ""}
                  `}>
                    {format(day, "d")}
                  </span>
                  <div className="flex flex-col gap-0.5 w-full overflow-hidden">
                    {dayEvts.slice(0, 3).map((evt) => {
                      const cfg = EVENT_CONFIG[evt.type];
                      return (
                        <div
                          key={evt.id}
                          className={`text-[10px] leading-tight truncate rounded-md px-1.5 py-0.5 font-medium ${cfg.chip}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toast.success(evt.title, { description: `${evt.time} · ${cfg.label}` });
                          }}
                        >
                          {evt.time} {evt.title}
                        </div>
                      );
                    })}
                    {dayEvts.length > 3 && (
                      <span className="text-[10px] text-muted-foreground pl-1">+{dayEvts.length - 3}件</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: task/event panel */}
        <div className="w-64 shrink-0 flex flex-col frost-card rounded-2xl overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 flex-shrink-0">
            <div>
              <div className="flex items-center gap-1.5">
                <div className="h-3.5 w-3.5 rounded-sm bg-primary/20 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-sm bg-primary" />
                </div>
                <span className="text-sm font-semibold">
                  {selectedDate ? format(selectedDate, "M月d日（EEE）", { locale: ja }) : "今後の予定"}
                </span>
              </div>
              {!selectedDate && (
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
                    未完了: {panelEvents.length}
                  </span>
                </div>
              )}
            </div>
            <button className="h-6 w-6 rounded-lg flex items-center justify-center hover:bg-white/30 transition-colors">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <ScrollArea className="flex-1">
            {panelEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <div className="h-10 w-10 rounded-xl bg-muted/30 flex items-center justify-center">
                  <Plus className="h-4 w-4 text-muted-foreground/40" />
                </div>
                <p className="text-xs text-muted-foreground">予定はありません</p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {panelEvents.map((evt) => {
                  const cfg = EVENT_CONFIG[evt.type];
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={evt.id}
                      className="relative flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-white/25 transition-colors cursor-pointer group"
                      onClick={() => toast.success(evt.title, { description: `${evt.time} · ${cfg.label}` })}
                    >
                      <div className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full ${cfg.dot}`} />
                      {/* Checkbox-style icon */}
                      <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center shrink-0 mt-0.5 group-hover:border-primary/50 transition-colors" />
                      <div className="flex-1 min-w-0 pl-0.5">
                        {!selectedDate && (
                          <p className="text-[10px] text-muted-foreground mb-0.5">
                            {format(evt.date, "M/d（EEE）", { locale: ja })}
                          </p>
                        )}
                        <p className="text-xs font-medium leading-snug truncate">{evt.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Icon className={`h-2.5 w-2.5 ${cfg.dot.replace("bg-", "text-")}`} />
                          <p className="text-[10px] text-muted-foreground">{evt.time} · {cfg.label}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Legend */}
          <div className="px-4 py-3 border-t border-white/20 flex-shrink-0">
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.entries(EVENT_CONFIG) as [EventType, typeof EVENT_CONFIG[EventType]][]).map(([type, cfg]) => (
                <div key={type} className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <span className="text-[10px] text-muted-foreground">{cfg.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
