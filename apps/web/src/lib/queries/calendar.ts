import { addDays, endOfDay, startOfDay, startOfWeek } from "date-fns";
import { browserAuthContext } from "./browser-auth";
import { createClient } from "@/lib/supabase/client";

export const CALENDAR_STALE_MS = 60_000;

export const CAL_QK = {
  events: (start: string, end: string) => ["calendar-events", start, end] as const,
  membersWithCalendar: ["calendar-members-gcal"] as const,
  members: ["calendar-members"] as const,
};

export type CalendarMember = { id: string; display_name: string; email: string };

export async function fetchCalendarEvents(start: string, end: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*, customer:customers(id, name)")
    .gte("start_at", start)
    .lte("end_at", end)
    .order("start_at");
  if (error) throw new Error(error.message || "予定の取得に失敗しました");
  return data ?? [];
}

export async function fetchCompanyMembersWithCalendar(): Promise<CalendarMember[]> {
  const { supabase, user, profile: myProfile } = await browserAuthContext();
  if (!user) return [];
  if (!myProfile?.company_id) return [];
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .eq("company_id", myProfile.company_id)
    .neq("id", user.id)
    .not("google_access_token", "is", null);
  return (data ?? []) as CalendarMember[];
}

export async function fetchCompanyMembers(): Promise<CalendarMember[]> {
  const { supabase, user, profile: myProfile } = await browserAuthContext();
  if (!user) return [];
  if (!myProfile?.company_id) return [];
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .eq("company_id", myProfile.company_id)
    .neq("id", user.id)
    .order("display_name");
  return (data ?? []) as CalendarMember[];
}

/** カレンダー既定ビュー（週・月曜始まり）の範囲。hover 先読みと画面で揃える */
export function currentCalendarWeekRange(now = new Date()) {
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  return {
    start: startOfDay(weekStart).toISOString(),
    end: endOfDay(addDays(weekStart, 6)).toISOString(),
  };
}
