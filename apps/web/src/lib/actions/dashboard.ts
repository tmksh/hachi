"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { format, startOfMonth, subMonths } from "date-fns";
import { ja } from "date-fns/locale";

const DEAL_STAGE_LABELS: Record<string, string> = {
  lead: "リード",
  inquiry: "問い合わせ",
  first_meeting: "初回面談",
  materials_sent: "資料送付",
  quote_submitted: "見積提出",
  negotiation: "交渉中",
  closing: "クロージング",
  won: "受注",
  lost: "失注",
};

const ESTIMATE_STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  submitted: "提出済",
  approved: "承認",
  rejected: "却下",
  expired: "失効",
};

type AggregatesRpc = {
  customer_count: number;
  deal_count: number;
  pipeline_value: number;
  won_value: number;
  production_summary: {
    contract_count: number;
    active_contracts: number;
    invoice_draft: number;
    invoice_sent: number;
    invoice_unpaid_total: number;
  };
  monthly_trend: Array<{
    month_key: string;
    won_value: number;
    pipeline_value: number;
  }>;
};

function formatMonthlyTrend(rows: AggregatesRpc["monthly_trend"]) {
  const now = new Date();
  const monthKeys = Array.from({ length: 7 }, (_, i) =>
    format(startOfMonth(subMonths(now, 6 - i)), "yyyy-MM"),
  );
  const byKey = new Map(rows.map((r) => [r.month_key, r]));
  return monthKeys.map((key) => {
    const row = byKey.get(key);
    const monthDate = new Date(`${key}-01T00:00:00`);
    return {
      month: format(monthDate, "M月", { locale: ja }),
      受注額: Math.round(Number(row?.won_value ?? 0) / 10_000),
      パイプライン: Math.round(Number(row?.pipeline_value ?? 0) / 10_000),
    };
  });
}

type UnfollowedRpcRow = {
  id: string;
  name: string;
  company_name: string | null;
  assigned_to: string | null;
  status: string;
  assigned_to_profile_id: string | null;
  assigned_to_display_name: string | null;
  last_deal_updated: string | null;
};

/** 担当者アサイン済みで一定日数以上フォローアップなしの顧客リストを取得 */
export async function getUnfollowedLeads(days = 7) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_unfollowed_customers", {
    p_days: days,
    p_page: 1,
    p_limit: 100,
  });
  if (error) throw error;

  return ((data ?? []) as UnfollowedRpcRow[]).map((c) => ({
    id: c.id,
    name: c.name,
    company_name: c.company_name,
    assigned_to: c.assigned_to,
    assigned_to_profile: c.assigned_to_profile_id
      ? { id: c.assigned_to_profile_id, display_name: c.assigned_to_display_name ?? "" }
      : null,
    status: c.status,
    last_deal_updated: c.last_deal_updated,
    days_since_update: c.last_deal_updated
      ? Math.floor((Date.now() - new Date(c.last_deal_updated).getTime()) / 86_400_000)
      : null,
  }));
}

export async function getDashboardData() {
  const supabase = await createClient();
  const user = await getAuthUser();

  const [
    { data: aggregates, error: aggError },
    { data: constructions },
    { data: recentCustomers },
    { data: recentDeals },
    { data: recentEstimates },
    { data: announcements },
    { data: todos },
    { data: calendarEvents },
    { count: pendingApprovals },
    { count: submittedRequests },
    { count: completedRequests },
  ] = await Promise.all([
    supabase.rpc("get_dashboard_aggregates"),
    supabase
      .from("constructions")
      .select(
        "id, title, status, progress, end_date, assigned_to, customer_id, customer:customers(id, name), assignee:profiles!constructions_assigned_to_fkey(display_name)",
      )
      .in("status", ["in_progress", "preparing"])
      .order("end_date")
      .limit(5),
    supabase
      .from("customers")
      .select("id, name, company_name, status, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("deals")
      .select("id, title, stage, value, updated_at, customer:customers(id, name)")
      .not("stage", "in", '("won","lost")')
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("estimates")
      .select("id, estimate_no, title, status, total, created_at")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("announcements")
      .select(
        "id, title, body, pinned, is_urgent, published_at, author:profiles!announcements_author_id_fkey(display_name)",
      )
      .order("published_at", { ascending: false })
      .limit(15),
    supabase
      .from("todos")
      .select("id, title, status, priority, due_date, assigned_to, tags")
      .in("status", ["pending", "in_progress"])
      .order("due_date")
      .limit(10),
    supabase
      .from("calendar_events")
      .select("id, title, start_at, end_at, category, color")
      .gte("start_at", new Date().toISOString())
      .order("start_at")
      .limit(5),
    user
      ? supabase
          .from("workflow_steps")
          .select("*", { count: "exact", head: true })
          .eq("approver_id", user.id)
          .eq("status", "pending")
      : Promise.resolve({ count: 0, data: null, error: null }),
    user
      ? supabase
          .from("workflow_requests")
          .select("*", { count: "exact", head: true })
          .eq("requester_id", user.id)
          .eq("status", "submitted")
      : Promise.resolve({ count: 0, data: null, error: null }),
    user
      ? supabase
          .from("workflow_requests")
          .select("*", { count: "exact", head: true })
          .eq("requester_id", user.id)
          .in("status", ["approved", "rejected"])
      : Promise.resolve({ count: 0, data: null, error: null }),
  ]);

  if (aggError) throw aggError;
  const agg = aggregates as AggregatesRpc;

  return {
    kpis: {
      customerCount: agg.customer_count || 0,
      dealCount: agg.deal_count || 0,
      pipelineValue: Number(agg.pipeline_value) || 0,
      wonValue: Number(agg.won_value) || 0,
      activeConstructions: (constructions || []).length,
    },
    monthlyTrend: formatMonthlyTrend(agg.monthly_trend ?? []),
    constructions: constructions || [],
    recentCustomers: recentCustomers || [],
    recentDeals: (recentDeals ?? []).map((d) => {
      const customer = d.customer as { id?: string; name?: string } | null;
      return {
        id: d.id,
        title: d.title,
        stage: d.stage,
        stageLabel: DEAL_STAGE_LABELS[d.stage] ?? d.stage,
        value: d.value,
        customerId: customer?.id ?? null,
        customerName: customer?.name ?? "—",
      };
    }),
    recentEstimates: (recentEstimates ?? []).map((e) => ({
      id: e.id,
      estimateNo: e.estimate_no,
      title: e.title,
      status: e.status,
      statusLabel: ESTIMATE_STATUS_LABELS[e.status] ?? e.status,
      total: e.total,
    })),
    productionSummary: {
      contractCount: agg.production_summary?.contract_count ?? 0,
      activeContracts: agg.production_summary?.active_contracts ?? 0,
      invoiceDraft: agg.production_summary?.invoice_draft ?? 0,
      invoiceSent: agg.production_summary?.invoice_sent ?? 0,
      invoiceUnpaidTotal: Number(agg.production_summary?.invoice_unpaid_total) || 0,
    },
    announcements: announcements || [],
    todos: todos || [],
    calendarEvents: calendarEvents || [],
    workflow: {
      pendingApprovals: pendingApprovals || 0,
      submittedRequests: submittedRequests || 0,
      completedRequests: completedRequests || 0,
    },
  };
}
