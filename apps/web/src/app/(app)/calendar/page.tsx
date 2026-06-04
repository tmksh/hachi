"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  addDays,
  addMinutes,
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
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { TimeSelect } from "@/components/ui/time-select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Link2,
  CheckCircle2,
  RefreshCw,
  LogOut,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getCalendarEvents,
  updateCalendarEvent,
  deleteCalendarEvent,
  disconnectGoogleCalendar,
  getCompanyMembersWithCalendar,
} from "@/lib/actions/calendar";
import type { CalendarEvent } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { fetchGoogleCalendarEvents, mapGoogleEvent, type MappedGoogleEvent, updateGoogleCalendarEvent, deleteGoogleCalendarEvent } from "@/lib/google-calendar";
import { useAuth } from "@/hooks/use-auth";

type Ev = Awaited<ReturnType<typeof getCalendarEvents>>[number];
type AnyEv = (Ev | MappedGoogleEvent) & { _isGoogle?: true; _htmlLink?: string; _memberId?: string; _memberColor?: string };
type View = "day" | "week" | "month";

type MemberCalendar = {
  id: string;
  display_name: string;
  email: string;
  color: string;
  checked: boolean;
};

const MEMBER_COLORS = ["#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#14b8a6"];

/* ─── Week-view time grid constants ─── */
const PX_PER_MIN = 1.2;       // 1px per minute → 72px/hr
const HOUR_H = PX_PER_MIN * 60;
const SNAP_MIN = 15;

type DragInfo = {
  type: "move" | "resize";
  ev: AnyEv;
  originalStart: number;   // minutes from midnight
  originalEnd: number;
  clickOffsetMin: number;  // offset within event when clicked (move only)
  currentStart: number;
  currentEnd: number;
  currentDay: Date;
};

function toMin(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}
function snapTo(m: number) {
  return Math.round(m / SNAP_MIN) * SNAP_MIN;
}
function minToTimeStr(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

const CATEGORIES = ["sales", "construction", "task", "facility", "equipment"] as const;

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

export default function CalendarPage() {
  const { profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<View>("week");
  const [hiddenCats, setHiddenCats] = useState<Set<string>>(new Set());
  const [events, setEvents] = useState<Ev[]>([]);
  const [googleEvents, setGoogleEvents] = useState<MappedGoogleEvent[]>([]);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleAccountEmail, setGoogleAccountEmail] = useState<string | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeEvent, setActiveEvent] = useState<AnyEv | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // チームカレンダー
  const [memberCalendars, setMemberCalendars] = useState<MemberCalendar[]>([]);
  const [memberEvents, setMemberEvents] = useState<Record<string, MappedGoogleEvent[]>>({});

  const openEvent = useCallback((ev: AnyEv) => {
    // Google イベントも含めダイアログで表示（外部遷移しない）
    setActiveEvent(ev);
  }, []);
  const refreshEvents = useCallback(() => setReloadKey((k) => k + 1), []);
  const router = useRouter();
  const newEventHref = (d: Date) =>
    `/calendar/new?date=${format(d, "yyyy-MM-dd")}`;
  const createAtSlot = useCallback(
    (d: Date, hhmm?: string) => {
      const dateStr = format(d, "yyyy-MM-dd");
      const qs = hhmm ? `?date=${dateStr}&time=${hhmm}` : `?date=${dateStr}`;
      router.push(`/calendar/new${qs}`);
    },
    [router]
  );

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (view === "day") {
      return { rangeStart: startOfDay(currentDate), rangeEnd: endOfDay(currentDate) };
    }
    if (view === "week") {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
      return {
        rangeStart: ws,
        rangeEnd: addDays(ws, 6),
      };
    }
    const ms = startOfMonth(currentDate);
    const me = endOfMonth(currentDate);
    return {
      rangeStart: startOfWeek(ms, { weekStartsOn: 0 }),
      rangeEnd: endOfWeek(me, { weekStartsOn: 0 }),
    };
  }, [currentDate, view]);

  /* ローカルイベント取得 */
  useEffect(() => {
    setLoading(true);
    getCalendarEvents({ start: rangeStart.toISOString(), end: rangeEnd.toISOString() })
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [rangeStart, rangeEnd, reloadKey]);

  /* Google Calendar イベント取得 */
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      let token: string | null = session?.provider_token ?? null;

      if (!token) {
        try {
          const res = await fetch("/api/google-token");
          if (res.ok) {
            const data = await res.json();
            token = data.access_token ?? null;
          }
        } catch {
          // ignore
        }
      }

      if (!token) {
        setGoogleConnected(false);
        setGoogleToken(null);
        setGoogleEvents([]);
        return;
      }

      setGoogleConnected(true);
      setGoogleToken(token);
      fetchGoogleCalendarEvents(
        token,
        rangeStart.toISOString(),
        rangeEnd.toISOString(),
      ).then((gEvs) => setGoogleEvents(gEvs.map(mapGoogleEvent)));
    });
  }, [rangeStart, rangeEnd, reloadKey]);

  /* 連携している Google アカウントのメール取得 */
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const googleIdentity = user?.identities?.find((i) => i.provider === "google");
      const email =
        (googleIdentity?.identity_data?.email as string | undefined) ??
        (user?.user_metadata?.email as string | undefined) ??
        null;
      setGoogleAccountEmail(email);
    });
  }, [reloadKey]);

  /* Google Calendar連携しているチームメンバーを取得 */
  useEffect(() => {
    getCompanyMembersWithCalendar().then((members) => {
      setMemberCalendars(
        members.map((m, i) => ({
          ...m,
          color: MEMBER_COLORS[i % MEMBER_COLORS.length],
          checked: false,
        }))
      );
    });
  }, [reloadKey]);

  /* メンバーのGoogleカレンダーイベントを取得 */
  const fetchMemberEvents = useCallback(async (memberId: string, start: string, end: string) => {
    try {
      const res = await fetch(
        `/api/google-calendar/member-events?userId=${memberId}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
      );
      if (!res.ok) return [];
      const data = await res.json();
      return (data.events ?? []).map(mapGoogleEvent) as MappedGoogleEvent[];
    } catch {
      return [];
    }
  }, []);

  /* チェック変更時にイベントを取得/削除 */
  const toggleMemberCalendar = useCallback(async (memberId: string) => {
    setMemberCalendars((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, checked: !m.checked } : m))
    );
    const member = memberCalendars.find((m) => m.id === memberId);
    if (!member) return;
    if (!member.checked) {
      // チェックON → イベント取得
      const evs = await fetchMemberEvents(memberId, rangeStart.toISOString(), rangeEnd.toISOString());
      setMemberEvents((prev) => ({ ...prev, [memberId]: evs }));
    } else {
      // チェックOFF → イベント削除
      setMemberEvents((prev) => {
        const next = { ...prev };
        delete next[memberId];
        return next;
      });
    }
  }, [memberCalendars, fetchMemberEvents, rangeStart, rangeEnd]);

  /* 表示期間変更時にチェック済みメンバーのイベントを再取得 */
  useEffect(() => {
    const checkedMembers = memberCalendars.filter((m) => m.checked);
    if (checkedMembers.length === 0) return;
    Promise.all(
      checkedMembers.map(async (m) => {
        const evs = await fetchMemberEvents(m.id, rangeStart.toISOString(), rangeEnd.toISOString());
        return [m.id, evs] as [string, MappedGoogleEvent[]];
      })
    ).then((results) => {
      setMemberEvents(Object.fromEntries(results));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart, rangeEnd]);

  /* Google 連携を開始 / 再連携 */
  const connectGoogle = useCallback(async () => {
    setConnectingGoogle(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=/calendar`,
        scopes: "https://www.googleapis.com/auth/calendar",
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
    if (error) {
      toast.error("Google 連携に失敗しました");
      setConnectingGoogle(false);
    }
  }, []);

  const disconnectGoogle = useCallback(async () => {
    if (!confirm("Google カレンダーの連携を解除しますか？")) return;
    setDisconnectingGoogle(true);
    try {
      await disconnectGoogleCalendar();
      setGoogleConnected(false);
      setGoogleEvents([]);
      setGoogleAccountEmail(null);
      toast.success("Google カレンダーの連携を解除しました");
    } catch {
      toast.error("解除に失敗しました");
    } finally {
      setDisconnectingGoogle(false);
    }
  }, []);

  const visibleEvents = useMemo(() => {
    const local = events.filter((e) => !hiddenCats.has(e.category ?? ""));
    const goog  = hiddenCats.has("google") ? [] : googleEvents;
    // チームメンバーのイベントをマージ（メンバー色を付与）
    const memberEvList: AnyEv[] = memberCalendars
      .filter((m) => m.checked)
      .flatMap((m) =>
        (memberEvents[m.id] ?? []).map((ev) => ({
          ...ev,
          _memberId: m.id,
          _memberColor: m.color,
        } as AnyEv))
      );
    return [...local, ...goog, ...memberEvList] as AnyEv[];
  }, [events, googleEvents, hiddenCats, memberCalendars, memberEvents]);

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
          ? subDays(currentDate, 7)
          : subMonths(currentDate, 1)
    );
  };
  const goNext = () => {
    setCurrentDate(
      view === "day"
        ? addDays(currentDate, 1)
        : view === "week"
          ? addDays(currentDate, 7)
          : addMonths(currentDate, 1)
    );
  };

  const titleText =
    view === "day"
      ? format(currentDate, "yyyy年M月d日（E）", { locale: ja })
      : view === "week"
        ? (() => {
            const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
            const we = addDays(ws, 6);
            return isSameMonth(ws, we)
              ? format(ws, "yyyy年M月", { locale: ja })
              : `${format(ws, "yyyy年M月", { locale: ja })} – ${format(we, "M月", { locale: ja })}`;
          })()
        : format(currentDate, "yyyy年M月", { locale: ja });

  const selectedDateEvents = useMemo(
    () => visibleEvents.filter((e) => isSameDay(parseISO(e.start_at), selectedDate)),
    [visibleEvents, selectedDate]
  );

  return (
    <div className="md:h-screen md:flex md:flex-col p-4 md:p-8 md:gap-3 space-y-4 md:space-y-0 md:overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between md:shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">カレンダー</h1>
          <p className="text-sm text-muted-foreground mt-1">スケジュール管理</p>
        </div>

        {/* ログイン中のユーザー表示 */}
        {profile && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/50 border border-white/60 backdrop-blur-sm shadow-sm">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {profile.display_name?.charAt(0) ?? "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-medium text-foreground">{profile.display_name}</span>
              <span className="text-[10px] text-muted-foreground">{profile.email}</span>
            </div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3 md:shrink-0">
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

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4 md:flex-1 md:min-h-0 md:grid-rows-1">
        {/* Left sidebar */}
        <aside className="calendar-sidebar space-y-3 md:overflow-y-auto md:pr-1 md:pb-1 md:min-h-0">
          <MiniCalendar
            selected={selectedDate}
            onSelect={(d) => {
              setSelectedDate(d);
              setCurrentDate(d);
            }}
          />

          {/* Connected accounts panel */}
          <ConnectedAccountsPanel
            googleConnected={googleConnected}
            googleAccountEmail={googleAccountEmail}
            connectingGoogle={connectingGoogle}
            disconnectingGoogle={disconnectingGoogle}
            onConnectGoogle={connectGoogle}
            onDisconnectGoogle={disconnectGoogle}
          />

          {/* Team members' calendars */}
          {memberCalendars.length > 0 && (
            <Card>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <svg className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <h3 className="text-xs font-semibold">チームカレンダー</h3>
                </div>
                <div className="space-y-1">
                  {memberCalendars.map((m) => (
                    <label
                      key={m.id}
                      className="flex items-center gap-2 px-1.5 py-1.5 rounded-md hover:bg-muted/40 transition-colors cursor-pointer"
                    >
                      <Checkbox
                        checked={m.checked}
                        onCheckedChange={() => toggleMemberCalendar(m.id)}
                        className="h-3.5 w-3.5"
                      />
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: m.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{m.display_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{m.email}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tasks panel (moved from right sidebar) */}
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
                  <p className="text-xs text-muted-foreground text-center py-6">
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

          {/* Category filter */}
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

              {/* Google カレンダー */}
              {googleConnected && (
                <>
                  <div className="border-t border-border/40 my-1.5" />
                  <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/40 rounded-md px-1.5 py-1.5">
                    <Checkbox
                      checked={!hiddenCats.has("google")}
                      onCheckedChange={() => toggleCat("google")}
                      className="h-3.5 w-3.5"
                    />
                    <span className="h-2 w-2 rounded-full bg-sky-400" />
                    <span className="flex-1 flex items-center gap-1">
                      <svg className="h-3 w-3" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Google カレンダー
                    </span>
                    <span className="text-muted-foreground tabular-nums">{googleEvents.length}</span>
                  </label>
                </>
              )}
            </CardContent>
          </Card>
        </aside>

        {/* Main calendar */}
        <div className="min-w-0 md:h-full md:min-h-0 md:flex md:flex-col">
          {loading ? (
            <Skeleton className="h-[600px] md:h-full w-full" />
          ) : view === "month" ? (
            <MonthView
              date={currentDate}
              selected={selectedDate}
              onSelect={setSelectedDate}
              events={visibleEvents}
              onEventClick={openEvent}
              onCreateAt={createAtSlot}
            />
          ) : view === "week" ? (
            <WeekView
              date={currentDate}
              selected={selectedDate}
              onSelect={setSelectedDate}
              events={visibleEvents}
              onEventClick={openEvent}
              onRefresh={refreshEvents}
              onCreateAt={createAtSlot}
            />
          ) : (
            <DayView
              date={currentDate}
              events={visibleEvents}
              onEventClick={openEvent}
              onCreateAt={createAtSlot}
            />
          )}
        </div>
      </div>

      <EventDialog
        event={activeEvent}
        googleToken={googleToken}
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

/* ──────────────────── Connected Accounts Panel ──────────────────── */
type ConnectedAccountsPanelProps = {
  googleConnected: boolean;
  googleAccountEmail: string | null;
  connectingGoogle: boolean;
  disconnectingGoogle: boolean;
  onConnectGoogle: () => void;
  onDisconnectGoogle: () => void;
};

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function ConnectedAccountsPanel({
  googleConnected,
  googleAccountEmail,
  connectingGoogle,
  disconnectingGoogle,
  onConnectGoogle,
  onDisconnectGoogle,
}: ConnectedAccountsPanelProps) {
  return (
    <Card>
      <CardContent className="py-3 px-4 space-y-2">
        <div className="flex items-center gap-1.5 mb-1">
          <Link2 className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-semibold">連携アカウント</h3>
        </div>

        {/* Google */}
        <div className="flex items-center gap-2 px-1.5 py-1.5 rounded-md hover:bg-muted/40 transition-colors">
          <GoogleLogo className="h-4 w-4 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium leading-tight whitespace-nowrap">Google カレンダー</div>
            <div className="text-[10px] text-muted-foreground truncate">
              {googleConnected
                ? googleAccountEmail ?? "連携済み"
                : "未連携"}
            </div>
          </div>
          {googleConnected ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  disabled={connectingGoogle || disconnectingGoogle}
                  className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
                >
                  {connectingGoogle || disconnectingGoogle ? (
                    <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-2.5 w-2.5" />
                  )}
                  連携中
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-xs">
                <DropdownMenuItem
                  className="text-[12px] gap-2"
                  onClick={onConnectGoogle}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  再連携（トークン更新）
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-[12px] gap-2 text-destructive focus:text-destructive"
                  onClick={onDisconnectGoogle}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  連携を解除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              onClick={onConnectGoogle}
              disabled={connectingGoogle}
              className="text-[10px] font-medium text-primary hover:underline disabled:opacity-50"
            >
              {connectingGoogle ? "接続中..." : "連携する"}
            </button>
          )}
        </div>

        {/* 将来の連携サービス用プレースホルダ */}
        <div className="flex items-center gap-2 px-1.5 py-1.5 rounded-md opacity-60">
          <div className="h-4 w-4 shrink-0 rounded-sm bg-[#0078D4] flex items-center justify-center">
            <span className="text-[8px] font-bold text-white">M</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium leading-tight">Microsoft 365</div>
            <div className="text-[10px] text-muted-foreground">近日対応予定</div>
          </div>
          <span className="text-[10px] text-muted-foreground border border-border rounded-full px-1.5 py-0.5">
            準備中
          </span>
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
  onCreateAt,
}: {
  date: Date;
  selected: Date;
  onSelect: (d: Date) => void;
  events: AnyEv[];
  onEventClick: (ev: AnyEv) => void;
  onCreateAt: (d: Date, hhmm?: string) => void;
}) {
  const ms = startOfMonth(date);
  const me = endOfMonth(date);
  const gs = startOfWeek(ms, { weekStartsOn: 0 });
  const ge = endOfWeek(me, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gs, end: ge });

  const numWeeks = days.length / 7;

  return (
    <Card className="overflow-hidden py-0 md:flex md:flex-col md:h-full md:min-h-0">
      <div className="grid grid-cols-7 border-b md:shrink-0">
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
      <div
        className="grid grid-cols-7 md:flex-1 md:min-h-0"
        style={{ gridTemplateRows: `repeat(${numWeeks}, minmax(0, 1fr))` }}
      >
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
              onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCreateAt(d);
              }}
              title="ダブルクリックで予定を追加"
              className={cn(
                "min-h-[100px] md:min-h-0 md:h-full p-1.5 text-left transition-colors relative flex flex-col overflow-hidden",
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
              <div className="space-y-0.5 flex-1 min-h-0 overflow-hidden">
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
                      (ev as AnyEv)._memberColor
                        ? ""
                        : CAT_CHIP[ev.category ?? ""] ||
                          "bg-muted text-foreground border-border"
                    )}
                    style={
                      (ev as AnyEv)._memberColor
                        ? {
                            backgroundColor: `${(ev as AnyEv)._memberColor}22`,
                            color: (ev as AnyEv)._memberColor,
                            borderColor: `${(ev as AnyEv)._memberColor}55`,
                          }
                        : undefined
                    }
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

/* ──────────────────── Week View (Google Calendar style, horizontal scroll) ──────────────────── */
const DAY_COL_W = 160; // px per day column
const TIME_W    = 52;  // px for time label gutter

function WeekView({
  date,
  selected,
  onSelect,
  events,
  onEventClick,
  onRefresh,
  onCreateAt,
}: {
  date: Date;
  selected: Date;
  onSelect: (d: Date) => void;
  events: AnyEv[];
  onEventClick: (ev: AnyEv) => void;
  onRefresh: () => void;
  onCreateAt: (d: Date, hhmm?: string) => void;
}) {
  // 週ビュー: 選択日を含む週（月曜始まり）の7日間のみ表示
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });

  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef   = useRef<HTMLDivElement>(null);

  /* Column width — fit exactly 7 days into the visible scroll area */
  const [colW, setColW] = useState(120);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const calc = () => {
      const available = el.clientWidth - TIME_W;
      setColW(Math.max(80, Math.floor(available / 7)));
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const DAY_COL_W_DYN = colW;

  const [dragging, setDragging] = useState<DragInfo | null>(null);
  const dragRef = useRef<DragInfo | null>(null);

  /* 週変更時に縦スクロールを 8:00 付近にリセット（横スクロールは7日固定のため不要） */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = 7.5 * HOUR_H;
    el.scrollLeft = 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  /* Current time indicator */
  const [nowMin, setNowMin] = useState(() => toMin(new Date()));
  useEffect(() => {
    const id = setInterval(() => setNowMin(toMin(new Date())), 60_000);
    return () => clearInterval(id);
  }, []);

  /* Coordinate helpers — account for scroll offset */
  const getMinFromY = useCallback((clientY: number) => {
    const scroll = scrollRef.current;
    if (!scroll) return 0;
    const rect = scroll.getBoundingClientRect();
    const y = clientY - rect.top + scroll.scrollTop;
    return Math.max(0, Math.min(1439, Math.floor(y / PX_PER_MIN)));
  }, []);

  const getDayFromX = useCallback((clientX: number): Date => {
    const scroll = scrollRef.current;
    if (!scroll) return days[0];
    const rect = scroll.getBoundingClientRect();
    const x = clientX - rect.left + scroll.scrollLeft - TIME_W;
    const idx = Math.max(0, Math.min(days.length - 1, Math.floor(x / DAY_COL_W_DYN)));
    return days[idx];
  }, [days]);

  /* Start drag */
  const startDrag = useCallback((
    e: React.MouseEvent,
    ev: AnyEv,
    type: "move" | "resize",
  ) => {
    if ((ev as MappedGoogleEvent)._isGoogle) return;
    e.preventDefault();
    e.stopPropagation();
    const startDt = parseISO(ev.start_at);
    const endDt   = ev.end_at ? parseISO(ev.end_at) : addMinutes(startDt, 60);
    const sMin = toMin(startDt);
    const eMin = toMin(endDt);
    const clickMin = getMinFromY(e.clientY);
    const info: DragInfo = {
      type,
      ev,
      originalStart: sMin,
      originalEnd: eMin,
      clickOffsetMin: type === "move" ? clickMin - sMin : 0,
      currentStart: sMin,
      currentEnd: eMin,
      currentDay: startDt,
    };
    dragRef.current = info;
    setDragging({ ...info });
  }, [getMinFromY]);

  /* Global mouse handlers during drag */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const info = dragRef.current;
      if (!info) return;
      const clickMin = getMinFromY(e.clientY);
      let updated: DragInfo;
      if (info.type === "move") {
        const dur = info.originalEnd - info.originalStart;
        const newStart = snapTo(Math.max(0, Math.min(1440 - dur, clickMin - info.clickOffsetMin)));
        updated = { ...info, currentStart: newStart, currentEnd: newStart + dur, currentDay: getDayFromX(e.clientX) };
      } else {
        const newEnd = snapTo(Math.max(info.currentStart + 15, Math.min(1440, clickMin)));
        updated = { ...info, currentEnd: newEnd };
      }
      dragRef.current = updated;
      setDragging({ ...updated });
    };

    const onUp = async () => {
      const info = dragRef.current;
      if (!info) return;
      dragRef.current = null;
      setDragging(null);

      const origDay = parseISO(info.ev.start_at);
      const noChange =
        info.currentStart === info.originalStart &&
        info.currentEnd   === info.originalEnd &&
        isSameDay(info.currentDay, origDay);
      if (noChange) return;

      const day = info.currentDay;
      const newStartDt = new Date(day.getFullYear(), day.getMonth(), day.getDate(),
        Math.floor(info.currentStart / 60), info.currentStart % 60, 0);
      const endMin = info.type === "move"
        ? info.currentStart + (info.originalEnd - info.originalStart)
        : info.currentEnd;
      const newEndDt = new Date(day.getFullYear(), day.getMonth(), day.getDate(),
        Math.floor(endMin / 60), endMin % 60, 0);

      try {
        await updateCalendarEvent(info.ev.id, {
          start_at: format(newStartDt, "yyyy-MM-dd'T'HH:mm:ss"),
          end_at:   format(newEndDt,   "yyyy-MM-dd'T'HH:mm:ss"),
        });
        onRefresh();
      } catch {
        toast.error("更新に失敗しました");
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [getMinFromY, getDayFromX, onRefresh]);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const isDraggingRef = useRef(false);
  const innerW = TIME_W + days.length * DAY_COL_W_DYN;

  return (
    <Card className="overflow-hidden py-0 select-none md:flex md:flex-col md:h-full md:min-h-0">
      {/* Single scroll container — both X (day columns) and Y (time) */}
      <div
        ref={scrollRef}
        className="overflow-auto md:flex-1 md:min-h-0 max-h-[600px] md:!max-h-none"
      >
        <div style={{ minWidth: innerW }}>

          {/* Sticky day header row */}
          <div
            className="grid border-b bg-background"
            style={{
              gridTemplateColumns: `${TIME_W}px repeat(${days.length}, ${DAY_COL_W_DYN}px)`,
              position: "sticky",
              top: 0,
              zIndex: 10,
            }}
          >
            <div
              className="border-r bg-background"
              style={{ position: "sticky", left: 0, zIndex: 15, width: TIME_W }}
            />
            {days.map((d) => {
              const today   = isToday(d);
              const isSel   = isSameDay(d, selected);
              const weekday = d.getDay();
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => onSelect(d)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2 border-r last:border-r-0 transition-colors hover:bg-muted/40",
                    isSel && "bg-primary/5",
                  )}
                >
                  <span className={cn(
                    "text-[10px] font-medium",
                    weekday === 0 ? "text-rose-500" : weekday === 6 ? "text-blue-500" : "text-muted-foreground",
                  )}>
                    {format(d, "E", { locale: ja })}
                  </span>
                  <span className={cn(
                    "text-base font-semibold tabular-nums h-7 w-7 rounded-full flex items-center justify-center",
                    today && "bg-primary text-primary-foreground",
                  )}>
                    {format(d, "d")}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="flex relative">
            {/* Sticky time label gutter */}
            <div
              className="shrink-0 border-r bg-background relative"
              style={{
                width: TIME_W,
                height: 24 * HOUR_H,
                position: "sticky",
                left: 0,
                zIndex: 5,
              }}
            >
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute text-[10px] text-muted-foreground text-right"
                  style={{ top: h * HOUR_H - 6, right: 6, lineHeight: "12px" }}
                >
                  {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
                </div>
              ))}
            </div>

            {/* Day columns */}
            <div
              ref={gridRef}
              className="flex"
              style={{ cursor: dragging ? "grabbing" : "default" }}
            >
              {days.map((d) => {
                const today = isToday(d);

                const colEvents = events.filter((e) => {
                  if (e.all_day) return false;
                  if (dragging?.ev.id === e.id) return isSameDay(dragging!.currentDay, d);
                  return isSameDay(parseISO(e.start_at), d);
                }).sort((a, b) => a.start_at.localeCompare(b.start_at));

                return (
                  <div
                    key={d.toISOString()}
                    className="relative border-r last:border-r-0 cursor-pointer"
                    style={{ width: DAY_COL_W_DYN, flexShrink: 0, height: 24 * HOUR_H }}
                    title="クリックで予定を追加"
                    onClick={(e) => {
                      if (isDraggingRef.current || dragRef.current) return;
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const y = e.clientY - rect.top;
                      const min = Math.max(0, Math.min(1439, Math.floor(y / PX_PER_MIN)));
                      const snapped = snapTo(min);
                      const hh = String(Math.floor(snapped / 60)).padStart(2, "0");
                      const mm = String(snapped % 60).padStart(2, "0");
                      onCreateAt(d, `${hh}:${mm}`);
                    }}
                  >
                    {/* Hour / half-hour lines */}
                    {hours.map((h) => (
                      <div key={h}>
                        <div className="absolute w-full border-t border-slate-300/70" style={{ top: h * HOUR_H }} />
                        <div className="absolute w-full border-t border-slate-200/40 border-dashed" style={{ top: h * HOUR_H + HOUR_H / 2 }} />
                      </div>
                    ))}

                    {/* Current time indicator */}
                    {today && (
                      <div
                        className="absolute w-full z-20 pointer-events-none"
                        style={{ top: nowMin * PX_PER_MIN }}
                      >
                        <div className="relative flex items-center">
                          <div className="absolute -left-1 h-2.5 w-2.5 rounded-full bg-red-500 z-10" />
                          <div className="w-full h-px bg-red-500" />
                        </div>
                      </div>
                    )}

                    {/* Events */}
                    {colEvents.map((ev) => {
                      const isDraggingThis = dragging?.ev.id === ev.id;
                      const startDt = parseISO(ev.start_at);
                      const endDt   = ev.end_at ? parseISO(ev.end_at) : addMinutes(startDt, 60);
                      const sMin = isDraggingThis ? dragging!.currentStart : toMin(startDt);
                      const eMin = isDraggingThis ? dragging!.currentEnd   : toMin(endDt);
                      const top    = sMin * PX_PER_MIN;
                      const height = Math.max(20, (eMin - sMin) * PX_PER_MIN);
                      const memberColor = (ev as AnyEv)._memberColor;

                      return (
                        <div
                          key={ev.id}
                          className={cn(
                            "absolute left-0.5 right-0.5 rounded border text-[10px] overflow-hidden z-10",
                            !memberColor && (CAT_CHIP[ev.category ?? ""] || "bg-muted text-foreground border-border"),
                            isDraggingThis ? "opacity-60 cursor-grabbing shadow-lg" : "cursor-grab hover:brightness-95 hover:shadow-sm",
                          )}
                          style={{
                            top, height,
                            ...(memberColor ? {
                              backgroundColor: `${memberColor}22`,
                              color: memberColor,
                              borderColor: `${memberColor}55`,
                            } : {}),
                          }}
                          onMouseDown={(e) => {
                            isDraggingRef.current = false;
                            startDrag(e, ev, "move");
                          }}
                          onClick={(e) => {
                            if (!isDraggingRef.current) {
                              e.stopPropagation();
                              onEventClick(ev);
                            }
                          }}
                        >
                          <div className="px-1 pt-0.5 flex flex-col h-full">
                            <div className="font-semibold tabular-nums shrink-0">
                              {isDraggingThis
                                ? minToTimeStr(dragging!.currentStart)
                                : format(startDt, "HH:mm")}
                            </div>
                            <div className="truncate">{ev.title}</div>
                          </div>
                          {/* Resize handle */}
                          <div
                            className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize hover:bg-black/10 rounded-b"
                            title="ドラッグして長さを変更"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              isDraggingRef.current = true;
                              startDrag(e, ev, "resize");
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </Card>
  );
}

/* ──────────────────── Day View ──────────────────── */
function DayView({
  date,
  events,
  onEventClick,
  onCreateAt,
}: {
  date: Date;
  events: AnyEv[];
  onEventClick: (ev: AnyEv) => void;
  onCreateAt: (d: Date, hhmm?: string) => void;
}) {
  const dayEvents = events
    .filter((e) => isSameDay(parseISO(e.start_at), date))
    .sort((a, b) => a.start_at.localeCompare(b.start_at));

  return (
    <Card className="md:flex md:flex-col md:h-full md:min-h-0">
      <CardContent className="py-4 px-5 md:flex-1 md:min-h-0 md:overflow-y-auto md:flex md:flex-col">
        <h3 className="text-sm font-semibold mb-4 md:shrink-0">
          {format(date, "yyyy年M月d日（E）", { locale: ja })}
        </h3>
        {dayEvents.length === 0 ? (
          <button
            type="button"
            onClick={() => onCreateAt(date)}
            className="text-sm text-muted-foreground text-center py-16 md:flex-1 md:flex md:items-center md:justify-center hover:bg-muted/40 rounded transition-colors cursor-pointer"
            title="クリックで予定を追加"
          >
            この日は予定がありません（クリックで追加）
          </button>
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
            <button
              type="button"
              onClick={() => onCreateAt(date)}
              className="w-full text-sm text-muted-foreground py-3 rounded-md border border-dashed hover:bg-muted/40 transition-colors cursor-pointer flex items-center justify-center gap-1"
              title="クリックで予定を追加"
            >
              <Plus className="h-3.5 w-3.5" />
              予定を追加
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ──────────────────── Event Dialog ──────────────────── */
function EventDialog({
  event,
  googleToken,
  onOpenChange,
  onSaved,
  onDeleted,
}: {
  event: AnyEv | null;
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
      const start_at = `${startDate}T${startTime}:00`;
      const end_at = `${endDate || startDate}T${endTime}:00`;

      await updateCalendarEvent(event.id, {
        title: title.trim(),
        description: description || null,
        start_at,
        end_at,
        all_day: allDay,
        category: (category || null) as CalendarEvent["category"],
        location: location || null,
      });

      // Google Calendar にも反映（ローカルイベントで google_event_id がある場合）
      const gId = (event as { google_event_id?: string }).google_event_id;
      if (googleToken && gId) {
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
      // Google Calendar にも反映
      const gId = (event as { google_event_id?: string }).google_event_id;
      if (googleToken && gId) {
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
                <TimeSelect
                  value={startTime}
                  disabled={allDay}
                  onChange={setStartTime}
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
                <TimeSelect
                  value={endTime}
                  disabled={allDay}
                  onChange={setEndTime}
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
