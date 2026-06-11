"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";
import type { AttendanceEntry } from "@/lib/database.types";

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

export async function getTodayAttendance() {
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
