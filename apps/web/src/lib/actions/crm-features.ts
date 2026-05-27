"use server";

import { createClient } from "@/lib/supabase/server";

async function getCompanyContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");
  return { supabase, company_id: profile.company_id, user_id: user.id };
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
  title: string;
  description?: string;
  due_date?: string;
  source?: string;
}) {
  const { supabase, company_id, user_id } = await getCompanyContext();
  const { data, error } = await supabase.from("todos").insert({
    company_id,
    customer_id: input.customer_id,
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

export async function getCustomerDocuments(customerId: string) {
  const { supabase } = await getCompanyContext();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("customer_id", customerId)
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
