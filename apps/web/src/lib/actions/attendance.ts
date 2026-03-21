"use server";

import { createClient } from "@/lib/supabase/server";
import type { AttendanceEntry } from "@/lib/database.types";

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

  const today = new Date().toISOString().split("T")[0];

  const { data: existing } = await supabase
    .from("attendance_entries")
    .select("id")
    .eq("user_id", user.id)
    .eq("work_date", today)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("attendance_entries")
      .update({ clock_in_at: new Date().toISOString() })
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

  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("attendance_entries")
    .update({ clock_out_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("work_date", today)
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
