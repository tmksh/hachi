"use server";

import { createClient } from "@/lib/supabase/server";
import type { Contract } from "@/lib/database.types";

export async function getContracts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contracts")
    .select("*, customer:customers(id, name, company_name), assignee:profiles!contracts_assigned_to_fkey(id, display_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getContract(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contracts")
    .select("*, customer:customers(id, name, company_name), estimate:estimates(id, estimate_no, title, total)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createContract(input: {
  title: string;
  customer_id?: string;
  estimate_id?: string;
  contract_date?: string;
  start_date?: string;
  end_date?: string;
  amount?: number;
  assigned_to?: string;
  notes?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { count } = await supabase.from("contracts").select("*", { count: "exact", head: true });
  const contractNo = `CON-${String((count || 0) + 1).padStart(4, "0")}`;

  const { data, error } = await supabase
    .from("contracts")
    .insert({
      company_id: profile.company_id,
      contract_no: contractNo,
      title: input.title,
      customer_id: input.customer_id || null,
      estimate_id: input.estimate_id || null,
      contract_date: input.contract_date || null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      amount: input.amount || 0,
      assigned_to: input.assigned_to || null,
      notes: input.notes || null,
      status: "preparing",
    })
    .select()
    .single();
  if (error) throw error;
  return data as Contract;
}

export async function updateContract(id: string, input: Partial<Omit<Contract, "id" | "company_id" | "contract_no" | "created_at" | "updated_at">>) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("contracts").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as Contract;
}

export async function deleteContract(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("contracts").delete().eq("id", id);
  if (error) throw error;
}
