import { createClient } from "@/lib/supabase/client";
import { scopedSupabase } from "@/lib/queries/scoped";
import type { Craftsman, InboundLead, Profile } from "@/lib/database.types";

import { DEAL_QK } from "./deals";

export const LIST_STALE_MS = 120_000;

export const LIST_QK = {
  deals: DEAL_QK.all,
  dealStages: DEAL_QK.stages,
  profiles: ["profiles"] as const,
};

export {
  fetchDeals,
  fetchDealStages,
  type DealListRow,
  type DealStageRow,
} from "./deals";

export {
  fetchEstimates,
  type EstimateListRow,
} from "./estimates";

const CONSTRUCTION_LIST_SELECT =
  "id, company_id, construction_no, title, status, customer_id, contract_id, estimate_id, assigned_to, department_name, location_id, order_amount, order_cost, budget_cost, actual_cost, payment_date, payment_amount, worker_count, progress, start_date, end_date, created_at, updated_at, customer:customers(id, name, company_name), assignee:profiles!constructions_assigned_to_fkey(id, display_name)";

export type ConstructionListRow = {
  id: string;
  company_id: string;
  construction_no: string;
  title: string;
  status: "preparing" | "in_progress" | "completed" | "suspended" | "delayed";
  customer_id: string | null;
  contract_id: string | null;
  estimate_id: string | null;
  assigned_to: string | null;
  department_name: string | null;
  location_id: string | null;
  order_amount: number;
  order_cost: number;
  budget_cost: number;
  actual_cost: number;
  payment_date: string | null;
  payment_amount: number;
  worker_count: number;
  progress: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  customer: { id: string; name: string; company_name: string | null } | null;
  assignee: { id: string; display_name: string } | null;
};

export async function fetchConstructions(): Promise<ConstructionListRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("constructions")
    .select(CONSTRUCTION_LIST_SELECT)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as ConstructionListRow[];
}

const CONTRACT_LIST_SELECT =
  "id, company_id, contract_no, title, status, amount, contract_date, customer_id, assigned_to, created_at, customer:customers(id, name, company_name), assignee:profiles!contracts_assigned_to_fkey(id, display_name)";

export type ContractListRow = {
  id: string;
  company_id: string;
  contract_no: string;
  title: string;
  status: "preparing" | "contracted" | "executing" | "completed" | "cancelled";
  amount: number;
  contract_date: string | null;
  customer_id: string | null;
  assigned_to: string | null;
  created_at: string;
  customer: { id: string; name: string; company_name: string | null } | null;
  assignee: { id: string; display_name: string } | null;
};

export async function fetchContracts(): Promise<ContractListRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contracts")
    .select(CONTRACT_LIST_SELECT)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as ContractListRow[];
}

const INVOICE_LIST_SELECT =
  "id, invoice_no, invoice_date, due_date, total, status, customer_id, construction_id, customer:customers(id, name, company_name), construction:constructions(id, title)";

export type InvoiceListRow = {
  id: string;
  invoice_no: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total: number;
  status: "draft" | "sent" | "paid" | "cancelled";
  customer_id: string | null;
  construction_id: string | null;
  customer: { id: string; name: string; company_name: string | null } | null;
  construction: { id: string; title: string } | null;
};

export async function fetchInvoices(): Promise<InvoiceListRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_LIST_SELECT)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as InvoiceListRow[];
}

export async function fetchCraftsmen(): Promise<Craftsman[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("craftsmen")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as Craftsman[];
}

export async function fetchProfiles(): Promise<Profile[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, company_id, display_name, email, role, avatar_url, department, position, phone")
    .order("display_name");
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function fetchWorkflowRequests(status?: string) {
  const { supabase, companyId } = await scopedSupabase();
  let query = supabase
    .from("workflow_requests")
    .select("*, requester:profiles!workflow_requests_requester_id_fkey(id, display_name), workflow_type:workflow_types!workflow_requests_type_id_fkey(id, key, name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchInboundLeads(status?: string): Promise<InboundLead[]> {
  const supabase = createClient();
  let query = supabase
    .from("inbound_leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  const { data, error } = await query;
  if (error) {
    if (error.code === "42P01" || /inbound_leads|does not exist|schema cache/i.test(error.message ?? "")) {
      return [];
    }
    throw error;
  }
  return (data ?? []) as InboundLead[];
}
