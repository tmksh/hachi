"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { format, subMonths, startOfMonth, subDays } from "date-fns";
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

type DealRow = {
  id: string;
  title: string;
  stage: string;
  value: number | null;
  updated_at: string;
  created_at: string;
  customer: { id?: string; name?: string } | null;
};

function buildMonthlyTrend(deals: DealRow[]) {
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const monthDate = startOfMonth(subMonths(now, 6 - i));
    const key = format(monthDate, "yyyy-MM");
    const label = format(monthDate, "M月", { locale: ja });

    let won = 0;
    let pipeline = 0;
    for (const deal of deals) {
      const updatedKey = deal.updated_at.slice(0, 7);
      const createdKey = deal.created_at.slice(0, 7);
      if (deal.stage === "won" && updatedKey === key) {
        won += deal.value ?? 0;
      }
      if (!["won", "lost"].includes(deal.stage) && createdKey === key) {
        pipeline += deal.value ?? 0;
      }
    }

    return {
      month: label,
      受注額: Math.round(won / 10_000),
      パイプライン: Math.round(pipeline / 10_000),
    };
  });
}

/** 担当者アサイン済みで一定日数以上フォローアップなしの顧客リストを取得 */
export async function getUnfollowedLeads(days = 7) {
  const supabase = await createClient();
  const threshold = subDays(new Date(), days).toISOString();

  const { data: customers } = await supabase
    .from("customers")
    .select(`
      id, name, company_name, assigned_to, status, inquiry_date, created_at,
      assigned_to_profile:profiles!customers_assigned_to_fkey(id, display_name),
      deals(id, updated_at, stage)
    `)
    .is("deleted_at", null)
    .not("assigned_to", "is", null);

  if (!customers) return [];

  return customers
    .filter((c) => {
      const deals = (c.deals as Array<{ id: string; updated_at: string; stage: string }> | null) ?? [];
      const activeDeals = deals.filter((d) => !["won", "lost"].includes(d.stage));
      if (activeDeals.length === 0) return true;
      const lastUpdated = activeDeals.reduce((latest, d) => {
        const t = d.updated_at;
        return t > latest ? t : latest;
      }, activeDeals[0].updated_at);
      return lastUpdated < threshold;
    })
    .map((c) => {
      const deals = (c.deals as Array<{ id: string; updated_at: string; stage: string }> | null) ?? [];
      const activeDeals = deals.filter((d) => !["won", "lost"].includes(d.stage));
      const lastUpdated = activeDeals.length > 0
        ? activeDeals.reduce((l, d) => (d.updated_at > l ? d.updated_at : l), activeDeals[0].updated_at)
        : null;
      return {
        id: c.id,
        name: c.name,
        company_name: c.company_name,
        assigned_to: c.assigned_to,
        assigned_to_profile: (c.assigned_to_profile as unknown) as { id: string; display_name: string } | null,
        status: c.status,
        last_deal_updated: lastUpdated,
        days_since_update: lastUpdated
          ? Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 86_400_000)
          : null,
      };
    });
}

export async function getDashboardData() {
  const supabase = await createClient();
  const user = await getAuthUser();

  const [
    { count: customerCount },
    { data: allDeals, count: dealCount },
    { data: constructions },
    { data: recentCustomers },
    { data: recentEstimates },
    { data: contracts },
    { data: invoices },
    { data: announcements },
    { data: todos },
    { data: calendarEvents },
    { count: pendingApprovals },
    { count: submittedRequests },
    { count: completedRequests },
  ] = await Promise.all([
    supabase.from("customers").select("*", { count: "exact", head: true }).is("deleted_at", null),
    supabase
      .from("deals")
      .select("id, title, stage, value, updated_at, created_at, customer:customers(id, name)", { count: "exact" }),
    supabase
      .from("constructions")
      .select("id, title, status, progress, end_date, assigned_to, customer_id, customer:customers(id, name), assignee:profiles!constructions_assigned_to_fkey(display_name)")
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
      .from("estimates")
      .select("id, estimate_no, title, status, total, created_at")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase.from("contracts").select("status"),
    supabase.from("invoices").select("status, total"),
    supabase
      .from("announcements")
      .select("id, title, body, pinned, is_urgent, published_at, author:profiles!announcements_author_id_fkey(display_name)")
      .order("published_at", { ascending: false })
      .limit(15),
    supabase
      .from("todos")
      .select("id, title, status, priority, due_date, assigned_to")
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
      ? supabase.from("workflow_steps").select("*", { count: "exact", head: true }).eq("approver_id", user.id).eq("status", "pending")
      : Promise.resolve({ count: 0, data: null, error: null }),
    user
      ? supabase.from("workflow_requests").select("*", { count: "exact", head: true }).eq("requester_id", user.id).eq("status", "submitted")
      : Promise.resolve({ count: 0, data: null, error: null }),
    user
      ? supabase.from("workflow_requests").select("*", { count: "exact", head: true }).eq("requester_id", user.id).in("status", ["approved", "rejected"])
      : Promise.resolve({ count: 0, data: null, error: null }),
  ]);

  const deals = (allDeals ?? []) as DealRow[];

  const pipelineValue = deals
    .filter((d) => !["won", "lost"].includes(d.stage))
    .reduce((sum, d) => sum + (d.value || 0), 0);

  const wonValue = deals
    .filter((d) => d.stage === "won")
    .reduce((sum, d) => sum + (d.value || 0), 0);

  const activeConstructions = (constructions || []).length;
  const contractList = contracts ?? [];
  const invoiceList = invoices ?? [];

  return {
    kpis: {
      customerCount: customerCount || 0,
      dealCount: dealCount || 0,
      pipelineValue,
      wonValue,
      activeConstructions,
    },
    monthlyTrend: buildMonthlyTrend(deals),
    constructions: constructions || [],
    recentCustomers: recentCustomers || [],
    recentDeals: deals
      .filter((d) => !["won", "lost"].includes(d.stage))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 5)
      .map((d) => {
        const customer = d.customer;
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
      contractCount: contractList.length,
      activeContracts: contractList.filter((c) => c.status === "executing" || c.status === "contracted").length,
      invoiceDraft: invoiceList.filter((i) => i.status === "draft").length,
      invoiceSent: invoiceList.filter((i) => i.status === "sent").length,
      invoiceUnpaidTotal: invoiceList
        .filter((i) => i.status === "sent")
        .reduce((sum, i) => sum + (i.total ?? 0), 0),
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
