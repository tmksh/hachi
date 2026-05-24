"use server";

import { createClient } from "@/lib/supabase/server";
import { dispatchWebhook } from "@/lib/webhooks";
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

  void dispatchWebhook(profile.company_id, "estimate.created", {
    id: estimate.id,
    estimate_no: estimate.estimate_no,
    title: estimate.title,
    total: estimate.total,
    status: estimate.status,
  });

  return estimate as Estimate;
}

export async function updateEstimate(
  id: string,
  input: Partial<Pick<Estimate, "title" | "customer_id" | "notes" | "validity_date" | "assigned_to" | "status">>,
  items?: Array<Omit<EstimateItem, "id" | "company_id" | "estimate_id" | "created_at" | "updated_at">>
) {
  const supabase = await createClient();
  const { data: before } = await supabase
    .from("estimates")
    .select("status, company_id, title, estimate_no, total")
    .eq("id", id)
    .single();

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

  if (before && input.status && before.status !== input.status) {
    if (input.status === "accepted") {
      void dispatchWebhook(before.company_id, "estimate.approved", {
        id,
        estimate_no: before.estimate_no,
        title: before.title,
        total: before.total,
      });
    } else if (input.status === "rejected") {
      void dispatchWebhook(before.company_id, "estimate.rejected", {
        id,
        estimate_no: before.estimate_no,
        title: before.title,
        total: before.total,
      });
    }
  }
}

export async function deleteEstimate(id: string) {
  const supabase = await createClient();
  await supabase.from("estimate_items").delete().eq("estimate_id", id);
  await supabase.from("estimate_categories").delete().eq("estimate_id", id);
  const { error } = await supabase.from("estimates").delete().eq("id", id);
  if (error) throw error;
}

/** 見積改訂版を作成（2回目以降は元見積をコピーして version+1） */
export async function createEstimateRevision(parentEstimateId: string, constructionId?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const parent = await getEstimate(parentEstimateId);
  const nextVersion = (parent.version ?? 1) + 1;

  const { count } = await supabase.from("estimates").select("*", { count: "exact", head: true });
  const estimateNo = `${parent.estimate_no}-R${nextVersion}`;

  const { data: estimate, error } = await supabase
    .from("estimates")
    .insert({
      company_id: profile.company_id,
      customer_id: parent.customer_id,
      construction_id: constructionId ?? parent.construction_id ?? null,
      parent_estimate_id: parentEstimateId,
      version: nextVersion,
      estimate_no: estimateNo,
      title: parent.title ? `${parent.title}（改訂${nextVersion}）` : `改訂見積 v${nextVersion}`,
      status: "draft",
      subtotal: parent.subtotal,
      tax: parent.tax,
      total: parent.total,
      cost_total: parent.cost_total,
      gross_profit: parent.gross_profit,
      gross_profit_rate: parent.gross_profit_rate,
      reserve_fee_1_rate: parent.reserve_fee_1_rate ?? 0.02,
      reserve_fee_2_rate: parent.reserve_fee_2_rate ?? 0.03,
      default_gross_profit_rate: parent.default_gross_profit_rate ?? 0.5,
      assigned_to: parent.assigned_to,
      notes: parent.notes,
    })
    .select()
    .single();
  if (error) throw error;

  const catMap = new Map<string, string>();
  for (const cat of parent.categories ?? []) {
    const { data: newCat } = await supabase
      .from("estimate_categories")
      .insert({ company_id: profile.company_id, estimate_id: estimate.id, name: cat.name, sort_order: cat.sort_order })
      .select()
      .single();
    if (newCat) catMap.set(cat.id, newCat.id);
  }

  if (parent.items?.length) {
    await supabase.from("estimate_items").insert(
      parent.items.map((item, i) => ({
        company_id: profile.company_id,
        estimate_id: estimate.id,
        category_id: item.category_id ? catMap.get(item.category_id) ?? null : null,
        name: item.name,
        description: item.description,
        specification: item.specification,
        quantity: item.quantity,
        unit: item.unit,
        cost_price: item.cost_price,
        cost_amount: item.cost_amount,
        selling_price: item.selling_price,
        selling_amount: item.selling_amount,
        gross_profit: item.gross_profit,
        gross_profit_rate: item.gross_profit_rate,
        sort_order: i,
        notes: item.notes,
      })),
    );
  }

  if (constructionId) {
    await supabase.from("estimates").update({ construction_id: constructionId }).eq("id", estimate.id);
  }

  return estimate as Estimate;
}

