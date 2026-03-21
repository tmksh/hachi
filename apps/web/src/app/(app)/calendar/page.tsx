"use client";

import { useState, useEffect, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { getCalendarEvents } from "@/lib/actions/calendar";

type Ev = Awaited<ReturnType<typeof getCalendarEvents>>[number];
const CAT_COLORS: Record<string, string> = { sales: "bg-blue-500", construction: "bg-green-500", task: "bg-yellow-500", facility: "bg-purple-500", equipment: "bg-orange-500" };
const CAT_LABELS: Record<string, string> = { sales: "営業", construction: "工事", task: "タスク", facility: "施設", equipment: "機材" };

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const start = startOfMonth(currentMonth).toISOString();
    const end = endOfMonth(currentMonth).toISOString();
    setLoading(true);
    getCalendarEvents({ start, end }).then(setEvents).catch(() => {}).finally(() => setLoading(false));
  }, [currentMonth]);

  const days = useMemo(() => eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }), [currentMonth]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <h1 className="text-xl font-semibold">{format(currentMonth, "yyyy年M月", { locale: ja })}</h1>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <Link href="/calendar/new"><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />予定追加</Button></Link>
      </div>
      {loading ? <div className="space-y-2">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-16" />)}</div> : (
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
          {["日","月","火","水","木","金","土"].map(d => <div key={d} className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>)}
          {Array.from({ length: days[0].getDay() }).map((_, i) => <div key={`e${i}`} className="bg-background p-2 min-h-[80px]" />)}
          {days.map(day => {
            const dayEvents = events.filter(e => isSameDay(parseISO(e.start_at), day));
            return (
              <div key={day.toISOString()} className="bg-background p-2 min-h-[80px]">
                <p className={`text-xs font-medium mb-1 ${isSameDay(day, new Date()) ? "text-primary font-bold" : ""}`}>{format(day, "d")}</p>
                {dayEvents.slice(0, 3).map(ev => (
                  <div key={ev.id} className="flex items-center gap-1 mb-0.5">
                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${CAT_COLORS[ev.category ?? ""] || "bg-gray-400"}`} />
                    <span className="text-[10px] truncate">{ev.title}</span>
                  </div>
                ))}
                {dayEvents.length > 3 && <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 3}</span>}
              </div>
            );
          })}
        </div>
      )}
      <Card><CardHeader className="pb-3"><CardTitle className="text-sm">今月のイベント</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {events.length === 0 ? <p className="text-sm text-muted-foreground">予定なし</p> : events.map(ev => (
            <div key={ev.id} className="flex items-center gap-3 py-2 border-b last:border-0">
              <div className={`h-2 w-2 rounded-full ${CAT_COLORS[ev.category ?? ""] || "bg-gray-400"}`} />
              <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{ev.title}</p><p className="text-xs text-muted-foreground">{format(parseISO(ev.start_at), "M/d HH:mm", { locale: ja })}</p></div>
              {ev.category && <Badge variant="outline" className="text-xs">{CAT_LABELS[ev.category] || ev.category}</Badge>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
