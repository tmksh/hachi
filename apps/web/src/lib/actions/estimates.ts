"use server";

import { createClient } from "@/lib/supabase/server";
import type { Estimate, EstimateCategory, EstimateItem } from "@/lib/database.types";

export async function getEstimates() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("estimates")
    .select("*, customer:customers(id, name, company_name), assignee:profiles!estimates_assigned_to_fkey(id, display_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getEstimate(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("estimates")
    .select("*, customer:customers(id, name, company_name)")
    .eq("id", id)
    .single();
  if (error) throw error;

  const { data: categories } = await supabase
    .from("estimate_categories")
    .select("*")
    .eq("estimate_id", id)
    .order("sort_order");

  const { data: items } = await supabase
    .from("estimate_items")
    .select("*")
    .eq("estimate_id", id)
    .order("sort_order");

  return { ...data, categories: categories || [], items: items || [] } as Estimate & {
    categories: EstimateCategory[];
    items: EstimateItem[];
  };
}

export async function createEstimate(
  input: { title: string; customer_id?: string; notes?: string; validity_date?: string; assigned_to?: string },
  items: Array<Omit<EstimateItem, "id" | "company_id" | "estimate_id" | "created_at" | "updated_at">>
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  // Generate estimate number
  const { count } = await supabase
    .from("estimates")
    .select("*", { count: "exact", head: true });
  const estimateNo = `EST-${String((count || 0) + 1).padStart(4, "0")}`;

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (item.selling_amount || 0), 0);
  const tax = Math.floor(subtotal * 0.1);
  const costTotal = items.reduce((sum, item) => sum + (item.cost_amount || 0), 0);

  const { data: estimate, error } = await supabase
    .from("estimates")
    .insert({
      company_id: profile.company_id,
      estimate_no: estimateNo,
      title: input.title,
      customer_id: input.customer_id || null,
      notes: input.notes || null,
      validity_date: input.validity_date || null,
      assigned_to: input.assigned_to || null,
      status: "draft",
      subtotal,
      tax,
      total: subtotal + tax,
      cost_total: costTotal,
      gross_profit: subtotal - costTotal,
      gross_profit_rate: subtotal > 0 ? ((subtotal - costTotal) / subtotal) * 100 : 0,
    })
    .select()
    .single();
  if (error) throw error;

  if (items.length > 0) {
    const { error: itemsError } = await supabase
      .from("estimate_items")
      .insert(items.map((item, i) => ({
        ...item,
        company_id: profile.company_id,
        estimate_id: estimate.id,
        sort_order: i,
      })));
    if (itemsError) throw itemsError;
  }

  return estimate as Estimate;
}

export async function updateEstimate(
  id: string,
  input: Partial<Pick<Estimate, "title" | "customer_id" | "notes" | "validity_date" | "assigned_to" | "status">>,
  items?: Array<Omit<EstimateItem, "id" | "company_id" | "estimate_id" | "created_at" | "updated_at">>
) {
  const supabase = await createClient();

  if (items) {
    const subtotal = items.reduce((sum, item) => sum + (item.selling_amount || 0), 0);
    const tax = Math.floor(subtotal * 0.1);
    const costTotal = items.reduce((sum, item) => sum + (item.cost_amount || 0), 0);

    const { error } = await supabase
      .from("estimates")
      .update({
        ...input,
        subtotal,
        tax,
        total: subtotal + tax,
        cost_total: costTotal,
        gross_profit: subtotal - costTotal,
        gross_profit_rate: subtotal > 0 ? ((subtotal - costTotal) / subtotal) * 100 : 0,
      })
      .eq("id", id);
    if (error) throw error;

    // Replace items
    await supabase.from("estimate_items").delete().eq("estimate_id", id);

    const { data: est } = await supabase.from("estimates").select("company_id").eq("id", id).single();
    if (est && items.length > 0) {
      await supabase.from("estimate_items").insert(
        items.map((item, i) => ({
          ...item,
          company_id: est.company_id,
          estimate_id: id,
          sort_order: i,
        }))
      );
    }
  } else {
    const { error } = await supabase.from("estimates").update(input).eq("id", id);
    if (error) throw error;
  }
}

export async function deleteEstimate(id: string) {
  const supabase = await createClient();
  await supabase.from("estimate_items").delete().eq("estimate_id", id);
  await supabase.from("estimate_categories").delete().eq("estimate_id", id);
  const { error } = await supabase.from("estimates").delete().eq("id", id);
  if (error) throw error;
}
