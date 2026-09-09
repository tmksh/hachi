import { createClient } from "@/lib/supabase/client";

export const CRM_MASTER_STALE_MS = 5 * 60_000;

export const CRM_MASTER_QK = {
  stages: ["crm-master-stages"] as const,
  lostReasons: ["crm-master-lost-reasons"] as const,
  leadSources: ["crm-master-lead-sources"] as const,
  tags: ["crm-master-tags"] as const,
};

export type CrmMasterStage = {
  id: string;
  key: string;
  label: string;
  color: string;
  sort_order: number;
  is_won: boolean;
  is_lost: boolean;
};

export type CrmMasterItem = { id: string; label: string; sort_order: number };

export async function fetchCrmDealStages(): Promise<CrmMasterStage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("deal_stages")
    .select("id, key, label, color, sort_order, is_won, is_lost")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as CrmMasterStage[];
}

export async function fetchLostReasons(): Promise<CrmMasterItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lost_reasons")
    .select("id, label, sort_order")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as CrmMasterItem[];
}

export async function fetchLeadSources(): Promise<CrmMasterItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lead_sources")
    .select("id, label, sort_order")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as CrmMasterItem[];
}

export async function fetchCustomerTagMasters(): Promise<CrmMasterItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("customer_tag_masters")
    .select("id, label, sort_order")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as CrmMasterItem[];
}
