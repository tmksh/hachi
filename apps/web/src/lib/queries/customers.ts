import { createClient } from "@/lib/supabase/client";
import type { Customer } from "@/lib/database.types";
import { DEFAULT_DEPARTMENTS, getCurrentFiscalYear } from "@/lib/bi-utils";
import type { CustomerEntryMasters } from "@/lib/actions/customers";

const CUSTOMER_LIST_SELECT =
  "id, company_id, name, company_name, email, phone, customer_type, status, source, assigned_to, address, department, prospect_grade, inquiry_category, inquiry_date, created_at, updated_at, deleted_at, assigned_to_profile:profiles!customers_assigned_to_fkey(id, display_name)";

export type CustomerListItem = Customer & {
  assigned_to_profile: { id: string; display_name: string } | null;
};

export type CustomerListResult = {
  customers: CustomerListItem[];
  total: number;
  page: number;
  limit: number;
};

/** ブラウザ → Supabase 直結 */
export async function fetchCustomers(options?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<CustomerListResult> {
  const supabase = createClient();
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
    customers: (data ?? []) as unknown as CustomerListItem[],
    total: count ?? 0,
    page,
    limit,
  };
}

export async function fetchCustomerCounts() {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_customer_counts");
  if (error) throw error;

  const row = data as { total: number; corporation: number };
  return {
    total: row.total ?? 0,
    corporation: row.corporation ?? 0,
    individual: (row.total ?? 0) - (row.corporation ?? 0),
  };
}

export type UnfollowedCustomer = {
  id: string;
  name: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  assigned_to: string | null;
  assigned_to_profile: { id: string; display_name: string } | null;
  status: string;
  inquiry_date: string | null;
  created_at: string;
  last_deal_updated: string | null;
};

type UnfollowedRpcRow = {
  id: string;
  name: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  assigned_to: string | null;
  status: string;
  inquiry_date: string | null;
  created_at: string;
  assigned_to_profile_id: string | null;
  assigned_to_display_name: string | null;
  last_deal_updated: string | null;
};

export async function fetchUnfollowedCustomers(options?: {
  days?: number;
  page?: number;
  limit?: number;
}): Promise<{ customers: UnfollowedCustomer[]; total: number; page: number; limit: number }> {
  const supabase = createClient();
  const days = options?.days ?? 7;
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.min(100, Math.max(1, options?.limit ?? 50));

  const [{ data, error }, { data: total, error: countError }] = await Promise.all([
    supabase.rpc("get_unfollowed_customers", { p_days: days, p_page: page, p_limit: limit }),
    supabase.rpc("get_unfollowed_customers_count", { p_days: days }),
  ]);
  if (error) throw error;
  if (countError) throw countError;

  const customers = ((data ?? []) as UnfollowedRpcRow[]).map((c) => ({
    id: c.id,
    name: c.name,
    company_name: c.company_name,
    phone: c.phone,
    email: c.email,
    address: c.address,
    assigned_to: c.assigned_to,
    assigned_to_profile: c.assigned_to_profile_id
      ? { id: c.assigned_to_profile_id, display_name: c.assigned_to_display_name ?? "" }
      : null,
    status: c.status,
    inquiry_date: c.inquiry_date,
    created_at: c.created_at,
    last_deal_updated: c.last_deal_updated,
  }));

  return {
    customers,
    total: Number(total ?? 0),
    page,
    limit,
  };
}

export async function fetchUnfollowedCustomersCount(days = 7) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_unfollowed_customers_count", { p_days: days });
  if (error) throw error;
  return Number(data ?? 0);
}

/** 一覧表示用: 顧客 ID ごとの最新アクティブ商談更新日（フォローアップバッジ用） */
export async function fetchCustomerDealSummaries(customerIds: string[]) {
  if (customerIds.length === 0) return new Map<string, string>();

  const supabase = createClient();
  const { data, error } = await supabase
    .from("deals")
    .select("customer_id, updated_at, stage")
    .in("customer_id", customerIds)
    .not("stage", "in", '("won","lost")');
  if (error) throw error;

  const map = new Map<string, string>();
  for (const deal of data ?? []) {
    const prev = map.get(deal.customer_id);
    if (!prev || deal.updated_at > prev) {
      map.set(deal.customer_id, deal.updated_at);
    }
  }
  return map;
}

export async function fetchCustomerEntryMasters(): Promise<CustomerEntryMasters> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const fallback = [...DEFAULT_DEPARTMENTS];
  if (!user) {
    return { profiles: [], tagMasters: [], leadSources: [], departments: fallback };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();
  if (profileError) throw profileError;
  if (!profile) {
    return { profiles: [], tagMasters: [], leadSources: [], departments: fallback };
  }

  const year = getCurrentFiscalYear();
  const [profilesRes, tagsRes, sourcesRes, deptRes] = await Promise.all([
    supabase.from("profiles").select("id, display_name").order("display_name"),
    supabase
      .from("customer_tag_masters")
      .select("id, label")
      .eq("company_id", profile.company_id)
      .order("sort_order"),
    supabase
      .from("lead_sources")
      .select("id, label")
      .eq("company_id", profile.company_id)
      .order("sort_order"),
    supabase
      .from("bi_annual_settings")
      .select("department_targets:bi_department_targets(department_name, sort_order)")
      .eq("company_id", profile.company_id)
      .eq("fiscal_year", year)
      .maybeSingle(),
  ]);
  if (profilesRes.error) throw profilesRes.error;
  if (tagsRes.error) throw tagsRes.error;
  if (sourcesRes.error) throw sourcesRes.error;
  if (deptRes.error) throw deptRes.error;

  const targets = (deptRes.data?.department_targets ?? []) as {
    department_name: string;
    sort_order: number;
  }[];
  const departments = targets.length
    ? [...targets]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((d) => d.department_name)
    : fallback;

  return {
    profiles: (profilesRes.data ?? []).map((p) => ({ id: p.id, display_name: p.display_name })),
    tagMasters: (tagsRes.data ?? []).map((t) => ({ id: t.id, label: t.label })),
    leadSources: (sourcesRes.data ?? []).map((s) => ({ id: s.id, label: s.label })),
    departments,
  };
}
