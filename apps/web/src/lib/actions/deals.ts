"use server";

import { createClient } from "@/lib/supabase/server";
import type { Deal, DealActivity } from "@/lib/database.types";

export async function getDeals() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals")
    .select("*, customer:customers(id, name, company_name), assignee:profiles!deals_assigned_to_fkey(id, display_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getDeal(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals")
    .select("*, customer:customers(id, name, company_name, phone, email), assignee:profiles!deals_assigned_to_fkey(id, display_name)")
    .eq("id", id)
    .single();
  if (error) throw error;

  const { data: activities } = await supabase
    .from("deal_activities")
    .select("*, performer:profiles!deal_activities_performed_by_fkey(id, display_name)")
    .eq("deal_id", id)
    .order("performed_at", { ascending: false });

  return { ...data, activities: activities || [] };
}

export async function createDeal(input: {
  customer_id: string;
  title: string;
  stage?: Deal["stage"];
  value?: number;
  priority?: string;
  assigned_to?: string;
  expected_close_date?: string;
  next_action?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { data, error } = await supabase
    .from("deals")
    .insert({
      company_id: profile.company_id,
      customer_id: input.customer_id,
      title: input.title,
      stage: input.stage || "inquiry",
      value: input.value || null,
      priority: input.priority || "medium",
      assigned_to: input.assigned_to || null,
      expected_close_date: input.expected_close_date || null,
      next_action: input.next_action || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Deal;
}

export async function updateDeal(id: string, input: Partial<Omit<Deal, "id" | "company_id" | "created_at" | "updated_at">>) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("deals").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as Deal;
}

export async function createDealActivity(dealId: string, input: { type: string; title: string; description?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { data, error } = await supabase
    .from("deal_activities")
    .insert({
      company_id: profile.company_id,
      deal_id: dealId,
      type: input.type,
      title: input.title,
      description: input.description || null,
      performed_by: user.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DealActivity;
}
