"use server";

import { addDays, format, isSunday, setHours, setMinutes, startOfDay } from "date-fns";
import { ja } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { callLlm, resolveLinqAiConfig } from "@/lib/integrations/linq-ai";

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

const MEETING_TYPE_LABEL: Record<"in_person" | "online" | "phone", string> = {
  in_person: "対面",
  online: "オンライン",
  phone: "電話",
};

/** その日の既存予定の状況（AIプロンプト用のコンテキスト） */
function dayStats(dateKey: string, blocks: BusyBlock[]) {
  const target = startOfDay(new Date(dateKey)).getTime();
  const dayBlocks = blocks.filter((b) => startOfDay(b.start).getTime() === target);
  return { events: dayBlocks.length, offsite: dayBlocks.some((b) => !!b.location?.trim()) };
}

/**
 * 空き候補（重複なしが保証済み）をLLMで営業効率順にランク付け・理由付けする。
 * AI未設定・失敗時は null を返し、呼び出し側でルールベースにフォールバックする。
 */
async function rankCandidatesWithAi(
  options: SchedulingCandidate[],
  blocks: BusyBlock[],
  meetingType: "in_person" | "online" | "phone",
  durationMinutes: number,
): Promise<SchedulingCandidate[] | null> {
  if (options.length === 0) return null;

  const config = await resolveLinqAiConfig();
  if (!config.enabled || !config.apiKey) return null;

  // トークン・コスト抑制のため直近20件までをAIに渡す
  const subset = options.slice(0, 20);
  const lines = subset.map((o, i) => {
    const { events, offsite } = dayStats(o.date, blocks);
    return `${i}: ${o.displayLabel} / その日の既存予定 ${events}件${offsite ? "（外出あり）" : ""}`;
  });

  const prompt = `あなたは工務店・リフォーム会社の営業スケジュール最適化アシスタントです。
以下は既存予定と重複しない「空いている」商談候補日時のリストです。
面談区分: ${MEETING_TYPE_LABEL[meetingType]}
所要時間: ${durationMinutes}分

候補一覧（index: 日時 / その日の状況）:
${lines.join("\n")}

営業効率の観点で最適な候補を最大5件、良い順に選び、JSONのみ返してください（説明文不要）:
{"ranking":[{"index":0,"score":95,"reason":"20文字以内の理由"}]}

評価基準:
- 対面はその日に外出予定がある日にまとめると移動効率が良い
- 予定が少ない日は準備・対応に余裕がある
- 電話・オンラインは予定の隙間でも設定しやすい
- 直近すぎず、かつ早めに実施できる日程を優先
- scoreは0〜100の整数`;

  const raw = await callLlm(prompt, config, "あなたは営業効率を最大化するスケジュール調整のプロです。");
  if (!raw) return null;

  try {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
    const parsed = JSON.parse((match?.[1] ?? raw).trim()) as {
      ranking?: Array<{ index?: number; score?: number; reason?: string }>;
    };
    const ranking = parsed.ranking;
    if (!Array.isArray(ranking) || ranking.length === 0) return null;

    const seen = new Set<number>();
    const ranked: SchedulingCandidate[] = [];
    for (const r of ranking) {
      const idx = typeof r.index === "number" ? r.index : Number(r.index);
      if (!Number.isInteger(idx) || idx < 0 || idx >= subset.length || seen.has(idx)) continue;
      seen.add(idx);
      const base = subset[idx];
      const score = Math.min(100, Math.max(0, Math.round(Number(r.score ?? 0))));
      ranked.push({
        ...base,
        aiScore: Number.isFinite(score) && score > 0 ? score : 60,
        note: r.reason?.trim() ? r.reason.trim().slice(0, 40) : "AIが営業効率を考慮して選定",
      });
      if (ranked.length >= 5) break;
    }
    return ranked.length > 0 ? ranked : null;
  } catch {
    return null;
  }
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

  let aiPowered = false;
  let candidates: SchedulingCandidate[];

  if (input.ai_optimized) {
    // まずLLMで営業効率順にランク付け。失敗時はルールベーススコアにフォールバック
    const aiRanked = await rankCandidatesWithAi(options, blocks, input.meeting_type, input.duration_minutes);
    if (aiRanked && aiRanked.length > 0) {
      candidates = aiRanked;
      aiPowered = true;
    } else {
      candidates = [...options].sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0)).slice(0, 5);
    }
  } else {
    candidates = options.slice(0, 5);
  }

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
    aiPowered,
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

  // 手動保存時も商談自動登録・要約後処理を実行（No.15）
  if (data.summary || data.transcript) {
    try {
      const { processRecordingComplete } = await import("@/lib/actions/sales-flow");
      await processRecordingComplete({
        customerId: input.customer_id,
        recordingId: data.id,
        dealId: input.deal_id,
        transcript: data.transcript || data.summary || "",
        memo: data.memo || undefined,
      });
    } catch {
      // 後処理失敗でも録音保存自体は成功扱い
    }
  }

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
  const { tokyoDateString } = await import("@/lib/tokyo-date");
  const today = tokyoDateString();
  const isDueToday = Boolean(input.due_date && input.due_date.slice(0, 10) === today);
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
    priority: isDueToday ? "high" : "medium",
    tags: isDueToday ? ["urgent", "sales_flow", "due_today", "notify_flag"] : ["sales_flow"],
  }).select().single();
  if (error) throw error;

  // 期限が今日のToDoは3経路通知（No.27）: バナー / ToDoフラグ / お知らせ
  if (isDueToday) {
    const { notifySalesFlowUser } = await import("@/lib/actions/sales-flow");
    await notifySalesFlowUser(supabase, company_id, user_id, {
      title: `今日のToDo: ${input.title}`,
      description: input.description ?? "期限が今日のToDoが登録されました",
      href: `/crm/${input.customer_id}?tab=todos`,
      customerId: input.customer_id,
      dealId: input.deal_id,
      urgent: true,
      skipTodo: true,
    }, user_id);
  }

  return data;
}

export async function updateCustomerTodo(id: string, input: { title?: string; description?: string; status?: string; due_date?: string | null }) {
  const { supabase, company_id, user_id } = await getCompanyContext();
  const { tokyoDateString } = await import("@/lib/tokyo-date");
  const today = tokyoDateString();
  const dueToday = input.due_date != null && input.due_date.slice(0, 10) === today;

  const patch: Record<string, unknown> = { ...input, updated_at: new Date().toISOString() };
  if (dueToday) {
    patch.priority = "high";
    patch.tags = ["urgent", "sales_flow", "due_today", "notify_flag"];
  }

  const { data, error } = await supabase.from("todos").update(patch).eq("id", id).select().single();
  if (error) throw error;

  if (dueToday && data) {
    const { notifySalesFlowUser } = await import("@/lib/actions/sales-flow");
    await notifySalesFlowUser(supabase, company_id, user_id, {
      title: `今日のToDo: ${data.title}`,
      description: data.description ?? "期限が今日のToDoに更新されました",
      href: data.customer_id ? `/crm/${data.customer_id}?tab=todos` : "/dashboard",
      customerId: data.customer_id ?? undefined,
      dealId: data.deal_id ?? undefined,
      urgent: true,
      skipTodo: true,
    }, user_id);
  }

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

  const title = input.title ?? `面談: ${input.candidate.displayLabel}`;
  const description = `面談区分: ${input.meeting_type}`;

  const { data: event, error: eventErr } = await supabase.from("calendar_events").insert({
    company_id,
    title,
    description,
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
    customer_id: input.customer_id,
    assigned_to: user_id,
    created_by: user_id,
    category: "meeting",
  }).select().single();
  if (eventErr) throw eventErr;

  // Google Calendar 連携（トークンがあれば同期。失敗してもローカル登録は維持）
  const { data: profile } = await supabase
    .from("profiles")
    .select("google_access_token, google_refresh_token, google_token_expires_at")
    .eq("id", user_id)
    .single();

  let googleEventId: string | null = null;
  if (profile?.google_access_token) {
    try {
      let accessToken = profile.google_access_token as string;
      const expiresAt = profile.google_token_expires_at
        ? new Date(profile.google_token_expires_at).getTime()
        : 0;
      if (expiresAt && expiresAt < Date.now() + 60_000 && profile.google_refresh_token) {
        const clientId = process.env.GOOGLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        if (clientId && clientSecret) {
          const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: profile.google_refresh_token,
              grant_type: "refresh_token",
            }),
          });
          if (refreshRes.ok) {
            const tokenJson = await refreshRes.json() as { access_token?: string; expires_in?: number };
            if (tokenJson.access_token) {
              accessToken = tokenJson.access_token;
              await supabase.from("profiles").update({
                google_access_token: accessToken,
                google_token_expires_at: tokenJson.expires_in
                  ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
                  : null,
              }).eq("id", user_id);
            }
          }
        }
      }

      const timeZone = "Asia/Tokyo";
      const gRes = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: title,
            description,
            start: { dateTime: startAt.toISOString(), timeZone },
            end: { dateTime: endAt.toISOString(), timeZone },
          }),
        },
      );
      if (gRes.ok) {
        const gData = await gRes.json() as { id?: string };
        googleEventId = gData.id ?? null;
        if (googleEventId) {
          await supabase.from("calendar_events").update({
            google_event_id: googleEventId,
          }).eq("id", event.id);
        }
      }
    } catch {
      // Google同期失敗時はローカルイベントのみで成功扱い
    }
  }

  await supabase.from("customer_scheduling_requests").insert({
    company_id,
    customer_id: input.customer_id,
    meeting_type: input.meeting_type,
    time_slot: "anytime",
    duration_minutes: input.duration_minutes,
    candidate_dates: [input.candidate.displayLabel],
    status: "confirmed",
  }).then(({ error }) => {
    if (error) console.warn("[confirmScheduling] scheduling_requests:", error.message);
  });

  return { ...event, googleEventId };
}

/**
 * 候補日を顧客へ案内するメール文面を生成する（No.24 メール文面自動生成）。
 * AI設定があればLLMで生成、未設定・失敗時はテンプレートで必ず文面を返す。
 */
export async function generateSchedulingEmail(input: {
  customer_id: string;
  meeting_type: "in_person" | "online" | "phone";
  duration_minutes: number;
  candidate_labels: string[];
}): Promise<{ text: string; aiGenerated: boolean }> {
  const { supabase } = await getCompanyContext();
  const { data: customer } = await supabase
    .from("customers")
    .select("name, company_name")
    .eq("id", input.customer_id)
    .single();

  const customerName = customer?.company_name || customer?.name || "お客様";
  const meetingLabel = MEETING_TYPE_LABEL[input.meeting_type];
  const candidateLines = input.candidate_labels.map((label, i) => `（${i + 1}）${label}`).join("\n");

  const fallback = `${customerName}様

いつもお世話になっております。

${meetingLabel}でのお打ち合わせ（約${input.duration_minutes}分）の候補日時をご案内いたします。
下記の中からご都合のよろしい日時をお知らせいただけますでしょうか。

${candidateLines}

上記でご都合が合わない場合は、ご希望の日時をお知らせください。
お忙しいところ恐れ入りますが、よろしくお願いいたします。`;

  const config = await resolveLinqAiConfig();
  if (!config.enabled || !config.apiKey) {
    return { text: fallback, aiGenerated: false };
  }

  const prompt = `工務店・リフォーム会社の営業担当として、顧客に商談の候補日時を案内するメール本文を作成してください。

【条件】
- 宛名: ${customerName}様
- 面談区分: ${meetingLabel}
- 所要時間: 約${input.duration_minutes}分
- 候補日時:
${candidateLines}

【ルール】
- 丁寧なビジネスメール（日本語）
- 候補日時は番号付きでそのまま列挙する
- 都合が合わない場合の代替案の依頼も入れる
- 件名や署名は不要、本文のみ
- 300文字程度`;

  const raw = await callLlm(prompt, config, "あなたは工務店・リフォーム会社の営業アシスタントです。");
  if (!raw?.trim()) return { text: fallback, aiGenerated: false };
  return { text: raw.trim(), aiGenerated: true };
}

/** 候補日案内メールを顧客へ送信（No.24） */
export async function sendSchedulingEmail(input: {
  customer_id: string;
  subject?: string;
  body: string;
  deal_id?: string;
}) {
  const { supabase, company_id, user_id } = await getCompanyContext();
  const body = input.body.trim();
  if (!body) throw new Error("メール本文が空です");

  const { data: customer } = await supabase
    .from("customers")
    .select("name, email, company_name")
    .eq("id", input.customer_id)
    .single();
  if (!customer?.email?.trim()) {
    throw new Error("顧客のメールアドレスが登録されていません");
  }

  const [{ data: company }, { data: sender }] = await Promise.all([
    supabase.from("companies").select("name").eq("id", company_id).single(),
    supabase.from("profiles").select("display_name").eq("id", user_id).single(),
  ]);
  const companyName = company?.name ?? "BRIDGE";
  const subject = input.subject?.trim() || `【${companyName}】お打ち合わせ候補日時のご案内`;

  const { getResend, CUSTOMER_FROM_EMAIL } = await import("@/lib/resend");
  const html = body
    .split("\n")
    .map((line) => `<p style="margin:0 0 8px;white-space:pre-wrap;">${line.replace(/</g, "&lt;").replace(/>/g, "&gt;") || "&nbsp;"}</p>`)
    .join("");

  const { error: mailError } = await getResend().emails.send({
    from: CUSTOMER_FROM_EMAIL,
    to: customer.email.trim(),
    subject,
    html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;">${html}</div>`,
    text: body,
  });
  if (mailError) {
    throw new Error(`メール送信に失敗しました: ${mailError.message}`);
  }

  // 活動履歴・ToDo通知用に記録
  let dealId = input.deal_id ?? null;
  if (!dealId) {
    const { data: deal } = await supabase
      .from("deals")
      .select("id")
      .eq("customer_id", input.customer_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    dealId = deal?.id ?? null;
  }
  if (dealId) {
    await supabase.from("deal_activities").insert({
      company_id,
      deal_id: dealId,
      type: "email",
      title: subject,
      description: body.slice(0, 2000),
      performed_by: user_id,
      performed_at: new Date().toISOString(),
    });
  }

  return {
    sentTo: customer.email.trim(),
    subject,
    senderName: sender?.display_name ?? companyName,
  };
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
  const { supabase, company_id, user_id } = await getCompanyContext();
  const { data, error } = await supabase.from("deals").update({
    summary,
    updated_at: new Date().toISOString(),
  }).eq("id", dealId).select().single();
  if (error) throw error;

  // メモ保存を活動履歴にも残す（No.19）
  if (summary.trim()) {
    await supabase.from("deal_activities").insert({
      company_id,
      deal_id: dealId,
      type: "note",
      title: "商談メモを更新",
      description: summary.slice(0, 2000),
      performed_by: user_id,
      performed_at: new Date().toISOString(),
    });
  }

  return data;
}

// ── AI見込度判定（顧客の prospect_grade: A/B/C）────────────────

export type ProspectGrade = "A" | "B" | "C";
export type DealConfidenceVerdict = "appropriate" | "too_optimistic" | "too_pessimistic";

export type DealConfidenceAssessment = {
  verdict: DealConfidenceVerdict;
  suggestedGrade: ProspectGrade;
  currentGrade: ProspectGrade | null;
  customerId: string;
  confidence: number;
  reasons: string[];
  advice: string;
};

const DEAL_STAGE_LABELS: Record<string, string> = {
  inquiry: "問い合わせ", first_meeting: "初回面談", materials_sent: "資料送付",
  quote_submitted: "見積提出", negotiation: "商談中", closing: "クロージング",
  won: "受注", lost: "失注", lead: "リード", proposal: "提案中",
};

const GRADE_JA: Record<ProspectGrade, string> = {
  A: "A（見込度：高）",
  B: "B（見込度：中）",
  C: "C（見込度：低）",
};

function parseProspectGrade(value: unknown): ProspectGrade | null {
  return value === "A" || value === "B" || value === "C" ? value : null;
}

function daysBetween(from: string | Date, to: Date = new Date()): number {
  return Math.floor((to.getTime() - new Date(from).getTime()) / 86_400_000);
}

/**
 * 営業が入力した見込度（A/B/C）の妥当性を、
 * 商談データ（ステージ・経過日数・活動履歴・録音要約・ToDo）からAIが判定する。
 */
export async function assessDealConfidence(dealId: string): Promise<
  | { ok: true; assessment: DealConfidenceAssessment }
  | { ok: false; message: string }
> {
  const { supabase } = await getCompanyContext();

  const config = await resolveLinqAiConfig();
  if (!config.enabled || !config.apiKey) {
    return { ok: false, message: "AI機能が設定されていません。管理者にお問い合わせください。" };
  }

  const { data: deal, error } = await supabase.from("deals").select("*").eq("id", dealId).single();
  if (error || !deal) return { ok: false, message: "商談が見つかりませんでした。" };
  if (!deal.customer_id) return { ok: false, message: "この商談に顧客が紐づいていません。" };

  const [{ data: customer }, { data: activities }, { data: recordings }, { data: todos }] = await Promise.all([
    supabase.from("customers").select("id, prospect_grade, name").eq("id", deal.customer_id).single(),
    supabase.from("deal_activities").select("type, title, description, performed_at")
      .eq("deal_id", dealId).order("performed_at", { ascending: false }).limit(15),
    supabase.from("customer_recordings").select("summary, recorded_at")
      .eq("deal_id", dealId).order("recorded_at", { ascending: false }).limit(3),
    supabase.from("todos").select("title, status, due_date")
      .eq("deal_id", dealId).limit(10),
  ]);

  if (!customer) return { ok: false, message: "顧客が見つかりませんでした。" };

  const currentGrade = parseProspectGrade(customer.prospect_grade);
  const currentGradeLabel = currentGrade ? GRADE_JA[currentGrade] : "未設定";

  const now = new Date();
  const daysSinceCreated = daysBetween(deal.created_at, now);
  const lastActivityAt = activities?.[0]?.performed_at ?? deal.updated_at;
  const daysSinceLastActivity = daysBetween(lastActivityAt, now);
  const daysToClose = deal.expected_close_date ? -daysBetween(now, new Date(deal.expected_close_date)) : null;

  const activityLines = (activities ?? []).map((a) =>
    `- ${format(new Date(a.performed_at), "MM/dd", { locale: ja })} [${a.type}] ${a.title}${a.description ? `: ${String(a.description).slice(0, 80)}` : ""}`
  );
  const recordingLines = (recordings ?? [])
    .filter((r) => r.summary?.trim())
    .map((r) => `- ${format(new Date(r.recorded_at), "MM/dd", { locale: ja })} ${String(r.summary).slice(0, 200)}`);
  const openTodos = (todos ?? []).filter((t) => t.status !== "completed");

  const prompt = `以下の顧客・商談について、営業担当が入力した見込度「${currentGradeLabel}」が妥当かを判定してください。
見込度は A（高）/ B（中）/ C（低）の3段階です。BIダッシュボードの見込み売上にも反映されます。

【顧客】
- 顧客名: ${customer.name ?? "未設定"}
- 入力された見込度: ${currentGradeLabel}

【商談情報】
- 商談名: ${deal.title}
- ステージ: ${DEAL_STAGE_LABELS[deal.stage] ?? deal.stage}
- 金額: ${deal.value != null ? `¥${Number(deal.value).toLocaleString()}` : "未設定"}
- 商談開始からの経過日数: ${daysSinceCreated}日
- 最終活動からの経過日数: ${daysSinceLastActivity}日
- クロージング予定: ${deal.expected_close_date ?? "未設定"}${daysToClose != null ? `（${daysToClose >= 0 ? `あと${daysToClose}日` : `${-daysToClose}日超過`}）` : ""}
- 次アクション: ${deal.next_action ?? "未設定"}
- 商談要約: ${deal.summary?.trim() ? String(deal.summary).slice(0, 300) : "なし"}

【活動履歴（新しい順）】
${activityLines.length > 0 ? activityLines.join("\n") : "活動記録なし"}

【商談録音の要約】
${recordingLines.length > 0 ? recordingLines.join("\n") : "録音なし"}

【未完了ToDo】
${openTodos.length > 0 ? openTodos.map((t) => `- ${t.title}${t.due_date ? `（期限 ${t.due_date}）` : ""}`).join("\n") : "なし"}

【判定基準】
- 活動が長期間止まっている・クロージング予定超過・次アクション未設定なのに見込度A → 甘い見込みの可能性
- ステージが浅い（問い合わせ・初回面談）のに見込度A → 根拠を確認
- ステージが深く（クロージング等）活動も活発なのに見込度C → 慎重すぎる可能性
- 見込度が未設定の場合は、データから妥当な A/B/C を提案する
- 録音要約・活動内容にある顧客の温度感（前向き発言・懸念・競合など）を重視

JSONのみ返してください（説明文不要）:
{"verdict":"appropriate|too_optimistic|too_pessimistic","suggestedGrade":"A|B|C","confidence":85,"reasons":["40文字以内の根拠を最大3つ"],"advice":"営業担当への次アクション提案を60文字以内で"}`;

  const raw = await callLlm(
    prompt,
    config,
    "あなたは工務店・リフォーム会社の営業マネージャーです。顧客の見込度（A/B/C）を客観的な商談データに基づいて厳しくレビューします。",
  );
  if (!raw) return { ok: false, message: "AIからの応答を取得できませんでした。" };

  try {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
    const parsed = JSON.parse((match?.[1] ?? raw).trim()) as {
      verdict?: string;
      suggestedGrade?: string;
      confidence?: number;
      reasons?: string[];
      advice?: string;
    };
    const verdict = (["appropriate", "too_optimistic", "too_pessimistic"] as const)
      .find((v) => v === parsed.verdict) ?? "appropriate";
    const suggestedGrade = parseProspectGrade(parsed.suggestedGrade) ?? currentGrade ?? "B";
    return {
      ok: true,
      assessment: {
        verdict,
        suggestedGrade,
        currentGrade,
        customerId: customer.id,
        confidence: Math.min(100, Math.max(0, Math.round(parsed.confidence ?? 50))),
        reasons: (parsed.reasons ?? []).slice(0, 3).map((r) => String(r)),
        advice: String(parsed.advice ?? ""),
      },
    };
  } catch {
    return { ok: false, message: "AIの判定結果を解析できませんでした。もう一度お試しください。" };
  }
}

/**
 * 問い合わせ内容・備考から「その他項目」の候補をAIが抽出・提案する（記入画面のAI入力）。
 */
export async function suggestCustomFieldsFromInquiry(input: {
  inquiry_content?: string;
  notes?: string;
  existing_keys?: string[];
}): Promise<{ ok: true; fields: { key: string; value: string }[] } | { ok: false; message: string }> {
  const source = [input.inquiry_content, input.notes].filter((t) => t?.trim()).join("\n");
  if (!source.trim()) {
    return { ok: false, message: "問い合わせ内容または備考を入力してからお試しください。" };
  }

  const config = await resolveLinqAiConfig();
  if (!config.enabled || !config.apiKey) {
    return { ok: false, message: "AI機能が設定されていません。管理者にお問い合わせください。" };
  }

  const prompt = `以下は工務店・リフォーム会社の顧客の問い合わせ内容・備考です。
顧客管理に役立つ補足項目（key-value）を抽出・提案してください。

【テキスト】
${source.slice(0, 2000)}

【ルール】
- テキストに含まれる情報のみ抽出する（推測で作らない）
- 例: 希望工事内容 / 築年数 / 家族構成 / 希望時期 / 現在の悩み / 競合検討状況 など
- 既にある項目キーは除外: ${(input.existing_keys ?? []).join("、") || "なし"}
- 最大5件
- JSONのみ返す: {"fields":[{"key":"項目名（10文字以内）","value":"値（40文字以内）"}]}`;

  const raw = await callLlm(prompt, config, "あなたは工務店・リフォーム会社のCRM入力アシスタントです。");
  if (!raw) return { ok: false, message: "AIからの応答を取得できませんでした。" };

  try {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
    const parsed = JSON.parse((match?.[1] ?? raw).trim()) as { fields?: { key?: string; value?: string }[] };
    const fields = (parsed.fields ?? [])
      .filter((f) => f.key?.trim() && f.value?.trim())
      .slice(0, 5)
      .map((f) => ({ key: String(f.key).trim(), value: String(f.value).trim() }));
    if (fields.length === 0) return { ok: false, message: "抽出できる項目が見つかりませんでした。" };
    return { ok: true, fields };
  } catch {
    return { ok: false, message: "AIの応答を解析できませんでした。もう一度お試しください。" };
  }
}

/** AI判定の修正提案を顧客の見込度（A/B/C）に反映し、商談タイムラインに記録を残す */
export async function applyAssessedProspectGrade(
  customerId: string,
  dealId: string,
  grade: ProspectGrade,
  reason: string,
) {
  const { supabase, company_id, user_id } = await getCompanyContext();
  const { data: before } = await supabase
    .from("customers")
    .select("prospect_grade")
    .eq("id", customerId)
    .single();
  const beforeGrade = parseProspectGrade(before?.prospect_grade);
  const { data, error } = await supabase
    .from("customers")
    .update({ prospect_grade: grade, updated_at: new Date().toISOString() })
    .eq("id", customerId)
    .select("id, prospect_grade")
    .single();
  if (error) throw error;

  const beforeLabel = beforeGrade ? GRADE_JA[beforeGrade] : "未設定";
  await supabase.from("deal_activities").insert({
    company_id,
    deal_id: dealId,
    type: "note",
    title: `AI見込度判定により見込度を「${beforeLabel}」→「${GRADE_JA[grade]}」に修正`,
    description: reason || null,
    performed_by: user_id,
  });

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
