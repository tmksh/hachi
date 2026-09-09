import { createClient } from "@/lib/supabase/client";
import type { Estimate, EstimateCategory, EstimateItem } from "@/lib/database.types";

const AUTHOR_NOTE_PREFIX = "作成者:";

type AssigneeShape = { id?: string; display_name?: string | null } | null;

function pickAssignee(assignee: AssigneeShape | AssigneeShape[] | null | undefined) {
  if (Array.isArray(assignee)) return assignee[0] ?? null;
  return assignee ?? null;
}

function resolveEstimateAuthor(est: {
  created_by_name?: string | null;
  notes?: string | null;
  assignee?: AssigneeShape | AssigneeShape[];
}): string | null {
  if (est.created_by_name?.trim()) return est.created_by_name.trim();
  const match = est.notes?.match(new RegExp(`^${AUTHOR_NOTE_PREFIX}\\s*(.+?)(?:\\n|$)`));
  if (match?.[1]) return match[1].trim();
  return pickAssignee(est.assignee)?.display_name ?? null;
}

export async function fetchEstimate(id: string) {
  const supabase = createClient();
  const [{ data, error }, { data: categories }, { data: items }] = await Promise.all([
    supabase
      .from("estimates")
      .select("*, customer:customers(id, name, company_name, customer_type, notes)")
      .eq("id", id)
      .single(),
    supabase.from("estimate_categories").select("*").eq("estimate_id", id).order("sort_order"),
    supabase.from("estimate_items").select("*").eq("estimate_id", id).order("sort_order"),
  ]);
  if (error) throw error;
  return { ...data, categories: categories || [], items: items || [] } as Estimate & {
    categories: EstimateCategory[];
    items: EstimateItem[];
    customer?: {
      id: string;
      name: string;
      company_name: string | null;
      customer_type?: string | null;
      notes?: string | null;
    } | null;
  };
}

export async function fetchContract(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contracts")
    .select("*, customer:customers(*), estimate:estimates(id, estimate_no, title, total)")
    .eq("id", id)
    .single();
  if (error) throw error;

  const { data: linked } = await supabase
    .from("constructions")
    .select("id, title, construction_no, start_date, end_date, order_amount")
    .eq("contract_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let start = data.start_date ?? linked?.start_date ?? null;
  let end = data.end_date ?? linked?.end_date ?? null;
  if (linked?.id && (!start || !end)) {
    const { data: tasks } = await supabase
      .from("construction_tasks")
      .select("start_date, end_date")
      .eq("construction_id", linked.id);
    const starts = (tasks ?? []).map((t) => t.start_date).filter(Boolean).sort();
    const ends = (tasks ?? []).map((t) => t.end_date).filter(Boolean).sort();
    start = start || starts[0] || null;
    end = end || ends[ends.length - 1] || null;
  }

  let customerAssigneeName: string | null = null;
  const assignedTo = (data.customer as { assigned_to?: string | null } | null)?.assigned_to;
  if (assignedTo) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", assignedTo)
      .maybeSingle();
    customerAssigneeName = profile?.display_name ?? null;
  }

  return {
    ...data,
    linked_construction: linked,
    start_date: start,
    end_date: end,
    customer_assignee_name: customerAssigneeName,
  };
}

export async function fetchConstruction(id: string) {
  const supabase = createClient();
  const [
    { data, error },
    { data: tasks },
    { data: orders },
    { data: linkedEstimates },
    { data: invoices },
  ] = await Promise.all([
    supabase
      .from("constructions")
      .select("*, customer:customers(*), contract:contracts(id, contract_no, title, amount, contract_date, start_date, end_date, notes, status, estimate_id), assignee:profiles!constructions_assigned_to_fkey(id, display_name)")
      .eq("id", id)
      .single(),
    supabase.from("construction_tasks").select("*").eq("construction_id", id).order("sort_order"),
    supabase
      .from("contractor_orders")
      .select("*, craftsman:craftsmen(id, name, company_name)")
      .eq("construction_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("estimates")
      .select("id, estimate_no, title, version, status, total, subtotal, gross_profit_rate, created_at, updated_at, notes, assignee:profiles!estimates_assigned_to_fkey(id, display_name)")
      .eq("construction_id", id)
      .order("version", { ascending: false }),
    supabase
      .from("invoices")
      .select("id, invoice_no, invoice_date, due_date, total, status, created_at")
      .eq("construction_id", id)
      .order("invoice_date", { ascending: false }),
  ]);
  if (error) throw error;

  let estimates: Array<{
    id: string;
    estimate_no: string;
    title: string | null;
    version: number;
    status: string;
    total: number;
    subtotal: number;
    gross_profit_rate: number;
    created_at: string;
    updated_at: string;
    created_by_name: string | null;
    assignee: { id: string; display_name: string | null } | null;
  }> = [];

  if (linkedEstimates?.length) {
    estimates = linkedEstimates.map((est) => {
      const assignee = Array.isArray(est.assignee) ? est.assignee[0] ?? null : est.assignee ?? null;
      const normalized = { ...est, assignee };
      return {
        ...normalized,
        created_by_name: resolveEstimateAuthor(normalized),
      };
    }) as unknown as typeof estimates;
  }

  if (data.contract_id) {
    type ContractRel = { estimate_id?: string | null } | Array<{ estimate_id?: string | null }> | null | undefined;
    const contractRel = (data as { contract?: ContractRel }).contract;
    const contractEstimateId = Array.isArray(contractRel)
      ? contractRel[0]?.estimate_id
      : contractRel?.estimate_id;
    if (contractEstimateId && !estimates.some((e) => e.id === contractEstimateId)) {
      const { data: est } = await supabase
        .from("estimates")
        .select("id, estimate_no, title, version, status, total, subtotal, gross_profit_rate, created_at, updated_at, notes")
        .eq("id", contractEstimateId)
        .maybeSingle();
      if (est) {
        estimates = [
          {
            id: est.id,
            estimate_no: est.estimate_no,
            title: est.title,
            version: est.version ?? 1,
            status: est.status,
            total: est.total,
            subtotal: est.subtotal,
            gross_profit_rate: est.gross_profit_rate,
            created_at: est.created_at,
            updated_at: est.updated_at ?? est.created_at,
            created_by_name: resolveEstimateAuthor(est),
            assignee: null,
          },
          ...estimates,
        ];
      }
    }
  }

  return {
    ...data,
    tasks: tasks || [],
    orders: orders || [],
    estimate: estimates[0] ? { id: estimates[0].id } : null,
    estimates: estimates || [],
    invoices: invoices || [],
  };
}

export async function fetchChangeOrders(constructionId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("change_orders")
    .select("*, creator:profiles!change_orders_created_by_fkey(id, display_name)")
    .eq("construction_id", constructionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchInvoicesForConstruction(constructionId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_no, invoice_date, due_date, total, status, created_at")
    .eq("construction_id", constructionId)
    .order("invoice_date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

const DOC_PREFIX = "@@HACHI_DOC@@";

type ContractDocMeta = {
  construction_id: string;
  template_id: string;
  form: Record<string, string | number>;
};

function unpackContractDocMeta(notes: string | null): ContractDocMeta | null {
  if (!notes || !notes.startsWith(DOC_PREFIX)) return null;
  try {
    return JSON.parse(notes.slice(DOC_PREFIX.length)) as ContractDocMeta;
  } catch {
    return null;
  }
}

export async function fetchConstructionContractDocs(constructionId: string) {
  const supabase = createClient();
  const { data: con } = await supabase
    .from("constructions")
    .select("id, customer_id, contract_id")
    .eq("id", constructionId)
    .single();
  if (!con) return [];

  const filters: string[] = [];
  if (con.customer_id) filters.push(`customer_id.eq.${con.customer_id}`);
  if (con.contract_id) filters.push(`id.eq.${con.contract_id}`);

  let q = supabase.from("contracts").select("*").order("created_at", { ascending: false });
  if (filters.length > 0) q = q.or(filters.join(","));
  const { data, error } = await q;
  if (error) throw error;

  return (data || [])
    .filter((c) => {
      const meta = unpackContractDocMeta(c.notes);
      if (meta) return meta.construction_id === constructionId;
      return c.id === con.contract_id;
    })
    .map((c) => {
      const meta = unpackContractDocMeta(c.notes);
      return {
        id: c.id,
        contract_no: c.contract_no,
        title: c.title,
        status: c.status,
        amount: c.amount,
        contract_date: c.contract_date,
        template_id: meta?.template_id ?? null,
        form: meta?.form ?? null,
        created_at: c.created_at,
        updated_at: c.updated_at,
      };
    });
}

export async function fetchCostBudget(constructionId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("construction_cost_budgets")
    .select("*")
    .eq("construction_id", constructionId)
    .maybeSingle();
  if (error) throw error;
  return data as {
    id: string;
    contract_amount: number;
    period_start: string;
    rows: unknown[];
    comments: unknown[];
  } | null;
}

const CONTRACT_ESTIMATE_SELECT =
  "id, estimate_no, title, status, total, subtotal, gross_profit_rate, version, construction_id, created_at, updated_at, notes, assignee:profiles!estimates_assigned_to_fkey(id, display_name)";

export async function fetchContractEstimates(contractId: string) {
  const supabase = createClient();
  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select("customer_id, estimate_id")
    .eq("id", contractId)
    .single();
  if (contractError) throw contractError;
  if (!contract?.customer_id) return [];

  const { data, error } = await supabase
    .from("estimates")
    .select(CONTRACT_ESTIMATE_SELECT)
    .eq("customer_id", contract.customer_id)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []).map((row) => ({
    ...row,
    created_by_name: resolveEstimateAuthor(row),
  }));

  if (contract.estimate_id && !rows.some((r) => r.id === contract.estimate_id)) {
    const { data: linked } = await supabase
      .from("estimates")
      .select(CONTRACT_ESTIMATE_SELECT)
      .eq("id", contract.estimate_id)
      .maybeSingle();
    if (linked) {
      rows.unshift({ ...linked, created_by_name: resolveEstimateAuthor(linked) });
    }
  }

  return rows;
}

export async function fetchContractCommunications(contractId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contract_communications")
    .select("*")
    .eq("contract_id", contractId)
    .order("sent_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchContractPostSignInfo(contractId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contract_post_sign_info")
    .select("*")
    .eq("contract_id", contractId)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}
