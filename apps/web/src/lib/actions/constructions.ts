"use server";

import { createClient } from "@/lib/supabase/server";
import type { Construction, ConstructionTask, ContractorOrder } from "@/lib/database.types";

export async function getConstructions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("constructions")
    .select("*, customer:customers(id, name, company_name), assignee:profiles!constructions_assigned_to_fkey(id, display_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getConstruction(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("constructions")
    .select("*, customer:customers(id, name, company_name), contract:contracts(id, contract_no, title), assignee:profiles!constructions_assigned_to_fkey(id, display_name)")
    .eq("id", id)
    .single();
  if (error) throw error;

  const { data: tasks } = await supabase
    .from("construction_tasks")
    .select("*")
    .eq("construction_id", id)
    .order("sort_order");

  const { data: orders } = await supabase
    .from("contractor_orders")
    .select("*, craftsman:craftsmen(id, name)")
    .eq("construction_id", id)
    .order("created_at", { ascending: false });

  return { ...data, tasks: tasks || [], orders: orders || [] };
}

export async function createConstruction(input: {
  title: string;
  contract_id?: string;
  customer_id?: string;
  start_date?: string;
  end_date?: string;
  order_amount?: number;
  budget_cost?: number;
  assigned_to?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { count } = await supabase.from("constructions").select("*", { count: "exact", head: true });
  const constructionNo = `CST-${String((count || 0) + 1).padStart(4, "0")}`;

  const { data, error } = await supabase
    .from("constructions")
    .insert({
      company_id: profile.company_id,
      construction_no: constructionNo,
      title: input.title,
      contract_id: input.contract_id || null,
      customer_id: input.customer_id || null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      order_amount: input.order_amount || 0,
      budget_cost: input.budget_cost || 0,
      assigned_to: input.assigned_to || null,
      status: "preparing",
    })
    .select()
    .single();
  if (error) throw error;
  return data as Construction;
}

export async function updateConstruction(id: string, input: Partial<Omit<Construction, "id" | "company_id" | "construction_no" | "created_at" | "updated_at">>) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("constructions").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as Construction;
}

export async function createConstructionTask(constructionId: string, input: { name: string; start_date?: string; end_date?: string; assigned_to?: string; description?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { data, error } = await supabase
    .from("construction_tasks")
    .insert({
      company_id: profile.company_id,
      construction_id: constructionId,
      name: input.name,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      assigned_to: input.assigned_to || null,
      description: input.description || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ConstructionTask;
}

export async function updateConstructionTask(id: string, input: Partial<Pick<ConstructionTask, "name" | "start_date" | "end_date" | "progress" | "status" | "assigned_to">>) {
  const supabase = await createClient();
  const { error } = await supabase.from("construction_tasks").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteConstructionTask(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("construction_tasks").delete().eq("id", id);
  if (error) throw error;
}
