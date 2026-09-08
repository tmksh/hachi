import { createClient } from "@/lib/supabase/client";
import type { Customer } from "@/lib/database.types";

export type CustomerDetail = Customer & {
  assigned_to_profile: { id: string; display_name: string } | null;
};

export async function fetchCustomer(id: string): Promise<CustomerDetail> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*, assigned_to_profile:profiles!customers_assigned_to_fkey(id, display_name)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as CustomerDetail;
}

export type CustomerRelated = {
  deals: { id: string; title: string; stage: string; value: number | null; created_at: string }[];
  estimates: { id: string; estimate_no: string; title: string | null; total: number | null; status: string; created_at: string }[];
  contracts: { id: string; contract_no: string; title: string; amount: number | null; status: string; contract_date: string | null }[];
  constructions: { id: string; title: string; status: string; start_date: string | null; end_date: string | null; progress: number | null }[];
};

export async function fetchCustomerRelated(customerId: string): Promise<CustomerRelated> {
  const supabase = createClient();
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
