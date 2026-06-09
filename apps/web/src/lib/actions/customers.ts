"use server";

import { createClient } from "@/lib/supabase/server";
import type { Customer } from "@/lib/database.types";
import { dispatchWebhook } from "@/lib/webhooks";

export async function getCustomers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*, assigned_to_profile:profiles!customers_assigned_to_fkey(id, display_name), deals(id, updated_at, stage)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as (Customer & {
    assigned_to_profile: { id: string; display_name: string } | null;
    deals: Array<{ id: string; updated_at: string; stage: string }>;
  })[];
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

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
  const { error } = await supabase
    .from("customers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  if (existing) {
    void dispatchWebhook(existing.company_id, "customer.deleted", { id, name: existing.name });
  }
}

/**
 * 担当者アサイン済みかつ一定日数以上フォローアップ活動のない顧客を取得
 * @param days 未フォローアップとみなす日数（デフォルト7日）
 */
export async function getUnfollowedCustomers(days = 7) {
  const supabase = await createClient();
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - days);

  // assigned_to がある顧客を取得（最新の商談updated_atも取得）
  const { data: customers, error } = await supabase
    .from("customers")
    .select(`
      id, name, company_name, assigned_to, status, inquiry_date, created_at,
      assigned_to_profile:profiles!customers_assigned_to_fkey(id, display_name),
      deals(id, updated_at, stage)
    `)
    .is("deleted_at", null)
    .not("assigned_to", "is", null);

  if (error) throw error;

  const result = (customers ?? []).filter((c) => {
    const cDeals = (c.deals as Array<{ id: string; updated_at: string; stage: string }> | null) ?? [];
    const activeDeals = cDeals.filter((d) => !["won", "lost"].includes(d.stage));
    if (activeDeals.length === 0) return true; // 商談なし = フォローアップ必要
    const lastActivity = activeDeals.reduce((latest, d) => {
      const t = new Date(d.updated_at).getTime();
      return t > latest ? t : latest;
    }, 0);
    return lastActivity < threshold.getTime();
  });

  return result.map((c) => ({
    id: c.id,
    name: c.name,
    company_name: c.company_name,
    assigned_to: c.assigned_to,
    assigned_to_profile: (c.assigned_to_profile as unknown) as { id: string; display_name: string } | null,
    status: c.status,
    inquiry_date: c.inquiry_date,
    created_at: c.created_at,
    last_deal_updated: (() => {
      const cDeals = (c.deals as Array<{ id: string; updated_at: string; stage: string }> | null) ?? [];
      const activeDeals = cDeals.filter((d) => !["won", "lost"].includes(d.stage));
      if (activeDeals.length === 0) return null;
      return activeDeals.reduce((latest, d) => {
        return new Date(d.updated_at) > new Date(latest) ? d.updated_at : latest;
      }, activeDeals[0].updated_at);
    })(),
  }));
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
