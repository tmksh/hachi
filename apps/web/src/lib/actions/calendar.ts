"use server";

import { createClient } from "@/lib/supabase/server";
import type { CalendarEvent } from "@/lib/database.types";

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
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
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
    })
    .select()
    .single();
  if (error) throw error;
  return data as CalendarEvent;
}

export async function updateCalendarEvent(id: string, input: Partial<Omit<CalendarEvent, "id" | "company_id" | "created_by" | "created_at" | "updated_at">>) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("calendar_events").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as CalendarEvent;
}

export async function deleteCalendarEvent(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  if (error) throw error;
}
