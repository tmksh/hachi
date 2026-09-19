import { createClient } from "@/lib/supabase/client";
import { browserAuthContext as authContext } from "./browser-auth";
import { scopedSupabase } from "@/lib/queries/scoped";
import { canUserViewAnnouncement } from "@/lib/announcement-visibility";
import { EMPTY_TRANSFER_SENDER, PROCUREMENT_ACCOUNT_ITEMS, parseTransferSender, type InvoiceClosingDay, type TransferSender } from "@/lib/procurement";
import { PDF_FORM_TEMPLATES_KEY, resolvePdfFormTemplates } from "@/lib/pdf-form-template";
import { DEFAULT_DEPARTMENTS, buildFiscalMonthLabels, getCurrentFiscalYear } from "@/lib/bi-utils";
import { getFinancialAccountItems } from "@/lib/actions/financial-statements";
import { getWorkflowApprovalSupport } from "@/lib/actions/workflow";
import type { Company, Craftsman, FinancialStatement } from "@/lib/database.types";
import type { AccountItemHistory } from "@/lib/actions/procurement";
import type { DocCategory } from "@/lib/actions/documents";
import type { EmailAccount } from "@/lib/actions/mail";
import type { PerformanceData } from "@/lib/actions/performance";

export const LIST_STALE_MS = 120_000;
export const DETAIL_STALE_MS = 60_000;
export const MASTER_STALE_MS = 5 * 60_000;

export const QK = {
  procurementOrders: ["procurement-orders"] as const,
  procurementMasters: ["procurement-masters"] as const,
  documents: ["documents"] as const,
  documentCategories: ["document-categories"] as const,
  announcements: ["announcements"] as const,
  announcement: (id: string) => ["announcement", id] as const,
  mailAccounts: ["mail-accounts"] as const,
  mailThreads: ["mail-threads"] as const,
  mailSignature: ["mail-signature"] as const,
  attendance: (month: string) => ["attendance", month] as const,
  attendanceRange: (start: string, end: string, userId: string) => ["attendance", "range", start, end, userId] as const,
  company: ["company"] as const,
  budgets: ["budgets"] as const,
  settingsBundle: ["settings-bundle"] as const,
  invoice: (id: string) => ["invoice", id] as const,
  craftsman: (id: string) => ["craftsman", id] as const,
  craftsmenMaster: ["craftsmen-master"] as const,
  workflowRequest: (id: string) => ["workflow-request", id] as const,
  workflowRequests: ["workflow-requests"] as const,
  workflowTypes: ["workflow-types"] as const,
  pdfTemplates: ["pdf-form-templates"] as const,
  financials: ["financials"] as const,
  performance: (year: number, department?: string) =>
    ["performance", year, department ?? "__all__"] as const,
  constructionReport: (id: string) => ["construction-report", id] as const,
  mailThread: (id: string) => ["email-thread", id] as const,
  customerCustomFieldKeys: ["customer-custom-field-keys"] as const,
  financialStatement: (id: string) => ["financial-statement", id] as const,
  accountItemHistory: ["account-item-history"] as const,
};

const ORDER_SELECT = `
  *,
  craftsman:craftsmen(*),
  construction:constructions(id, title, construction_no, assigned_to, assignee:profiles!constructions_assigned_to_fkey(id, display_name))
`;
const ORDER_SELECT_FALLBACK = `*, craftsman:craftsmen(id, name, company_name, email, kind, invoice_channel), construction:constructions(id, title, construction_no, assigned_to, assignee:profiles!constructions_assigned_to_fkey(id, display_name))`;

export async function fetchProcurementOrders() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contractor_orders")
    .select(ORDER_SELECT)
    .order("created_at", { ascending: false });
  if (!error) return data ?? [];
  const { data: fallback, error: fallbackErr } = await supabase
    .from("contractor_orders")
    .select(ORDER_SELECT_FALLBACK)
    .order("created_at", { ascending: false });
  if (fallbackErr) throw fallbackErr;
  return fallback ?? [];
}

export type ProcurementMasters = {
  departments: string[];
  accountItems: string[];
  sender: TransferSender;
  closingDay: InvoiceClosingDay;
};

export async function fetchProcurementMasters(): Promise<ProcurementMasters> {
  const { supabase, profile } = await authContext();
  if (!profile) {
    return {
      departments: [] as string[],
      accountItems: PROCUREMENT_ACCOUNT_ITEMS.map((i) => i.name),
      sender: EMPTY_TRANSFER_SENDER,
      closingDay: "20" as const,
    };
  }
  const [{ data: locations }, { data: company }] = await Promise.all([
    supabase
      .from("company_locations")
      .select("name")
      .eq("company_id", profile.company_id)
      .eq("is_active", true)
      .order("sort_order"),
    supabase.from("companies").select("name, settings").eq("id", profile.company_id).maybeSingle(),
  ]);
  const settings = (company?.settings ?? {}) as Record<string, unknown>;
  const departments = (locations ?? []).map((l) => l.name);
  return {
    departments: departments.length > 0 ? departments : [...DEFAULT_DEPARTMENTS],
    accountItems: PROCUREMENT_ACCOUNT_ITEMS.map((i) => i.name),
    sender: parseTransferSender(settings, company?.name ?? ""),
    closingDay: settings.invoice_closing_day === "end_of_month" ? "end_of_month" as const : "20" as const,
  };
}

export async function fetchDocuments() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*, uploader:profiles!documents_uploaded_by_fkey(id, display_name), customer:customers(id, name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

export async function fetchDocumentCategories(): Promise<DocCategory[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("document_categories")
    .select("id, key, label, sort_order")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as DocCategory[];
}

export async function fetchAnnouncements() {
  const { supabase, user, profile } = await authContext();
  if (!user) return [];
  const { data, error } = await supabase
    .from("announcements")
    .select("*, author:profiles!announcements_author_id_fkey(id, display_name)")
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).filter((a) => canUserViewAnnouncement(a, user.id, profile?.role ?? null));
}

export async function fetchAnnouncement(id: string) {
  const { supabase, user, profile } = await authContext();
  const selectWithAuthor = "*, author:profiles!announcements_author_id_fkey(id, display_name)";
  const [announcementRes0, commentsRes, readsRes] = await Promise.all([
    supabase
      .from("announcements")
      .select(selectWithAuthor)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("announcement_comments")
      .select("*, user:profiles!announcement_comments_user_id_fkey(id, display_name)")
      .eq("announcement_id", id)
      .order("created_at"),
    supabase
      .from("announcement_reads")
      .select("user_id, read_at, user:profiles!announcement_reads_user_id_fkey(id, display_name)")
      .eq("announcement_id", id)
      .order("read_at", { ascending: false }),
  ]);
  let announcementRes = announcementRes0;
  if (announcementRes.error || !announcementRes.data) {
    const fallback = await supabase
      .from("announcements")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!fallback.error && fallback.data) announcementRes = fallback;
  }
  if (announcementRes.error) throw new Error(announcementRes.error.message);
  if (!announcementRes.data) throw new Error("お知らせが見つかりません");
  if (user && announcementRes.data && !canUserViewAnnouncement(announcementRes.data, user.id, profile?.role ?? null)) {
    throw new Error("このお知らせを閲覧する権限がありません");
  }

  let markedRead = false;
  const readerName = profile?.display_name ?? "—";
  if (user && profile) {
    const now = new Date().toISOString();
    const { error: readErr } = await supabase.from("announcement_reads").upsert({
      company_id: profile.company_id,
      announcement_id: id,
      user_id: user.id,
      read_at: now,
    }, { onConflict: "company_id,announcement_id,user_id" });
    markedRead = !readErr;
  }

  const reads = (readsRes.data ?? []).map((r) => ({
    user_id: r.user_id as string,
    read_at: r.read_at as string,
    display_name: (r.user as { display_name?: string } | null)?.display_name ?? "—",
  }));
  if (user && markedRead && !reads.some((r) => r.user_id === user.id)) {
    reads.unshift({
      user_id: user.id,
      read_at: new Date().toISOString(),
      display_name: readerName,
    });
  }

  return {
    ...announcementRes.data,
    comments: commentsRes.data || [],
    reads,
    current_user_read: markedRead || reads.some((r) => r.user_id === user?.id),
  };
}

export async function fetchMailAccounts(): Promise<EmailAccount[]> {
  const { supabase, user } = await authContext();
  if (!user) return [];
  const { data, error } = await supabase
    .from("email_accounts")
    .select("id, provider, email_address, last_sync_at, token_expires_at")
    .eq("user_id", user.id)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    display_name: null,
    forward_address: null,
  })) as EmailAccount[];
}

export async function fetchMailThreads() {
  const { supabase, user } = await authContext();
  if (!user) return [];
  const { data: accounts } = await supabase.from("email_accounts").select("id").eq("user_id", user.id);
  const accountIds = (accounts ?? []).map((row) => row.id);
  if (accountIds.length === 0) return [];
  const { data, error } = await supabase
    .from("email_threads")
    .select("*, account:email_accounts!email_threads_account_id_fkey(id, email_address, provider)")
    .in("account_id", accountIds)
    .order("last_message_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}

export async function fetchMailThread(id: string) {
  const { supabase, user } = await authContext();
  if (!user) throw new Error("スレッドが見つかりません");
  const { data: accounts } = await supabase.from("email_accounts").select("id").eq("user_id", user.id);
  const accountIds = (accounts ?? []).map((row) => row.id);
  if (accountIds.length === 0) throw new Error("スレッドが見つかりません");
  const { data: thread, error: threadError } = await supabase
    .from("email_threads")
    .select("*")
    .eq("id", id)
    .in("account_id", accountIds)
    .maybeSingle();
  if (threadError) throw threadError;
  if (!thread) throw new Error("スレッドが見つかりません");
  const { data: messages, error: messagesError } = await supabase
    .from("email_messages")
    .select("*")
    .eq("thread_id", thread.id)
    .order("received_at");
  if (messagesError) throw messagesError;
  return { ...thread, messages: messages || [] };
}

export async function fetchMailSignature() {
  const { user } = await authContext();
  if (!user) return "";
  return (user.user_metadata?.mail_signature as string) ?? "";
}

export async function fetchAttendanceEntries(month: string, userId?: string) {
  const supabase = createClient();
  let query = supabase
    .from("attendance_entries")
    .select("*, user:profiles!attendance_entries_user_id_fkey(id, display_name, department)")
    .order("work_date", { ascending: false });
  if (userId) query = query.eq("user_id", userId);
  if (month) {
    const start = `${month}-01`;
    const endDate = new Date(parseInt(month.split("-")[0], 10), parseInt(month.split("-")[1], 10), 0);
    const end = `${month}-${String(endDate.getDate()).padStart(2, "0")}`;
    query = query.gte("work_date", start).lte("work_date", end);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** 締め期間（任意の日付範囲）で勤怠を取得。userId 指定でそのユーザーのみ */
export async function fetchAttendanceEntriesRange(start: string, end: string, userId?: string) {
  const supabase = createClient();
  let query = supabase
    .from("attendance_entries")
    .select("*, user:profiles!attendance_entries_user_id_fkey(id, display_name, department)")
    .gte("work_date", start)
    .lte("work_date", end)
    .order("work_date", { ascending: true });
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function fetchCompany() {
  const { supabase, profile } = await authContext();
  if (!profile) return null;
  const { data, error } = await supabase.from("companies").select("*").eq("id", profile.company_id).single();
  if (error) throw error;
  return data as Company;
}

export async function fetchCompanySettings(): Promise<Record<string, unknown> | null> {
  const { supabase, profile } = await authContext();
  if (!profile) return null;
  const { data, error } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", profile.company_id)
    .maybeSingle();
  if (error) throw error;
  return (data?.settings as Record<string, unknown> | null) ?? null;
}

function fiscalYearRange(year: number) {
  return { start: `${year}-04-01`, end: `${year + 1}-03-31` };
}

export async function fetchBudgets() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("budgets")
    .select("*, items:budget_items(*)")
    .order("fiscal_year", { ascending: false });
  if (error) throw error;
  const budgets = data ?? [];
  if (budgets.length === 0) return [];
  const years = budgets.map((b) => b.fiscal_year as number);
  const { start: rangeStart } = fiscalYearRange(Math.min(...years));
  const { end: rangeEnd } = fiscalYearRange(Math.max(...years));
  const { data: constructions } = await supabase
    .from("constructions")
    .select("order_amount, actual_cost, budget_cost, end_date")
    .eq("status", "completed")
    .gte("end_date", rangeStart)
    .lte("end_date", rangeEnd);
  return budgets.map((budget) => {
    const { start, end } = fiscalYearRange(budget.fiscal_year as number);
    const inYear = (constructions ?? []).filter(
      (c) => c.end_date != null && c.end_date >= start && c.end_date <= end,
    );
    const actualRevenue = inYear.reduce((s, c) => s + Number(c.order_amount ?? 0), 0);
    const actualCost = inYear.reduce((s, c) => s + Number(c.actual_cost ?? 0), 0);
    const budgetCostSum = inYear.reduce((s, c) => s + Number(c.budget_cost ?? 0), 0);
    const grossProfit = actualRevenue - actualCost;
    return {
      ...budget,
      actuals: {
        revenue: actualRevenue,
        cost: actualCost,
        budget_cost: budgetCostSum,
        gross_profit: grossProfit,
        gross_rate: actualRevenue > 0 ? (grossProfit / actualRevenue) * 100 : 0,
        completed_count: inYear.length,
      },
    };
  });
}

export async function fetchInvoice(id: string) {
  const supabase = createClient();
  const [{ data, error }, { data: items }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, customer:customers(id, name, company_name, address, email), construction:constructions(id, title)")
      .eq("id", id)
      .single(),
    supabase.from("invoice_items").select("*").eq("invoice_id", id).order("sort_order"),
  ]);
  if (error) throw error;
  return { ...data, items: items || [] };
}

export async function fetchCraftsman(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase.from("craftsmen").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Craftsman;
}

export async function fetchWorkflowRequest(id: string) {
  const { supabase, companyId } = await scopedSupabase();
  const selectWithJoins =
    "*, requester:profiles!workflow_requests_requester_id_fkey(id, display_name, department), workflow_type:workflow_types!workflow_requests_type_id_fkey(id, key, name, fields_schema)";
  const [requestRes0, stepsRes, commentsRes] = await Promise.all([
    supabase
      .from("workflow_requests")
      .select(selectWithJoins)
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle(),
    supabase
      .from("workflow_steps")
      .select("*, approver:profiles!workflow_steps_approver_id_fkey(id, display_name, role)")
      .eq("request_id", id)
      .order("step_order"),
    supabase
      .from("workflow_comments")
      .select("*, user:profiles!workflow_comments_user_id_fkey(id, display_name)")
      .eq("request_id", id)
      .order("created_at"),
  ]);
  let requestRes = requestRes0;
  if (requestRes.error || !requestRes.data) {
    const fallback = await supabase
      .from("workflow_requests")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!fallback.error && fallback.data) requestRes = fallback;
  }
  if (requestRes.error) throw new Error(requestRes.error.message || "ワークフロー詳細の取得に失敗しました");
  if (!requestRes.data) throw new Error("申請が見つかりません");
  const row = requestRes.data as typeof requestRes.data & { workflow_type?: { id: string; key: string; name: string; fields_schema?: unknown } | null };
  if (!row.workflow_type && (row as { type_id?: string }).type_id) {
    const { data: wfType } = await supabase
      .from("workflow_types")
      .select("id, key, name, fields_schema")
      .eq("id", (row as { type_id: string }).type_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (wfType) row.workflow_type = wfType;
  }
  return {
    ...row,
    steps: stepsRes.data || [],
    comments: (commentsRes.data || []).map((c) => ({
      ...c,
      body: (c as { message?: string }).message ?? "",
    })),
  };
}

export async function fetchWorkflowApprovalSupport(id: string) {
  return getWorkflowApprovalSupport(id).catch(() => null);
}

export async function fetchWorkflowTypes() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workflow_types")
    .select("*")
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).filter((t) => !String((t as { key?: string }).key ?? "").startsWith("deleted:"));
}

export async function fetchPdfFormTemplates() {
  const { supabase, profile } = await authContext();
  if (!profile) return [];
  const { data } = await supabase.from("companies").select("settings").eq("id", profile.company_id).single();
  const raw = (data?.settings as Record<string, unknown> | null)?.[PDF_FORM_TEMPLATES_KEY];
  return resolvePdfFormTemplates(raw);
}

export async function fetchLatestPdfFormTemplate(id: string) {
  const list = await fetchPdfFormTemplates();
  return { list, template: list.find((t) => t.id === id) ?? null };
}

export async function fetchFinancialsBundle() {
  const supabase = createClient();
  const [items, { data: statements }, { data: settings }] = await Promise.all([
    getFinancialAccountItems().catch(() => []),
    supabase.from("financial_statements").select("*").order("fiscal_year", { ascending: false }).order("start_month", { ascending: true }),
    supabase.from("financial_report_settings").select("*").maybeSingle(),
  ]);
  return { items, statements: statements ?? [], settings: settings ?? null };
}

function fiscalYearRangeWithStart(year: number, startMonth: number) {
  const sm = String(startMonth).padStart(2, "0");
  const endMonth = startMonth === 1 ? 12 : startMonth - 1;
  const endYear = startMonth === 1 ? year : year + 1;
  const endDay = new Date(endYear, endMonth, 0).getDate();
  const em = String(endMonth).padStart(2, "0");
  return {
    start: `${year}-${sm}-01`,
    end: `${endYear}-${em}-${String(endDay).padStart(2, "0")}`,
  };
}

function fiscalMonthIndex(dateStr: string, startMonth: number): number {
  const month = Number(dateStr.slice(5, 7));
  return (month - startMonth + 12) % 12;
}

export async function fetchPerformance(year?: number, department?: string): Promise<PerformanceData | null> {
  const { supabase, profile } = await authContext();
  if (!profile) return null;
  const { data: company } = await supabase.from("companies").select("settings").eq("id", profile.company_id).single();
  const settings = (company?.settings ?? {}) as Record<string, unknown>;
  const fiscalMonthStart =
    typeof settings.fiscal_month_start === "number" && settings.fiscal_month_start >= 1 && settings.fiscal_month_start <= 12
      ? settings.fiscal_month_start
      : 4;
  const resolvedYear = year ?? getCurrentFiscalYear(fiscalMonthStart);
  const { start, end } = fiscalYearRangeWithStart(resolvedYear, fiscalMonthStart);
  const monthLabels = buildFiscalMonthLabels(fiscalMonthStart);

  const [{ data: constructions }, { data: invoices }, { data: profiles }] = await Promise.all([
    supabase
      .from("constructions")
      .select("id, status, order_amount, start_date, end_date, assigned_to")
      .in("status", ["completed", "in_progress"]),
    supabase
      .from("invoices")
      .select("id, total, status, paid_at, construction_id")
      .eq("status", "paid")
      .gte("paid_at", start)
      .lte("paid_at", end),
    supabase.from("profiles").select("id, department").eq("company_id", profile.company_id),
  ]);

  const departments = [...new Set(
    (profiles ?? []).map((p) => p.department).filter((d): d is string => !!d?.trim()),
  )].sort();
  const departmentByProfile = new Map((profiles ?? []).map((p) => [p.id, p.department]));
  const matchesDept = (assignedTo: string | null) => {
    if (!department) return true;
    if (!assignedTo) return false;
    return departmentByProfile.get(assignedTo) === department;
  };

  const actuals = Array(12).fill(0) as number[];
  const countedConstructionIds = new Set<string>();
  for (const c of constructions ?? []) {
    const date = c.end_date ?? c.start_date;
    if (!date || date < start || date > end) continue;
    if (!matchesDept(c.assigned_to)) continue;
    countedConstructionIds.add(c.id);
    actuals[fiscalMonthIndex(date, fiscalMonthStart)] += Number(c.order_amount ?? 0);
  }
  const constructionById = new Map((constructions ?? []).map((c) => [c.id, c]));
  for (const inv of invoices ?? []) {
    if (!inv.paid_at) continue;
    if (inv.construction_id && countedConstructionIds.has(inv.construction_id)) continue;
    if (department) {
      const linked = inv.construction_id ? constructionById.get(inv.construction_id) : undefined;
      if (!linked || !matchesDept(linked.assigned_to)) continue;
    }
    actuals[fiscalMonthIndex(inv.paid_at, fiscalMonthStart)] += Number(inv.total ?? 0);
  }

  const monthlyTarget = typeof settings.monthly_target === "number" && settings.monthly_target > 0 ? settings.monthly_target : null;
  const annualTarget = typeof settings.annual_target === "number" && settings.annual_target > 0 ? settings.annual_target : null;
  let monthlyPlan: number;
  let isProvisionalTarget = false;
  if (monthlyTarget != null) {
    monthlyPlan = monthlyTarget;
  } else if (annualTarget != null) {
    monthlyPlan = Math.round(annualTarget / 12);
  } else {
    const activeMonths = actuals.filter((v) => v > 0);
    const avg = activeMonths.length > 0 ? activeMonths.reduce((s, v) => s + v, 0) / activeMonths.length : 0;
    monthlyPlan = Math.round(avg * 1.1);
    isProvisionalTarget = true;
  }

  const months = monthLabels.map((month, i) => ({
    month,
    plan: monthlyPlan,
    actual: actuals[i],
    rate: monthlyPlan > 0 ? Math.round((actuals[i] / monthlyPlan) * 1000) / 10 : null,
  }));
  const annualPlan = monthlyPlan * 12;
  const totalActual = actuals.reduce((s, v) => s + v, 0);
  return {
    fiscalYear: resolvedYear,
    fiscalMonthStart,
    isProvisionalTarget,
    annualPlan,
    totalActual,
    achievementRate: annualPlan > 0 ? Math.round((totalActual / annualPlan) * 1000) / 10 : null,
    months,
    departments,
  };
}

export async function fetchConstructionReport(reportId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("construction_reports")
    .select("*, author:profiles(display_name)")
    .eq("id", reportId)
    .single();
  if (error) return null;
  return data;
}

export async function fetchDepartmentNames() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("company_locations")
    .select("name")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  const names = (data ?? []).map((r) => r.name).filter(Boolean);
  return names.length > 0 ? names : [...DEFAULT_DEPARTMENTS];
}

export async function fetchCompanyLocations() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("company_locations")
    .select("id, name, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

/** 初期表示に必要な会社・署名のみ。マスタ・外部連携・メンバーはタブを開いた時に読む。 */
export async function fetchSettingsBundle() {
  const { supabase, user, profile } = await authContext();
  let company: Company | null = null;
  if (profile?.company_id) {
    const { data, error } = await supabase.from("companies").select("*").eq("id", profile.company_id).single();
    if (error) throw error;
    company = data as Company;
  }
  return {
    initialCompany: company,
    initialSignature: (user?.user_metadata?.mail_signature as string) ?? "",
    initialMembers: undefined,
    initialCrmMaster: undefined,
    initialCraftsmenMaster: undefined,
    initialAppIntegrations: undefined,
  };
}

export async function fetchCustomerCustomFieldKeys(): Promise<string[]> {
  const { supabase, profile } = await authContext();
  if (!profile) return [];
  const { data } = await supabase
    .from("customers")
    .select("custom_fields")
    .eq("company_id", profile.company_id)
    .is("deleted_at", null)
    .limit(800);
  const keys = new Set<string>();
  for (const row of data ?? []) {
    const fields = (row.custom_fields ?? {}) as Record<string, string>;
    for (const key of Object.keys(fields)) {
      const trimmed = key.trim();
      if (trimmed) keys.add(trimmed);
    }
  }
  return [...keys].sort((a, b) => a.localeCompare(b, "ja"));
}

export async function fetchFinancialStatement(id: string): Promise<FinancialStatement | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("financial_statements")
    .select("*, lines:financial_statement_lines(*)")
    .eq("id", id)
    .maybeSingle();
  return (data ?? null) as FinancialStatement | null;
}

export async function fetchFinancialStatements(): Promise<FinancialStatement[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("financial_statements")
    .select("*")
    .order("fiscal_year", { ascending: false })
    .order("start_month", { ascending: true });
  return (data ?? []) as FinancialStatement[];
}

export async function fetchAccountItemHistory(): Promise<AccountItemHistory[]> {
  const { supabase, profile } = await authContext();
  if (!profile) return [];
  const past: AccountItemHistory[] = [];
  const [{ data: orders }, { data: budgets }] = await Promise.all([
    supabase
    .from("contractor_orders")
    .select("account_item, account_item_source, craftsman:craftsmen(name, company_name)")
    .eq("company_id", profile.company_id)
    .not("account_item", "is", null)
    .limit(400),
    supabase
    .from("construction_cost_budgets")
    .select("rows")
    .eq("company_id", profile.company_id)
    .limit(80),
  ]);
  for (const o of orders ?? []) {
    if (o.account_item_source === "ai" || o.account_item_source === "learned") continue;
    const craftsman = Array.isArray(o.craftsman) ? o.craftsman[0] : o.craftsman;
    past.push({
      vendorName: craftsman?.name ?? null,
      companyName: craftsman?.company_name ?? null,
      accountItem: o.account_item,
      accountItemSource: o.account_item_source,
    });
  }
  for (const budget of budgets ?? []) {
    const rows = Array.isArray(budget.rows) ? budget.rows : [];
    for (const raw of rows) {
      const row = raw as { name?: string; account_item?: string; account_item_source?: string };
      if (!row.account_item?.trim() || !row.name?.trim()) continue;
      if (row.account_item_source === "ai" || row.account_item_source === "learned") continue;
      past.push({
        vendorName: row.name.trim(),
        companyName: null,
        accountItem: row.account_item.trim(),
        accountItemSource: row.account_item_source || "budget",
      });
    }
  }
  return past;
}
