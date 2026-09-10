import { createClient } from "@/lib/supabase/client";
import type { Estimate } from "@/lib/database.types";

export const ESTIMATE_STALE_MS = 120_000;
export const ESTIMATE_DETAIL_STALE_MS = 60_000;

export const ESTIMATE_QK = {
  all: ["estimates"] as const,
  detail: (id: string) => ["estimate", id] as const,
};

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

export async function fetchEstimates(): Promise<EstimateListRow[]> {
  const supabase = createClient();
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

export { fetchEstimate } from "./details";
