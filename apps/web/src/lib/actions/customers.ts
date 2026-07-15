"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";
import type { Customer } from "@/lib/database.types";
import { dispatchWebhook } from "@/lib/webhooks";

const CUSTOMER_LIST_SELECT =
  "*, assigned_to_profile:profiles!customers_assigned_to_fkey(id, display_name)";

export type CustomerListResult = {
  customers: (Customer & {
    assigned_to_profile: { id: string; display_name: string } | null;
  })[];
  total: number;
  page: number;
  limit: number;
};

export async function getCustomers(options?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<CustomerListResult> {
  const supabase = await createClient();
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.min(100, Math.max(1, options?.limit ?? 50));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("customers")
    .select(CUSTOMER_LIST_SELECT, { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  const search = options?.search?.trim();
  if (search) {
    const q = `%${search}%`;
    query = query.or(`name.ilike.${q},company_name.ilike.${q},email.ilike.${q}`);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    customers: (data ?? []) as CustomerListResult["customers"],
    total: count ?? 0,
    page,
    limit,
  };
}

/** タブ表示用の件数（RPC 1本） */
export async function getCustomerCounts() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_customer_counts");
  if (error) throw error;

  const row = data as { total: number; corporation: number };
  return {
    total: row.total ?? 0,
    corporation: row.corporation ?? 0,
    individual: (row.total ?? 0) - (row.corporation ?? 0),
  };
}

export async function getCustomer(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*, assigned_to_profile:profiles!customers_assigned_to_fkey(id, display_name)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Customer & { assigned_to_profile: { id: string; display_name: string } | null };
}

export async function createCustomer(input: Omit<Customer, "id" | "company_id" | "created_at" | "updated_at" | "deleted_at">) {
  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  // 既存顧客への自動紐付け（No.12）
  const linked = await findExistingCustomer(supabase, profile.company_id, {
    email: input.email,
    phone: input.phone,
    name: input.name,
    company_name: input.company_name,
  });
  if (linked) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.inquiry_content?.trim()) {
      const prev = linked.inquiry_content ? `${linked.inquiry_content}\n\n---\n` : "";
      patch.inquiry_content = `${prev}${input.inquiry_content.trim()}`;
    }
    if (input.inquiry_category) patch.inquiry_category = input.inquiry_category;
    if (input.inquiry_date) patch.inquiry_date = input.inquiry_date;
    if (input.source) patch.source = input.source;
    if (input.assigned_to) patch.assigned_to = input.assigned_to;
    if (input.email && !linked.email) patch.email = input.email;
    if (input.phone && !linked.phone) patch.phone = input.phone;

    const { data: updated, error: updErr } = await supabase
      .from("customers")
      .update(patch)
      .eq("id", linked.id)
      .select()
      .single();
    if (updErr) throw updErr;

    if (input.inquiry_content?.trim() || input.inquiry_category?.trim()) {
      const { data: deal } = await supabase.from("deals").insert({
        company_id: profile.company_id,
        customer_id: linked.id,
        title: `${updated.name} 様 問い合わせ`,
        stage: "inquiry",
        assigned_to: input.assigned_to ?? user.id,
      }).select().single();
      if (deal) {
        void dispatchWebhook(profile.company_id, "deal.created", {
          id: deal.id,
          customer_id: linked.id,
          title: deal.title,
          linked_existing_customer: true,
        });
      }
    }

    void dispatchWebhook(profile.company_id, "customer.updated", {
      id: updated.id,
      name: updated.name,
      linked_from_inquiry: true,
    });
    return { ...updated, _linkedExisting: true } as Customer & { _linkedExisting?: boolean };
  }

  let eightId = input.eight_id;
  if (!eightId) {
    const { count } = await supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("company_id", profile.company_id)
      .is("deleted_at", null);
    eightId = `EIGHT-${String((count ?? 0) + 1).padStart(6, "0")}`;
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({ ...input, eight_id: eightId, company_id: profile.company_id })
    .select()
    .single();
  if (error) throw error;
  void dispatchWebhook(profile.company_id, "customer.created", {
    id: data.id,
    name: data.name,
    company_name: data.company_name,
    status: data.status,
  });

  if (input.inquiry_content?.trim() || input.inquiry_category?.trim()) {
    const { data: deal } = await supabase.from("deals").insert({
      company_id: profile.company_id,
      customer_id: data.id,
      title: `${data.name} 様 問い合わせ`,
      stage: "inquiry",
      assigned_to: input.assigned_to ?? user.id,
    }).select().single();
    if (deal) {
      void dispatchWebhook(profile.company_id, "deal.created", {
        id: deal.id,
        customer_id: data.id,
        title: deal.title,
      });
    }
  }

  return data as Customer;
}

/** email / phone / 氏名(+会社名) で既存顧客を照合（No.12） */
export async function findExistingCustomer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  input: { email?: string | null; phone?: string | null; name?: string | null; company_name?: string | null },
) {
  const email = input.email?.trim().toLowerCase();
  if (email) {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  const phoneDigits = (input.phone ?? "").replace(/\D/g, "");
  if (phoneDigits.length >= 10) {
    const { data: candidates } = await supabase
      .from("customers")
      .select("*")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .not("phone", "is", null)
      .limit(200);
    const match = (candidates ?? []).find(
      (c) => (c.phone ?? "").replace(/\D/g, "") === phoneDigits,
    );
    if (match) return match;
  }

  const name = input.name?.trim();
  if (name && name.length >= 2) {
    let query = supabase
      .from("customers")
      .select("*")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .eq("name", name);
    const companyName = input.company_name?.trim();
    if (companyName) query = query.eq("company_name", companyName);
    const { data } = await query.limit(1).maybeSingle();
    if (data) return data;
  }

  return null;
}

export async function updateCustomer(id: string, input: Partial<Omit<Customer, "id" | "company_id" | "created_at" | "updated_at">>) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .update(input)
    .eq("id", id)
    .select("*, company_id")
    .single();
  if (error) throw error;
  void dispatchWebhook(data.company_id, "customer.updated", {
    id: data.id,
    name: data.name,
    status: data.status,
    tags: data.tags,
  });
  return data as Customer;
}

export async function deleteCustomer(id: string) {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("customers").select("company_id, name").eq("id", id).single();

  // 紐づく契約書を削除（工事の contract_id を先に外す）
  const { data: contracts } = await supabase.from("contracts").select("id").eq("customer_id", id);
  const contractIds = (contracts ?? []).map((c) => c.id);
  if (contractIds.length > 0) {
    await supabase.from("constructions").update({ contract_id: null }).in("contract_id", contractIds);
    await supabase.from("contracts").delete().in("id", contractIds);
  }

  // 紐づく工事と関連データを削除
  const { data: constructions } = await supabase.from("constructions").select("id").eq("customer_id", id);
  const constructionIds = (constructions ?? []).map((c) => c.id);
  if (constructionIds.length > 0) {
    const { data: invoices } = await supabase.from("invoices").select("id").in("construction_id", constructionIds);
    const invIds = (invoices ?? []).map((i) => i.id);
    if (invIds.length > 0) {
      await supabase.from("invoice_items").delete().in("invoice_id", invIds);
      await supabase.from("invoices").delete().in("id", invIds);
    }
    await supabase.from("construction_cost_budgets").delete().in("construction_id", constructionIds);
    await supabase.from("change_orders").delete().in("construction_id", constructionIds);
    await supabase.from("construction_tasks").delete().in("construction_id", constructionIds);
    await supabase.from("contractor_orders").delete().in("construction_id", constructionIds);
    await supabase.from("documents").delete().in("construction_id", constructionIds);
    await supabase.from("constructions").delete().in("id", constructionIds);
  }

  // 紐づく見積もり（明細・カテゴリ含む）を物理削除
  const { data: estimates } = await supabase
    .from("estimates")
    .select("id")
    .eq("customer_id", id);
  const estimateIds = (estimates ?? []).map((e) => e.id);
  if (estimateIds.length > 0) {
    await supabase.from("contracts").update({ estimate_id: null }).in("estimate_id", estimateIds);
    await supabase.from("change_orders").update({ estimate_id: null }).in("estimate_id", estimateIds);
    await supabase.from("estimate_items").delete().in("estimate_id", estimateIds);
    await supabase.from("estimate_categories").delete().in("estimate_id", estimateIds);
    await supabase.from("estimates").delete().in("id", estimateIds);
  }

  const { error } = await supabase
    .from("customers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  if (existing) {
    void dispatchWebhook(existing.company_id, "customer.deleted", { id, name: existing.name });
  }
}

type UnfollowedRpcRow = {
  id: string;
  name: string;
  company_name: string | null;
  assigned_to: string | null;
  status: string;
  inquiry_date: string | null;
  created_at: string;
  assigned_to_profile_id: string | null;
  assigned_to_display_name: string | null;
  last_deal_updated: string | null;
};

/** 担当者アサイン済みかつ一定日数以上フォローアップ活動のない顧客を取得（RPC） */
export async function getUnfollowedCustomers(days = 7, page = 1, limit = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_unfollowed_customers", {
    p_days: days,
    p_page: page,
    p_limit: limit,
  });
  if (error) throw error;

  return ((data ?? []) as UnfollowedRpcRow[]).map((c) => ({
    id: c.id,
    name: c.name,
    company_name: c.company_name,
    assigned_to: c.assigned_to,
    assigned_to_profile: c.assigned_to_profile_id
      ? { id: c.assigned_to_profile_id, display_name: c.assigned_to_display_name ?? "" }
      : null,
    status: c.status,
    inquiry_date: c.inquiry_date,
    created_at: c.created_at,
    last_deal_updated: c.last_deal_updated,
  }));
}

export async function getUnfollowedCustomersCount(days = 7) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_unfollowed_customers_count", { p_days: days });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function getCustomerDealSummaries(customerIds: string[]) {
  if (customerIds.length === 0) return {} as Record<string, string>;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals")
    .select("customer_id, updated_at, stage")
    .in("customer_id", customerIds)
    .not("stage", "in", '("won","lost")');
  if (error) throw error;

  const map: Record<string, string> = {};
  for (const deal of data ?? []) {
    const prev = map[deal.customer_id];
    if (!prev || deal.updated_at > prev) {
      map[deal.customer_id] = deal.updated_at;
    }
  }
  return map;
}

export async function getCustomerRelated(customerId: string) {
  const supabase = await createClient();
  const [dealsRes, estimatesRes, contractsRes, constructionsRes] = await Promise.all([
    supabase.from("deals").select("id, title, stage, value, created_at").eq("customer_id", customerId).order("created_at", { ascending: false }),
    supabase.from("estimates").select("id, estimate_no, title, total, status, created_at").eq("customer_id", customerId).order("created_at", { ascending: false }),
    supabase.from("contracts").select("id, contract_no, title, amount, status, contract_date").eq("customer_id", customerId).order("created_at", { ascending: false }),
    supabase.from("constructions").select("id, title, status, start_date, end_date, progress").eq("customer_id", customerId).order("created_at", { ascending: false }),
  ]);
  return {
    deals: dealsRes.data ?? [],
    estimates: estimatesRes.data ?? [],
    contracts: contractsRes.data ?? [],
    constructions: constructionsRes.data ?? [],
  };
}
