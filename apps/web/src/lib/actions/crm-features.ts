"use server";

import { addDays, format, isSunday, setHours, setMinutes, startOfDay } from "date-fns";
import { ja } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";

async function getCompanyContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");
  return { supabase, company_id: profile.company_id, user_id: user.id };
}

export type SchedulingCandidate = {
  id: string;
  date: string;
  timeLabel: string;
  displayLabel: string;
  note?: string;
  aiScore?: number;
};

type BusyBlock = { start: Date; end: Date; location: string | null };

const SLOT_HOURS: Record<"morning" | "afternoon" | "evening" | "anytime", number[]> = {
  morning: [10],
  afternoon: [14],
  evening: [18],
  anytime: [10, 14, 16],
};

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

function slotOnDay(day: Date, hour: number, durationMinutes: number) {
  const start = setMinutes(setHours(startOfDay(day), hour), 0);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { start, end };
}

function scoreCandidate(
  day: Date,
  slotStart: Date,
  slotEnd: Date,
  blocks: BusyBlock[],
  meetingType: "in_person" | "online" | "phone",
) {
  const dayBlocks = blocks.filter((b) => startOfDay(b.start).getTime() === startOfDay(day).getTime());
  let score = 100 - dayBlocks.length * 8;

  if (meetingType === "in_person") {
    const travelBufferMs = 90 * 60_000;
    const hasNearby = dayBlocks.some((b) => {
      const gapBefore = slotStart.getTime() - b.end.getTime();
      const gapAfter = b.start.getTime() - slotEnd.getTime();
      return (gapBefore >= 0 && gapBefore < travelBufferMs) || (gapAfter >= 0 && gapAfter < travelBufferMs);
    });
    const hasOffsite = dayBlocks.some((b) => !!b.location?.trim());
    if (hasNearby) score -= 25;
    if (hasOffsite) score -= 10;
  }

  if (meetingType === "phone" || meetingType === "online") score += 5;
  return Math.max(0, score);
}

function buildNote(
  score: number,
  meetingType: "in_person" | "online" | "phone",
  aiOptimized: boolean,
) {
  if (!aiOptimized) return undefined;
  if (meetingType === "in_person" && score < 75) return "移動時間を考慮した候補";
  if (score >= 85) return "空き時間が多い日";
  return "カレンダー空きを基準に選定";
}

async function fetchBusyBlocks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<{ blocks: BusyBlock[]; calendarLinked: boolean }> {
  const blocks: BusyBlock[] = [];

  const { data: localEvents } = await supabase
    .from("calendar_events")
    .select("start_at, end_at, location")
    .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
    .gte("start_at", rangeStart.toISOString())
    .lte("start_at", rangeEnd.toISOString());

  for (const event of localEvents ?? []) {
    blocks.push({
      start: new Date(event.start_at),
      end: new Date(event.end_at),
      location: event.location,
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("google_access_token")
    .eq("id", userId)
    .single();

  const calendarLinked = !!profile?.google_access_token;
  if (profile?.google_access_token) {
    try {
      const gcRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${new URLSearchParams({
          timeMin: rangeStart.toISOString(),
          timeMax: rangeEnd.toISOString(),
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "200",
        })}`,
        { headers: { Authorization: `Bearer ${profile.google_access_token}` } },
      );
      if (gcRes.ok) {
        const gcData = await gcRes.json() as { items?: Array<{ start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; location?: string }> };
        for (const item of gcData.items ?? []) {
          const startRaw = item.start?.dateTime ?? item.start?.date;
          const endRaw = item.end?.dateTime ?? item.end?.date;
          if (!startRaw || !endRaw) continue;
          blocks.push({
            start: new Date(startRaw),
            end: new Date(endRaw),
            location: item.location ?? null,
          });
        }
      }
    } catch {
      // Google取得失敗時はローカル予定のみ
    }
  }

  return { blocks, calendarLinked };
}

export async function proposeSchedulingCandidates(input: {
  meeting_type: "in_person" | "online" | "phone";
  time_slot: "morning" | "afternoon" | "evening" | "anytime";
  duration_minutes: number;
  ai_optimized?: boolean;
  customer_id?: string;
}) {
  const { supabase, user_id, company_id } = await getCompanyContext();
  const rangeStart = startOfDay(new Date());
  const rangeEnd = addDays(rangeStart, 21);
  const { blocks, calendarLinked } = await fetchBusyBlocks(supabase, user_id, rangeStart, rangeEnd);

  const hours = SLOT_HOURS[input.time_slot];
  const options: SchedulingCandidate[] = [];

  for (let offset = 1; offset <= 21; offset += 1) {
    const day = addDays(rangeStart, offset);
    if (isSunday(day)) continue;

    for (const hour of hours) {
      const { start, end } = slotOnDay(day, hour, input.duration_minutes);
      const busy = blocks.some((b) => overlaps(start, end, b.start, b.end));
      if (busy) continue;

      const dateKey = format(day, "yyyy-MM-dd");
      const timeLabel = input.time_slot === "anytime" ? format(start, "HH:mm") : format(start, "HH:mm");
      const displayDate = format(day, "yyyy/MM/dd (EEE)", { locale: ja });
      const aiScore = input.ai_optimized
        ? scoreCandidate(day, start, end, blocks, input.meeting_type)
        : undefined;

      options.push({
        id: `${dateKey}-${timeLabel}`,
        date: dateKey,
        timeLabel,
        displayLabel: `${displayDate} ${timeLabel}`,
        aiScore,
        note: aiScore != null ? buildNote(aiScore, input.meeting_type, true) : undefined,
      });
    }
  }

  const candidates = (input.ai_optimized
    ? [...options].sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0))
    : options
  ).slice(0, 5);

  if (candidates.length === 0) {
    const { notifySalesFlowUser } = await import("@/lib/actions/sales-flow");
    await notifySalesFlowUser(supabase, company_id, user_id, {
      title: "スケジュール調整: 空き候補なし",
      description: "今後3週間で空き時間が見つかりませんでした。カレンダーを確認するか、手動で調整してください。",
      href: input.customer_id ? `/crm/${input.customer_id}?tab=scheduling` : "/calendar",
      customerId: input.customer_id,
      urgent: true,
    }, user_id);
  }

  return {
    candidates,
    calendarLinked,
    usedAi: !!input.ai_optimized,
    exhausted: candidates.length === 0,
  };
}

export type CustomerRecording = {
  id: string;
  customer_id: string;
  deal_id: string | null;
  title: string;
  transcript: string;
  summary: string;
  memo: string;
  duration_seconds: number;
  status: string;
  recorded_at: string;
  created_at: string;
};

export async function getCustomerRecordings(customerId: string) {
  const { supabase } = await getCompanyContext();
  const { data, error } = await supabase
    .from("customer_recordings")
    .select("*")
    .eq("customer_id", customerId)
    .order("recorded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CustomerRecording[];
}

export async function saveCustomerRecording(input: {
  customer_id: string;
  deal_id?: string;
  title?: string;
  transcript?: string;
  summary?: string;
  memo?: string;
  duration_seconds?: number;
  id?: string;
}) {
  const { supabase, company_id, user_id } = await getCompanyContext();
  const row = {
    company_id,
    customer_id: input.customer_id,
    deal_id: input.deal_id ?? null,
    title: input.title ?? "商談録音",
    transcript: input.transcript ?? "",
    summary: input.summary ?? "",
    memo: input.memo ?? "",
    duration_seconds: input.duration_seconds ?? 0,
    status: "completed" as const,
    recorded_at: new Date().toISOString(),
    created_by: user_id,
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const { data, error } = await supabase.from("customer_recordings").update(row).eq("id", input.id).select().single();
    if (error) throw error;
    return data as CustomerRecording;
  }
  const { data, error } = await supabase.from("customer_recordings").insert(row).select().single();
  if (error) throw error;
  return data as CustomerRecording;
}

export async function getCustomerTodos(customerId: string) {
  const { supabase } = await getCompanyContext();
  const { data, error } = await supabase
    .from("todos")
    .select("*")
    .eq("customer_id", customerId)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function createCustomerTodo(input: {
  customer_id: string;
  deal_id?: string;
  title: string;
  description?: string;
  due_date?: string;
  source?: string;
}) {
  const { supabase, company_id, user_id } = await getCompanyContext();
  const { data, error } = await supabase.from("todos").insert({
    company_id,
    customer_id: input.customer_id,
    deal_id: input.deal_id ?? null,
    assigned_to: user_id,
    title: input.title,
    description: input.description ?? null,
    due_date: input.due_date ?? null,
    source: input.source ?? "manual",
    status: "pending",
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateCustomerTodo(id: string, input: { title?: string; description?: string; status?: string; due_date?: string | null }) {
  const { supabase } = await getCompanyContext();
  const { data, error } = await supabase.from("todos").update({ ...input, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCustomerTodo(id: string) {
  const { supabase } = await getCompanyContext();
  const { error } = await supabase.from("todos").delete().eq("id", id);
  if (error) throw error;
}

export async function getCustomerDocuments(customerId: string) {
  const { supabase } = await getCompanyContext();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function saveSchedulingRequest(input: {
  customer_id: string;
  meeting_type: "in_person" | "online" | "phone";
  time_slot: "morning" | "afternoon" | "evening" | "anytime";
  duration_minutes: number;
  candidate_dates?: string[];
  ai_optimized?: boolean;
}) {
  const { supabase, company_id } = await getCompanyContext();
  const { data, error } = await supabase.from("customer_scheduling_requests").insert({
    company_id,
    customer_id: input.customer_id,
    meeting_type: input.meeting_type,
    time_slot: input.time_slot,
    duration_minutes: input.duration_minutes,
    candidate_dates: input.candidate_dates ?? [],
    ai_optimized: input.ai_optimized ?? false,
    status: "proposed",
  }).select().single();
  if (error) throw error;
  return data;
}

export async function confirmSchedulingCandidate(input: {
  customer_id: string;
  candidate: SchedulingCandidate;
  meeting_type: "in_person" | "online" | "phone";
  duration_minutes: number;
  title?: string;
}) {
  const { supabase, company_id, user_id } = await getCompanyContext();
  const [hourStr, minuteStr] = input.candidate.timeLabel.split(":");
  const hour = Number(hourStr) || 10;
  const minute = Number(minuteStr) || 0;
  const startAt = new Date(`${input.candidate.date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`);
  const endAt = new Date(startAt.getTime() + input.duration_minutes * 60_000);

  const { data: event, error: eventErr } = await supabase.from("calendar_events").insert({
    company_id,
    title: input.title ?? `面談: ${input.candidate.displayLabel}`,
    description: `面談区分: ${input.meeting_type}`,
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
    customer_id: input.customer_id,
    assigned_to: user_id,
    created_by: user_id,
    category: "meeting",
  }).select().single();
  if (eventErr) throw eventErr;

  await supabase.from("customer_scheduling_requests").insert({
    company_id,
    customer_id: input.customer_id,
    meeting_type: input.meeting_type,
    time_slot: "anytime",
    duration_minutes: input.duration_minutes,
    candidate_dates: [input.candidate.displayLabel],
    status: "confirmed",
  });

  return event;
}

export async function getCustomerDealsWithActivities(customerId: string) {
  const { supabase } = await getCompanyContext();
  const { data: deals, error } = await supabase
    .from("deals")
    .select("*, assignee:profiles!deals_assigned_to_fkey(id, display_name)")
    .eq("customer_id", customerId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const dealIds = (deals ?? []).map((d) => d.id);
  if (dealIds.length === 0) return [];
  const { data: activities } = await supabase
    .from("deal_activities")
    .select("*, performer:profiles!deal_activities_performed_by_fkey(id, display_name)")
    .in("deal_id", dealIds)
    .order("performed_at", { ascending: false });
  return (deals ?? []).map((d) => ({
    ...d,
    activities: (activities ?? []).filter((a) => a.deal_id === d.id),
  }));
}

export async function updateDealSummary(dealId: string, summary: string) {
  const { supabase } = await getCompanyContext();
  const { data, error } = await supabase.from("deals").update({ summary }).eq("id", dealId).select().single();
  if (error) throw error;
  return data;
}

export async function generateEightId(companyId: string): Promise<string> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .is("deleted_at", null);
  const seq = String((count ?? 0) + 1).padStart(6, "0");
  return `EIGHT-${seq}`;
}
