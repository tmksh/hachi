"use server";

import { createClient } from "@/lib/supabase/server";
import type { Customer } from "@/lib/database.types";
import { dispatchWebhook } from "@/lib/webhooks";

export async function getCustomers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*, assigned_to_profile:profiles!customers_assigned_to_fkey(id, display_name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as (Customer & { assigned_to_profile: { id: string; display_name: string } | null })[];
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

export async function getCustomerRelated(customerId: string) {
  const supabase = await createClient();
  const [dealsRes, estimatesRes, contractsRes, constructionsRes] = await Promise.all([
    supabase.from("deals").select("id, title, stage, value, created_at").eq("customer_id", customerId).order("created_at", { ascending: false }),
    supabase.from("estimates").select("id, estimate_no, title, total_amount, status, created_at").eq("customer_id", customerId).order("created_at", { ascending: false }),
    supabase.from("contracts").select("id, contract_no, title, amount, status, contract_date").eq("customer_id", customerId).order("created_at", { ascending: false }),
    supabase.from("constructions").select("id, title, status, start_date, end_date, progress_pct").eq("customer_id", customerId).order("created_at", { ascending: false }),
  ]);
  return {
    deals: dealsRes.data ?? [],
    estimates: estimatesRes.data ?? [],
    contracts: contractsRes.data ?? [],
    constructions: constructionsRes.data ?? [],
  };
}
