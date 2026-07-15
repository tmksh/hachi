"use server";

import { createClient } from "@/lib/supabase/server";
import type { CalendarEvent } from "@/lib/database.types";

export async function disconnectGoogleCalendar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("profiles")
    .update({
      google_access_token: null,
      google_refresh_token: null,
      google_token_expires_at: null,
    })
    .eq("id", user.id);

  if (error) throw error;
}

/** 同じ企業内でGoogle Calendarを連携しているメンバー一覧（自分以外） */
export async function getCompanyMembersWithCalendar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();
  if (!myProfile?.company_id) return [];

  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .eq("company_id", myProfile.company_id)
    .neq("id", user.id)
    .not("google_access_token", "is", null);

  return (data ?? []) as Array<{ id: string; display_name: string; email: string }>;
}

export async function getCalendarEvents(params?: { start?: string; end?: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("calendar_events")
    .select("*, customer:customers(id, name)")
    .order("start_at");

  if (params?.start) query = query.gte("start_at", params.start);
  if (params?.end) query = query.lte("end_at", params.end);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getCalendarEvent(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*, customer:customers(id, name)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

/** 同じ企業の全メンバー（自分以外）。予定の共有先選択用 */
export async function getCompanyMembers() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();
  if (!myProfile?.company_id) return [];

  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .eq("company_id", myProfile.company_id)
    .neq("id", user.id)
    .order("display_name");

  return (data ?? []) as Array<{ id: string; display_name: string; email: string }>;
}

/** 共有先メンバーへお知らせ通知（共有された予定はメンバーのカレンダーにも表示される） */
async function notifySharedMembers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  fromUserId: string,
  memberIds: string[],
  event: { id: string; title: string; start_at: string; location?: string | null },
) {
  if (memberIds.length === 0) return;
  try {
    const { notifySalesFlowUser } = await import("@/lib/actions/sales-flow");
    const when = new Date(event.start_at).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
    await Promise.all(memberIds.map((memberId) =>
      notifySalesFlowUser(supabase, companyId, memberId, {
        title: `予定が共有されました: ${event.title}`,
        description: [`日時: ${when}`, event.location ? `場所: ${event.location}` : null]
          .filter(Boolean).join("\n"),
        href: "/calendar",
        skipTodo: true,
      }, fromUserId),
    ));
  } catch (e) {
    console.error("[notifySharedMembers] failed", e);
  }
}

export async function createCalendarEvent(input: {
  title: string;
  description?: string;
  start_at: string;
  end_at: string;
  all_day?: boolean;
  category?: CalendarEvent["category"];
  color?: string;
  location?: string;
  customer_id?: string;
  assigned_to?: string;
  shared_with?: string[];
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const base = {
    company_id: profile.company_id,
    title: input.title,
    description: input.description || null,
    start_at: input.start_at,
    end_at: input.end_at,
    all_day: input.all_day || false,
    category: input.category || null,
    color: input.color || null,
    location: input.location || null,
    customer_id: input.customer_id || null,
    assigned_to: input.assigned_to || null,
    created_by: user.id,
  };
  const sharedWith = (input.shared_with ?? []).filter(Boolean);

  let { data, error } = await supabase
    .from("calendar_events")
    .insert(sharedWith.length > 0 ? { ...base, shared_with: sharedWith } : base)
    .select()
    .single();
  if (error && sharedWith.length > 0) {
    // shared_with カラム未追加（migration 00057 未適用）の環境向けフォールバック
    ({ data, error } = await supabase.from("calendar_events").insert(base).select().single());
  }
  if (error) throw error;

  if (data && sharedWith.length > 0) {
    await notifySharedMembers(supabase, profile.company_id, user.id, sharedWith, data);
  }
  return data as CalendarEvent;
}

export async function updateCalendarEvent(id: string, input: Partial<Omit<CalendarEvent, "id" | "company_id" | "created_by" | "created_at" | "updated_at">>) {
  const supabase = await createClient();

  // 共有先の追加分を検出して通知するため、更新前の状態を取得
  let previousShared: string[] = [];
  if (input.shared_with) {
    const { data: before } = await supabase
      .from("calendar_events")
      .select("shared_with")
      .eq("id", id)
      .single();
    previousShared = (before?.shared_with as string[] | null) ?? [];
  }

  let { data, error } = await supabase.from("calendar_events").update(input).eq("id", id).select().single();
  if (error && input.shared_with) {
    // shared_with カラム未追加の環境向けフォールバック
    const { shared_with: _omit, ...rest } = input;
    void _omit;
    ({ data, error } = await supabase.from("calendar_events").update(rest).eq("id", id).select().single());
  }
  if (error) throw error;

  if (data && input.shared_with) {
    const added = input.shared_with.filter((m) => !previousShared.includes(m));
    if (added.length > 0) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await notifySharedMembers(supabase, data.company_id, user.id, added, data);
      }
    }
  }
  return data as CalendarEvent;
}

export async function deleteCalendarEvent(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  if (error) throw error;
}
