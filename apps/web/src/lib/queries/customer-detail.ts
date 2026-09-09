import { createClient } from "@/lib/supabase/client";
import type { Customer } from "@/lib/database.types";

export const CUSTOMER_QK = {
  detail: (id: string) => ["customer", id] as const,
  related: (id: string) => ["customer-related", id] as const,
  recordings: (id: string) => ["customer-recordings", id] as const,
  todos: (id: string) => ["customer-todos", id] as const,
};

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

export type CustomerRecordingRow = {
  id: string;
  customer_id: string;
  deal_id: string | null;
  title: string;
  transcript: string;
  summary: string;
  memo: string;
  duration_seconds: number;
  status: string;
  recorded_at: string;
  created_at: string;
};

export async function fetchCustomerRecordings(customerId: string): Promise<CustomerRecordingRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("customer_recordings")
    .select("*")
    .eq("customer_id", customerId)
    .order("recorded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CustomerRecordingRow[];
}

export async function fetchCustomerTodos(customerId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("todos")
    .select("*")
    .eq("customer_id", customerId)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    status: string;
    priority: string;
    source?: string | null;
    created_at: string;
  }>;
}

export async function fetchCustomerDocumentsAll(customerId: string) {
  const supabase = createClient();
  const { data: constructions } = await supabase
    .from("constructions")
    .select("id")
    .eq("customer_id", customerId);

  const constructionIds = (constructions ?? []).map((c) => c.id);
  const select =
    "*, uploader:profiles!documents_uploaded_by_fkey(id, display_name), customer:customers(id, name), construction:constructions(id, title)";

  let query = supabase
    .from("documents")
    .select(select)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (constructionIds.length > 0) {
    query = query.or(
      `customer_id.eq.${customerId},construction_id.in.(${constructionIds.join(",")})`,
    );
  } else {
    query = query.eq("customer_id", customerId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
