"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";
import type { AttendanceEntry } from "@/lib/database.types";
import { CACHE_TTL, cachedByCompany, invalidateMyCompanyCache } from "@/lib/supabase/auth-context";

/** JST の YYYY-MM-DD を返す */
function getTodayJST(): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()).replace(/\//g, "-");
}

export async function getAttendanceEntries(params?: { userId?: string; month?: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("attendance_entries")
    .select("*, user:profiles!attendance_entries_user_id_fkey(id, display_name, department)")
    .order("work_date", { ascending: false });

  if (params?.userId) {
    query = query.eq("user_id", params.userId);
  }
  if (params?.month) {
    const start = `${params.month}-01`;
    const endDate = new Date(parseInt(params.month.split("-")[0]), parseInt(params.month.split("-")[1]), 0);
    const end = `${params.month}-${String(endDate.getDate()).padStart(2, "0")}`;
    query = query.gte("work_date", start).lte("work_date", end);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function clockIn() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const today = getTodayJST();

  const { data: existing } = await supabase
    .from("attendance_entries")
    .select("id, leave_type, clock_in_at")
    .eq("user_id", user.id)
    .eq("work_date", today)
    .maybeSingle();

  // 終日休暇として登録されている日は出勤打刻不可
  if (existing?.leave_type && !["none", "morning_leave", "afternoon_leave", "半日休暇（午前）", "半日休暇（午後）"].includes(existing.leave_type)) {
    throw new Error("本日は休暇として登録されています。出勤打刻するには休暇区分を解除してください。");
  }

  if (existing?.clock_in_at) {
    const { data } = await supabase
      .from("attendance_entries")
      .select("*")
      .eq("id", existing.id)
      .single();
    return (data ?? existing) as AttendanceEntry;
  }

  if (existing) {
    const { data, error } = await supabase
      .from("attendance_entries")
      .update({ clock_in_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as AttendanceEntry;
  }

  const { data, error } = await supabase
    .from("attendance_entries")
    .insert({
      company_id: profile.company_id,
      user_id: user.id,
      work_date: today,
      clock_in_at: new Date().toISOString(),
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  await invalidateMyCompanyCache();
  return data as AttendanceEntry;
}

export async function clockOut() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const today = getTodayJST();

  const { data: existing } = await supabase
    .from("attendance_entries")
    .select("id")
    .eq("user_id", user.id)
    .eq("work_date", today)
    .maybeSingle();

  if (!existing) throw new Error("本日の出勤記録が見つかりません");

  const { data, error } = await supabase
    .from("attendance_entries")
    .update({ clock_out_at: new Date().toISOString() })
    .eq("id", existing.id)
    .select()
    .single();
  if (error) throw error;
  await invalidateMyCompanyCache();
  return data as AttendanceEntry;
}

/**
 * 終日休暇として記録（打刻なし）
 * 既に出勤打刻がある場合はエラー。同じ日に再度呼ばれた場合は leave_type のみ上書き。
 */
export async function recordLeaveDay(leaveType: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const today = getTodayJST();

  const { data: existing } = await supabase
    .from("attendance_entries")
    .select("id, clock_in_at")
    .eq("user_id", user.id)
    .eq("work_date", today)
    .maybeSingle();

  if (existing?.clock_in_at) {
    throw new Error("本日は既に出勤打刻があります。休暇に切り替えるには管理者にご相談ください。");
  }

  if (existing) {
    const { data, error } = await supabase
      .from("attendance_entries")
      .update({ leave_type: leaveType, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as AttendanceEntry;
  }

  const { data, error } = await supabase
    .from("attendance_entries")
    .insert({
      company_id: profile.company_id,
      user_id: user.id,
      work_date: today,
      leave_type: leaveType,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data as AttendanceEntry;
}

export async function approveAttendance(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_entries")
    .update({ status: "approved" })
    .eq("id", id);
  if (error) throw error;
}

export async function rejectAttendance(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_entries")
    .update({ status: "rejected" })
    .eq("id", id);
  if (error) throw error;
}

export async function updateLeaveType(id: string, leaveType: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_entries")
    .update({ leave_type: leaveType, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/**
 * 押し忘れ・修正用: 日付を指定して出勤/退勤/区分を上書き（無ければ作成）。
 * 本人は自分の記録のみ、管理者（owner/hq_admin/admin/executive）は他メンバーの記録も編集可。
 * 編集した記録は再承認が必要になるため status は pending に戻す。
 */
export async function upsertAttendanceEntry(input: {
  work_date: string;
  user_id?: string;
  clock_in?: string | null;   // "HH:mm" / null=クリア / undefined=変更なし
  clock_out?: string | null;
  leave_type?: string;
  reason?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id, role").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const targetUserId = input.user_id ?? user.id;
  const isAdminRole = ["owner", "hq_admin", "admin", "executive"].includes(String(profile.role));
  if (targetUserId !== user.id && !isAdminRole) {
    throw new Error("他のメンバーの勤怠を編集する権限がありません");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.work_date)) throw new Error("日付の形式が不正です");
  if (input.work_date > getTodayJST()) throw new Error("未来の日付は編集できません");

  const toIso = (hm: string | null | undefined): string | null | undefined => {
    if (hm === undefined) return undefined;
    if (hm === null || hm === "") return null;
    if (!/^\d{2}:\d{2}$/.test(hm)) throw new Error("時刻は HH:mm 形式で入力してください");
    // JST の日付＋時刻を UTC ISO へ
    return new Date(`${input.work_date}T${hm}:00+09:00`).toISOString();
  };
  const clockInIso = toIso(input.clock_in);
  const clockOutIso = toIso(input.clock_out);
  if (clockInIso && clockOutIso && clockOutIso < clockInIso) {
    throw new Error("退勤時刻は出勤時刻より後にしてください");
  }

  const { data: existing } = await supabase
    .from("attendance_entries")
    .select("id")
    .eq("user_id", targetUserId)
    .eq("work_date", input.work_date)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    status: "pending",
    modified_by: user.id,
    modified_reason: input.reason?.trim() || (targetUserId === user.id ? "本人による修正入力" : "管理者による修正入力"),
    updated_at: new Date().toISOString(),
  };
  if (clockInIso !== undefined) patch.clock_in_at = clockInIso;
  if (clockOutIso !== undefined) patch.clock_out_at = clockOutIso;
  if (input.leave_type !== undefined) patch.leave_type = input.leave_type || "none";

  if (existing) {
    const { data, error } = await supabase
      .from("attendance_entries")
      .update(patch)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    await invalidateMyCompanyCache();
    return data as AttendanceEntry;
  }

  const { data, error } = await supabase
    .from("attendance_entries")
    .insert({
      company_id: profile.company_id,
      user_id: targetUserId,
      work_date: input.work_date,
      clock_in_at: clockInIso ?? null,
      clock_out_at: clockOutIso ?? null,
      leave_type: input.leave_type || "none",
      status: "pending",
      modified_by: user.id,
      modified_reason: patch.modified_reason,
    })
    .select()
    .single();
  if (error) throw error;
  await invalidateMyCompanyCache();
  return data as AttendanceEntry;
}

export async function getTodayAttendance() {
  return cachedByCompany("today-attendance", CACHE_TTL.dashboard, loadTodayAttendance, true);
}

async function loadTodayAttendance() {
  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return null;
  const today = getTodayJST();
  const { data } = await supabase
    .from("attendance_entries")
    .select("*")
    .eq("user_id", user.id)
    .eq("work_date", today)
    .maybeSingle();
  return data as AttendanceEntry | null;
}
