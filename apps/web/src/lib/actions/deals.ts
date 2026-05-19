"use server";

import { createClient } from "@/lib/supabase/server";
import type { Deal, DealActivity } from "@/lib/database.types";

export async function getDealStages() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) return [];
  const { data } = await supabase
    .from("deal_stages")
    .select("*")
    .eq("company_id", profile.company_id)
    .order("sort_order");
  return data ?? [];
}

export async function getLostReasons() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) return [];
  const { data } = await supabase
    .from("lost_reasons")
    .select("*")
    .eq("company_id", profile.company_id)
    .order("sort_order");
  return data ?? [];
}

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
      stage: input.stage || "lead",
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

export async function deleteDeal(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("deals").delete().eq("id", id);
  if (error) throw error;
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

// ── CRM マスタ CRUD ─────────────────────────

async function getCompanyId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");
  return { supabase, company_id: profile.company_id };
}

// 商談ステージ
export async function createDealStage(input: { key: string; label: string; color?: string; sort_order?: number }) {
  const { supabase, company_id } = await getCompanyId();
  const { data, error } = await supabase.from("deal_stages").insert({ company_id, ...input }).select().single();
  if (error) throw error;
  return data;
}

export async function updateDealStage(id: string, input: { label?: string; color?: string; sort_order?: number }) {
  const { supabase } = await getCompanyId();
  const { data, error } = await supabase.from("deal_stages").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteDealStage(id: string) {
  const { supabase } = await getCompanyId();
  const { error } = await supabase.from("deal_stages").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderDealStages(items: { id: string; sort_order: number }[]) {
  const { supabase } = await getCompanyId();
  await Promise.all(items.map(({ id, sort_order }) =>
    supabase.from("deal_stages").update({ sort_order }).eq("id", id)
  ));
}

// 失注理由
export async function createLostReason(label: string) {
  const { supabase, company_id } = await getCompanyId();
  const { data: existing } = await supabase.from("lost_reasons").select("sort_order").eq("company_id", company_id).order("sort_order", { ascending: false }).limit(1).single();
  const { data, error } = await supabase.from("lost_reasons").insert({ company_id, label, sort_order: (existing?.sort_order ?? -1) + 1 }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteLostReason(id: string) {
  const { supabase } = await getCompanyId();
  const { error } = await supabase.from("lost_reasons").delete().eq("id", id);
  if (error) throw error;
}

// 紹介元
export async function getLeadSources() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) return [];
  const { data } = await supabase.from("lead_sources").select("*").eq("company_id", profile.company_id).order("sort_order");
  return data ?? [];
}

export async function createLeadSource(label: string) {
  const { supabase, company_id } = await getCompanyId();
  const { data: existing } = await supabase.from("lead_sources").select("sort_order").eq("company_id", company_id).order("sort_order", { ascending: false }).limit(1).single();
  const { data, error } = await supabase.from("lead_sources").insert({ company_id, label, sort_order: (existing?.sort_order ?? -1) + 1 }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteLeadSource(id: string) {
  const { supabase } = await getCompanyId();
  const { error } = await supabase.from("lead_sources").delete().eq("id", id);
  if (error) throw error;
}

// 顧客タグ
export async function getCustomerTagMasters() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) return [];
  const { data } = await supabase.from("customer_tag_masters").select("*").eq("company_id", profile.company_id).order("sort_order");
  return data ?? [];
}

export async function createCustomerTagMaster(label: string) {
  const { supabase, company_id } = await getCompanyId();
  const { data: existing } = await supabase.from("customer_tag_masters").select("sort_order").eq("company_id", company_id).order("sort_order", { ascending: false }).limit(1).single();
  const { data, error } = await supabase.from("customer_tag_masters").insert({ company_id, label, sort_order: (existing?.sort_order ?? -1) + 1 }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCustomerTagMaster(id: string) {
  const { supabase } = await getCompanyId();
  const { error } = await supabase.from("customer_tag_masters").delete().eq("id", id);
  if (error) throw error;
}
