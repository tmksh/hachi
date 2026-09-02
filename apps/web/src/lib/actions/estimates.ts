"use server";

import { createClient } from "@/lib/supabase/server";
import { dispatchWebhook } from "@/lib/webhooks";
import type { Estimate, EstimateCategory, EstimateItem } from "@/lib/database.types";

export type EstimateListRow = {
  id: string;
  company_id: string;
  estimate_no: string;
  title: string;
  version: number | null;
  status: Estimate["status"];
  total: number | null;
  subtotal: number | null;
  tax: number | null;
  gross_profit_rate: number | null;
  customer_id: string | null;
  construction_id: string | null;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer: { id: string; name: string; company_name: string | null; customer_type?: string | null; notes?: string | null } | null;
  construction: { id: string; title: string; construction_no: string } | null;
  assignee: { id: string; display_name: string } | null;
};

export async function getEstimates(): Promise<EstimateListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("estimates")
    .select(
      "id, company_id, estimate_no, title, version, status, total, subtotal, tax, gross_profit_rate, customer_id, construction_id, assigned_to, notes, created_at, updated_at, customer:customers(id, name, company_name, customer_type, notes), construction:constructions!construction_id(id, title, construction_no), assignee:profiles!estimates_assigned_to_fkey(id, display_name)",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as EstimateListRow[];
}

export async function getEstimatesByCustomer(customerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("estimates")
      .select("*, customer:customers(id, name, company_name, customer_type, notes)")
      .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getEstimate(id: string) {
  const supabase = await createClient();
  const [{ data, error }, { data: categories }, { data: items }] = await Promise.all([
    supabase
      .from("estimates")
      .select("*, customer:customers(id, name, company_name, customer_type, notes)")
      .eq("id", id)
      .single(),
    supabase
      .from("estimate_categories")
      .select("*")
      .eq("estimate_id", id)
      .order("sort_order"),
    supabase
      .from("estimate_items")
      .select("*")
      .eq("estimate_id", id)
      .order("sort_order"),
  ]);
  if (error) throw error;

  return { ...data, categories: categories || [], items: items || [] } as Estimate & {
    categories: EstimateCategory[];
    items: EstimateItem[];
    customer?: {
      id: string;
      name: string;
      company_name: string | null;
      customer_type?: string | null;
      notes?: string | null;
    } | null;
  };
}

export type CreateEstimateCategoryInput = {
  name: string;
  items: Array<{
    name: string;
    quantity: number;
    unit: string;
    cost_price?: number;
    selling_price: number;
  }>;
};

export async function createEstimate(
  input: {
    title: string;
    customer_id?: string;
    notes?: string;
    validity_date?: string;
    assigned_to?: string;
    department_name?: string | null;
  },
  categories: CreateEstimateCategoryInput[],
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const normalizedCategories = categories.length > 0 ? categories : [{ name: "明細", items: [] }];

  const flatItems: Array<Omit<EstimateItem, "id" | "company_id" | "estimate_id" | "created_at" | "updated_at">> = [];
  for (const category of normalizedCategories) {
    for (const item of category.items.filter((row) => row.name.trim())) {
      const costPrice = item.cost_price ?? 0;
      const sellingAmount = Math.round(item.quantity * item.selling_price);
      const costAmount = Math.round(item.quantity * costPrice);
      const grossProfit = sellingAmount - costAmount;
      flatItems.push({
        name: item.name.trim(),
        description: null,
        specification: null,
        quantity: item.quantity,
        unit: item.unit,
        cost_price: costPrice,
        cost_amount: costAmount,
        selling_price: item.selling_price,
        selling_amount: sellingAmount,
        gross_profit: grossProfit,
        gross_profit_rate: sellingAmount > 0 ? Math.round((grossProfit / sellingAmount) * 1000) / 10 : 0,
        sort_order: flatItems.length,
        notes: null,
        category_id: null,
      });
    }
  }

  // Generate estimate number
  const { count } = await supabase
    .from("estimates")
    .select("*", { count: "exact", head: true });
  const estimateNo = `EST-${String((count || 0) + 1).padStart(4, "0")}`;

  // Calculate totals
  const subtotal = flatItems.reduce((sum, item) => sum + (item.selling_amount || 0), 0);
  const tax = Math.floor(subtotal * 0.1);
  const costTotal = flatItems.reduce((sum, item) => sum + (item.cost_amount || 0), 0);

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
      department_name: input.department_name?.trim() || null,
      status: "draft",
      // 新規見積: 料率は残置（BI連動用）。金額は明細行（発注業者=システム予約）で計上（No.106）
      reserve_fee_1_rate: 0.02,
      reserve_fee_2_rate: 0.03,
      reserve_fee_1_amount: 0,
      reserve_fee_2_amount: 0,
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

  const catMap = new Map<number, string>();
  for (const [idx, category] of normalizedCategories.entries()) {
    const { data: newCat, error: catError } = await supabase
      .from("estimate_categories")
      .insert({
        company_id: profile.company_id,
        estimate_id: estimate.id,
        name: category.name.trim() || "明細",
        sort_order: idx,
      })
      .select()
      .single();
    if (catError) throw catError;
    if (newCat) catMap.set(idx, newCat.id);
  }

  if (flatItems.length > 0) {
    let sortOrder = 0;
    const itemsToInsert = normalizedCategories.flatMap((category, catIdx) => {
      const categoryId = catMap.get(catIdx) ?? null;
      return category.items
        .filter((row) => row.name.trim())
        .map((item) => {
          const costPrice = item.cost_price ?? 0;
          const sellingAmount = Math.round(item.quantity * item.selling_price);
          const costAmount = Math.round(item.quantity * costPrice);
          const grossProfit = sellingAmount - costAmount;
          const row = {
            company_id: profile.company_id,
            estimate_id: estimate.id,
            category_id: categoryId,
            name: item.name.trim(),
            description: null,
            specification: null,
            quantity: item.quantity,
            unit: item.unit,
            cost_price: costPrice,
            cost_amount: costAmount,
            selling_price: item.selling_price,
            selling_amount: sellingAmount,
            gross_profit: grossProfit,
            gross_profit_rate: sellingAmount > 0 ? Math.round((grossProfit / sellingAmount) * 1000) / 10 : 0,
            sort_order: sortOrder++,
            notes: null,
          };
          return row;
        });
    });

    const { error: itemsError } = await supabase.from("estimate_items").insert(itemsToInsert);
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
  input: Partial<Pick<Estimate, "title" | "customer_id" | "notes" | "validity_date" | "assigned_to" | "status" | "department_name" | "reserve_fee_1_rate" | "reserve_fee_2_rate" | "reserve_fee_1_amount" | "reserve_fee_2_amount">>,
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

    // 経営調整費・予備費金額変更時は明細外原価を含めて合計を再計算
    if (input.reserve_fee_1_amount != null || input.reserve_fee_2_amount != null) {
      const [{ data: items }, { data: est }] = await Promise.all([
        supabase
          .from("estimate_items")
          .select("selling_amount, cost_amount, is_text_row")
          .eq("estimate_id", id),
        supabase
          .from("estimates")
          .select("reserve_fee_1_amount, reserve_fee_2_amount")
          .eq("id", id)
          .single(),
      ]);
      const lineItems = (items ?? []).filter((item) => !item.is_text_row);
      const subtotal = lineItems.reduce((sum, item) => sum + Number(item.selling_amount ?? 0), 0);
      const lineCost = lineItems.reduce((sum, item) => sum + Number(item.cost_amount ?? 0), 0);
      const reserveCost =
        Number(est?.reserve_fee_1_amount ?? 0) + Number(est?.reserve_fee_2_amount ?? 0);
      const costTotal = lineCost + reserveCost;
      const tax = Math.floor(subtotal * 0.1);
      const grossProfit = subtotal - costTotal;
      await supabase
        .from("estimates")
        .update({
          subtotal,
          tax,
          total: subtotal + tax,
          cost_total: costTotal,
          gross_profit: grossProfit,
          gross_profit_rate: subtotal > 0 ? (grossProfit / subtotal) * 100 : 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    }
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

/** 見積コピー（新規見積として複製） */
export async function copyEstimate(sourceId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const source = await getEstimate(sourceId);
  const { count } = await supabase.from("estimates").select("*", { count: "exact", head: true });
  const estimateNo = `EST-${String((count || 0) + 1).padStart(4, "0")}`;

  const { data: estimate, error } = await supabase.from("estimates").insert({
    company_id: profile.company_id,
    customer_id: source.customer_id,
    estimate_no: estimateNo,
    title: source.title ? `${source.title}（コピー）` : "見積（コピー）",
    status: "draft",
    subtotal: source.subtotal,
    tax: source.tax,
    total: source.total,
    cost_total: source.cost_total,
    gross_profit: source.gross_profit,
    gross_profit_rate: source.gross_profit_rate,
    notes: source.notes,
  }).select().single();
  if (error) throw error;

  const catMap = new Map<string, string>();
  for (const cat of source.categories ?? []) {
    const { data: newCat } = await supabase.from("estimate_categories").insert({
      company_id: profile.company_id,
      estimate_id: estimate.id,
      name: cat.name,
      sort_order: cat.sort_order,
    }).select().single();
    if (newCat) catMap.set(cat.id, newCat.id);
  }

  if (source.items?.length) {
    await supabase.from("estimate_items").insert(
      source.items.map((item, i) => ({
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

  return estimate as Estimate;
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

