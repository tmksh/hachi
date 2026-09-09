import { createClient } from "@/lib/supabase/client";

export const DEAL_STALE_MS = 120_000;

export const DEAL_QK = {
  all: ["deals"] as const,
  stages: ["deal-stages"] as const,
  customerPrefix: ["customer-deals"] as const,
  customer: (customerId: string) => ["customer-deals", customerId] as const,
};

const DEAL_LIST_SELECT =
  "id, company_id, customer_id, title, stage, value, priority, expected_close_date, assigned_to, department_name, tags, next_action, summary, days_in_stage, created_at, updated_at, customer:customers(id, name, company_name), assignee:profiles!deals_assigned_to_fkey(id, display_name)";

export type DealListRow = {
  id: string;
  company_id: string;
  customer_id: string | null;
  title: string;
  stage: string;
  value: number | null;
  priority: string;
  expected_close_date: string | null;
  assigned_to: string | null;
  department_name: string | null;
  tags: string[] | null;
  next_action: string | null;
  summary: string | null;
  days_in_stage: number | null;
  created_at: string;
  updated_at: string;
  customer: { id: string; name: string; company_name: string | null } | null;
  assignee: { id: string; display_name: string } | null;
};

export type DealStageRow = {
  key: string;
  label: string;
  color: string;
  is_won: boolean;
  is_lost: boolean;
  sort_order: number;
};

export async function fetchDeals(): Promise<DealListRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("deals")
    .select(DEAL_LIST_SELECT)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as DealListRow[];
}

export async function fetchDealStages(): Promise<DealStageRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("deal_stages")
    .select("key, label, color, is_won, is_lost, sort_order")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as DealStageRow[];
}

export async function fetchCustomerDealsWithActivities(customerId: string) {
  const supabase = createClient();
  const { data: deals, error } = await supabase
    .from("deals")
    .select("*, assignee:profiles!deals_assigned_to_fkey(id, display_name)")
    .eq("customer_id", customerId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const dealIds = (deals ?? []).map((d) => d.id);
  if (dealIds.length === 0) return [];
  const { data: activities } = await supabase
    .from("deal_activities")
    .select("*, performer:profiles!deal_activities_performed_by_fkey(id, display_name)")
    .in("deal_id", dealIds)
    .order("performed_at", { ascending: false });
  return (deals ?? []).map((d) => ({
    ...d,
    activities: (activities ?? []).filter((a) => a.deal_id === d.id),
  }));
}

export type DealWithActivities = Awaited<ReturnType<typeof fetchCustomerDealsWithActivities>>[number];

export type StageProposal = {
  id: string;
  deal_id: string;
  customer_id: string;
  current_stage: string;
  proposed_stage: string;
  reason: string | null;
  confidence: number | null;
  status: string;
  created_at: string;
  deal?: { title: string } | null;
};

export async function fetchPendingStageProposals(): Promise<StageProposal[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [{ data, error }, dealsRes] = await Promise.all([
    supabase
      .from("deal_stage_proposals")
      .select("*, deal:deals(title)")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("deals").select("id").eq("assigned_to", user.id),
  ]);
  if (error) throw error;
  if (dealsRes.error) throw dealsRes.error;

  const myDealIds = new Set((dealsRes.data ?? []).map((d) => d.id));
  return ((data ?? []) as StageProposal[]).filter((p) => myDealIds.has(p.deal_id));
}
