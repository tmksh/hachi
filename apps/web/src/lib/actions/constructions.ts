"use server";

import { createClient } from "@/lib/supabase/server";
import { dispatchWebhook } from "@/lib/webhooks";
import { buildPaymentSchedule } from "@/lib/construction/payment-schedule";
import type { Construction, ConstructionTask, ContractorOrder, EstimateCategory, EstimateItem } from "@/lib/database.types";
import { CACHE_TTL, cachedByCompany, invalidateMyCompanyCache } from "@/lib/supabase/auth-context";
import { computeScheduleProgress } from "@/lib/construction/schedule-progress";
import { allocateUniqueEstimateNo } from "@/lib/next-estimate-no";

const AUTHOR_NOTE_PREFIX = "作成者:";

type AssigneeShape = { display_name?: string | null } | null | undefined;

function pickAssignee(assignee: AssigneeShape | AssigneeShape[]): AssigneeShape {
  if (Array.isArray(assignee)) return assignee[0] ?? null;
  return assignee;
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

function buildAuthorNotes(createdByName?: string, existingNotes?: string | null): string | null {
  const name = createdByName?.trim();
  if (!name) return existingNotes ?? null;
  const authorLine = `${AUTHOR_NOTE_PREFIX} ${name}`;
  const stripped = existingNotes?.replace(new RegExp(`^${AUTHOR_NOTE_PREFIX}\\s*.+?\\n?`), "").trim();
  if (!stripped) return authorLine;
  return `${authorLine}\n${stripped}`;
}

function throwIfSupabaseError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function getConstructions() {
  return cachedByCompany("constructions", CACHE_TTL.list, loadConstructions);
}

async function loadConstructions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("constructions")
    .select(
      "id, company_id, construction_no, title, status, customer_id, contract_id, estimate_id, assigned_to, department_name, location_id, order_amount, order_cost, budget_cost, actual_cost, payment_date, payment_amount, worker_count, progress, start_date, end_date, created_at, updated_at, customer:customers(id, name, company_name), assignee:profiles!constructions_assigned_to_fkey(id, display_name)",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as Array<{
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
  }>;
}

/** 工事に紐づく見積を顧客横断で取得（工事管理の見積一覧用） */
export async function getAllConstructionEstimates() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("estimates")
    .select(
      "id, estimate_no, title, version, status, total, subtotal, gross_profit_rate, created_at, updated_at, notes, construction_id, customer:customers(id, name), construction:constructions(id, title, construction_no), assignee:profiles!estimates_assigned_to_fkey(id, display_name)",
    )
    .not("construction_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw error;

  type Rel<T> = T | T[] | null | undefined;
  const pickOne = <T>(rel: Rel<T>): T | null => {
    if (Array.isArray(rel)) return rel[0] ?? null;
    return rel ?? null;
  };

  return (data ?? []).map((est) => {
    const customer = pickOne(est.customer as Rel<{ id: string; name: string }>);
    const construction = pickOne(
      est.construction as Rel<{ id: string; title: string; construction_no?: string }>,
    );
    const assignee = pickOne(
      est.assignee as Rel<{ id: string; display_name: string | null }>,
    );
    const normalized = { ...est, customer, construction, assignee };
    return {
      ...normalized,
      created_by_name: resolveEstimateAuthor(normalized),
    };
  });
}

export async function getConstruction(id: string) {
  const supabase = await createClient();

  // 本体・タスク・発注・見積一覧・請求は互いに独立しているため並列取得する
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
    supabase
      .from("construction_tasks")
      .select("*")
      .eq("construction_id", id)
      .order("sort_order"),
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

  // 契約に紐づく見積もり + 工事に直接紐づく見積もり一覧
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
  const contractData = data as typeof data & { estimate_id?: string | null };

  if (linkedEstimates?.length) {
    estimates = linkedEstimates.map((est) => {
      const assignee = Array.isArray(est.assignee)
        ? est.assignee[0] ?? null
        : est.assignee ?? null;
      const normalized = { ...est, assignee };
      return {
        ...normalized,
        created_by_name: resolveEstimateAuthor(normalized),
      };
    }) as unknown as typeof estimates;
  }

  if (contractData.contract_id) {
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

  // 明細（categories/items）は見積タブ選択時に getConstructionEstimate で取る
  return {
    ...data,
    tasks: tasks || [],
    orders: orders || [],
    estimate: estimates[0] ? { id: estimates[0].id } : null,
    estimates: estimates || [],
    invoices: invoices || [],
  };
}

export async function createConstruction(input: {
  title: string;
  contract_id?: string;
  customer_id?: string;
  deal_id?: string;
  estimate_id?: string;
  start_date?: string;
  end_date?: string;
  order_amount?: number;
  budget_cost?: number;
  assigned_to?: string;
  department_name?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { count } = await supabase.from("constructions").select("*", { count: "exact", head: true });
  const constructionNo = `CST-${String((count || 0) + 1).padStart(4, "0")}`;

  const { data, error } = await supabase
    .from("constructions")
    .insert({
      company_id: profile.company_id,
      construction_no: constructionNo,
      title: input.title,
      contract_id: input.contract_id || null,
      customer_id: input.customer_id || null,
      deal_id: input.deal_id || null,
      estimate_id: input.estimate_id || null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      order_amount: input.order_amount || 0,
      budget_cost: input.budget_cost || 0,
      assigned_to: input.assigned_to || null,
      department_name: input.department_name || null,
      status: "preparing",
    })
    .select()
    .single();
  if (error) throw error;

  void dispatchWebhook(profile.company_id, "construction.created", {
    id: data.id,
    construction_no: data.construction_no,
    title: data.title,
    status: data.status,
    order_amount: data.order_amount,
    deal_id: input.deal_id,
  });

  await invalidateMyCompanyCache();

  if (input.assigned_to) {
    try {
      await notifyConstructionAssignee(supabase, {
        companyId: profile.company_id,
        fromUserId: user.id,
        assigneeId: input.assigned_to,
        constructionId: data.id,
        constructionNo: data.construction_no,
        title: data.title,
        customerId: input.customer_id ?? (data as { customer_id?: string | null }).customer_id,
        dealId: input.deal_id ?? (data as { deal_id?: string | null }).deal_id,
      });
    } catch (e) {
      // 工事登録は成功扱い。通知失敗はログに残し呼び出し側で検知可能にする
      console.error("[createConstruction] assignee notify failed", e);
      throw new Error(
        "工事は登録されましたが、現場担当への通知（バナー・お知らせ・ToDo）に失敗しました。担当者へ直接連絡するか、担当者を再設定してください。",
      );
    }
  }

  await invalidateMyCompanyCache();
  return data as Construction;
}

/** 現場担当アサインの3経路通知（バナー / お知らせ / ToDoフラグ）— No.18 */
async function notifyConstructionAssignee(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    companyId: string;
    fromUserId: string;
    assigneeId: string;
    constructionId: string;
    constructionNo: string;
    title: string;
    customerId?: string | null;
    dealId?: string | null;
  },
) {
  const { notifySalesFlowUser } = await import("@/lib/actions/sales-flow");
  await notifySalesFlowUser(supabase, input.companyId, input.assigneeId, {
    title: `現場担当アサイン: ${input.title}`,
    description: `工事 ${input.constructionNo} の現場担当に割り当てられました。内容を確認してください。`,
    href: `/constructions/${input.constructionId}`,
    customerId: input.customerId ?? undefined,
    dealId: input.dealId ?? undefined,
    urgent: true,
    extraTags: ["construction", "construction_assign"],
  }, input.fromUserId);
}

export async function updateConstruction(id: string, input: Partial<Omit<Construction, "id" | "company_id" | "construction_no" | "created_at" | "updated_at">>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: before } = await supabase
    .from("constructions")
    .select("status, company_id, title, construction_no, order_amount, assigned_to, customer_id, deal_id")
    .eq("id", id)
    .single();
  const { data, error } = await supabase.from("constructions").update(input).eq("id", id).select().single();
  if (error) throw error;

  if (before && input.status && before.status !== input.status) {
    if (input.status === "in_progress") {
      void dispatchWebhook(data.company_id, "construction.started", {
        id: data.id,
        construction_no: data.construction_no,
        title: data.title,
        status: data.status,
      });
    }
    if (input.status === "completed") {
      void dispatchWebhook(data.company_id, "construction.completed", {
        id: data.id,
        construction_no: data.construction_no,
        title: data.title,
        order_amount: data.order_amount,
      });
    }
  }

  // 担当者変更時もアサイン通知（登録後の付け替えで未着信になるケースを防ぐ）
  const nextAssignee = input.assigned_to;
  if (
    user
    && typeof nextAssignee === "string"
    && nextAssignee
    && nextAssignee !== before?.assigned_to
  ) {
    try {
      await notifyConstructionAssignee(supabase, {
        companyId: data.company_id,
        fromUserId: user.id,
        assigneeId: nextAssignee,
        constructionId: data.id,
        constructionNo: data.construction_no,
        title: data.title,
        customerId: data.customer_id,
        dealId: (data as { deal_id?: string | null }).deal_id,
      });
    } catch (e) {
      console.error("[updateConstruction] assignee notify failed", e);
      throw new Error(
        "担当者は更新されましたが、通知（バナー・お知らせ・ToDo）に失敗しました。",
      );
    }
  }

  return data as Construction;
}

export async function deleteConstruction(id: string) {
  const supabase = await createClient();

  // 請求書（明細含む）
  const { data: invoices } = await supabase.from("invoices").select("id").eq("construction_id", id);
  const invIds = (invoices ?? []).map((i) => i.id);
  if (invIds.length > 0) {
    await supabase.from("invoice_items").delete().in("invoice_id", invIds);
    await supabase.from("invoices").delete().in("id", invIds);
  }

  await supabase.from("construction_cost_budgets").delete().eq("construction_id", id);
  await supabase.from("change_orders").delete().eq("construction_id", id);
  await supabase.from("construction_tasks").delete().eq("construction_id", id);
  await supabase.from("contractor_orders").delete().eq("construction_id", id);
  await supabase.from("documents").delete().eq("construction_id", id);

  const { error } = await supabase.from("constructions").delete().eq("id", id);
  if (error) throw error;
  await invalidateMyCompanyCache();
}

async function syncConstructionScheduleProgress(
  supabase: Awaited<ReturnType<typeof createClient>>,
  constructionId: string,
): Promise<number> {
  const { data: tasks, error } = await supabase
    .from("construction_tasks")
    .select("progress, status")
    .eq("construction_id", constructionId);
  if (error) throw error;
  const progress = computeScheduleProgress(tasks ?? []);
  const { error: updateError } = await supabase
    .from("constructions")
    .update({ progress })
    .eq("id", constructionId);
  if (updateError) throw updateError;
  await invalidateMyCompanyCache();
  return progress;
}

export async function createConstructionTask(constructionId: string, input: { name: string; start_date?: string; end_date?: string; assigned_to?: string; description?: string; contractor_name?: string; depends_on_task_id?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const insertData: Record<string, unknown> = {
    company_id: profile.company_id,
    construction_id: constructionId,
    name: input.name,
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    assigned_to: input.assigned_to || null,
    description: input.description || null,
  };
  if (input.contractor_name !== undefined) insertData.contractor_name = input.contractor_name;
  if (input.depends_on_task_id !== undefined) insertData.depends_on_task_id = input.depends_on_task_id;

  const { data, error } = await supabase
    .from("construction_tasks")
    .insert(insertData)
    .select()
    .single();
  if (error) throw error;
  await syncConstructionScheduleProgress(supabase, constructionId);
  return data as ConstructionTask;
}

export async function updateConstructionTask(id: string, input: Partial<Pick<ConstructionTask, "name" | "start_date" | "end_date" | "progress" | "status" | "assigned_to" | "sort_order" | "contractor_name" | "depends_on_task_id">>) {
  const supabase = await createClient();
  const patch = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as Record<string, unknown>;
  if (patch.status === "completed" && patch.progress === undefined) patch.progress = 100;
  if (typeof patch.progress === "number" && patch.progress >= 100 && patch.status === undefined) {
    patch.status = "completed";
  }
  const { data: row, error } = await supabase
    .from("construction_tasks")
    .update(patch)
    .eq("id", id)
    .select("construction_id")
    .single();
  if (error) throw error;
  if (row?.construction_id && (patch.progress !== undefined || patch.status !== undefined)) {
    await syncConstructionScheduleProgress(supabase, row.construction_id);
  }
}

export async function deleteConstructionTask(id: string) {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("construction_tasks")
    .select("construction_id")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("construction_tasks").delete().eq("id", id);
  if (error) throw error;
  if (row?.construction_id) {
    await syncConstructionScheduleProgress(supabase, row.construction_id);
  }
}

export async function completeConstruction(
  constructionId: string,
  input: {
    actual_cost: number;
    createInvoice: boolean;
    invoice?: {
      recipient: string;
      invoice_date: string;
      due_date: string;
      amount: number;
      payment_terms?: string;
    };
  }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  // 工事を完了ステータスに更新
  const { data: construction, error: updateErr } = await supabase
    .from("constructions")
    .update({ status: "completed", progress: 100, actual_cost: input.actual_cost })
    .eq("id", constructionId)
    .select("*, customer:customers(id, name, company_name)")
    .single();
  if (updateErr) throw updateErr;

  let invoiceId: string | null = null;

  // 最終精算請求書を生成
  if (input.createInvoice && input.invoice) {
    const { count } = await supabase.from("invoices").select("*", { count: "exact", head: true });
    const invoiceNo = `INV-${String((count || 0) + 1).padStart(4, "0")}`;
    const subtotal = input.invoice.amount;
    const tax = Math.floor(subtotal * 0.1);

    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .insert({
        company_id: profile.company_id,
        invoice_no: invoiceNo,
        construction_id: constructionId,
        customer_id: construction.customer_id,
        recipient: input.invoice.recipient,
        invoice_date: input.invoice.invoice_date,
        due_date: input.invoice.due_date,
        payment_terms: input.invoice.payment_terms || null,
        subtotal,
        tax,
        total: subtotal + tax,
        status: "draft",
        created_by: user.id,
      })
      .select()
      .single();
    if (invErr) throw invErr;

    await supabase.from("invoice_items").insert({
      company_id: profile.company_id,
      invoice_id: inv.id,
      description: `最終精算払い（${construction.title} 竣工引渡し）`,
      quantity: 1,
      unit_price: subtotal,
      amount: subtotal,
      sort_order: 0,
    });

    invoiceId = inv.id;
  }

  return { construction, invoiceId };
}

export async function createContractorOrder(input: {
  constructionId: string;
  title: string;
  amount: number;
  craftsmanId?: string;
  notes?: string;
  orderDate?: string;
  startDate?: string;
  endDate?: string;
  completionDate?: string;
  paymentDate?: string;
  paymentCount?: string;
  workContent?: string;
  specialNotes?: string;
  department?: string;
  accountItem?: string;
  accountItemSource?: string;
  customPaymentSchedule?: Array<{ phase: string; rate: number; amount: number; due_date: string | null }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const paymentCount = input.paymentCount || "1回";
  const schedule = input.customPaymentSchedule?.length
    ? input.customPaymentSchedule
    : buildPaymentSchedule(
        input.amount,
        paymentCount,
        input.startDate,
        input.endDate,
      );

  const { nextPoNo } = await import("@/lib/actions/procurement");
  const poNo = await nextPoNo(profile.company_id).catch(() => null);

  const { data, error } = await supabase
    .from("contractor_orders")
    .insert({
      company_id: profile.company_id,
      construction_id: input.constructionId,
      craftsman_id: input.craftsmanId || null,
      title: input.title,
      amount: input.amount,
      status: "draft",
      notes: input.notes || null,
      order_date: input.orderDate || new Date().toISOString().split("T")[0],
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      completion_date: input.completionDate || null,
      payment_date: input.paymentDate || null,
      payment_count: paymentCount,
      work_content: input.workContent || null,
      special_notes: input.specialNotes || null,
      payment_schedule: schedule,
      po_no: poNo,
      department: input.department || null,
      account_item: input.accountItem || null,
      account_item_source: input.accountItemSource || (input.accountItem ? "manual" : null),
    })
    .select("*, craftsman:craftsmen(id, name, company_name)")
    .single();
  if (error) {
    const { data: fallback, error: fallbackErr } = await supabase
      .from("contractor_orders")
      .insert({
        company_id: profile.company_id,
        construction_id: input.constructionId,
        craftsman_id: input.craftsmanId || null,
        title: input.title,
        amount: input.amount,
        status: "draft",
        notes: input.notes || null,
        order_date: input.orderDate || new Date().toISOString().split("T")[0],
        start_date: input.startDate || null,
        end_date: input.endDate || null,
        completion_date: input.completionDate || null,
        payment_date: input.paymentDate || null,
        payment_count: paymentCount,
        work_content: input.workContent || null,
        special_notes: input.specialNotes || null,
        payment_schedule: schedule,
      })
      .select("*, craftsman:craftsmen(id, name, company_name)")
      .single();
    if (fallbackErr) throw error;
    const { ensurePartnerTokenForOrder } = await import("@/lib/actions/partner-portal");
    await ensurePartnerTokenForOrder({
      companyId: profile.company_id,
      constructionId: input.constructionId,
      orderId: fallback.id,
      label: fallback.title,
    }).catch(() => {});
    return fallback;
  }
  const { ensurePartnerTokenForOrder } = await import("@/lib/actions/partner-portal");
  await ensurePartnerTokenForOrder({
    companyId: profile.company_id,
    constructionId: input.constructionId,
    orderId: data.id,
    label: data.title,
  }).catch(() => {});
  return data;
}

export async function updateContractorOrder(
  id: string,
  input: {
    status?: "draft" | "submitted" | "approved" | "rejected";
    notes?: string;
    department?: string | null;
    account_item?: string | null;
    account_item_source?: string | null;
    payment_date?: string | null;
  }
) {
  const supabase = await createClient();
  const { error } = await supabase.from("contractor_orders").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteContractorOrder(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("contractor_orders").delete().eq("id", id);
  if (error) throw error;
}

/* ─────────────────── 契約書ドキュメント（テンプレートベース） ─────────────────── */
// notes フィールドに JSON で template_id / form / construction_id を保存して
// 1工事に複数の契約書ドキュメントを紐付ける。
const DOC_PREFIX = "@@HACHI_DOC@@";

type DocMeta = {
  construction_id: string;
  template_id: string;
  form: Record<string, string | number>;
};

function packMeta(meta: DocMeta): string {
  return DOC_PREFIX + JSON.stringify(meta);
}
function unpackMeta(notes: string | null): DocMeta | null {
  if (!notes || !notes.startsWith(DOC_PREFIX)) return null;
  try { return JSON.parse(notes.slice(DOC_PREFIX.length)) as DocMeta; }
  catch { return null; }
}

export async function getConstructionContractDocs(constructionId: string) {
  const supabase = await createClient();
  const { data: con } = await supabase
    .from("constructions")
    .select("id, customer_id, contract_id")
    .eq("id", constructionId)
    .single();
  if (!con) return [];

  // この工事に紐づく可能性のある契約書を広めに取得（同じ顧客 OR construction.contract_id）
  const filters: string[] = [];
  if (con.customer_id) filters.push(`customer_id.eq.${con.customer_id}`);
  if (con.contract_id) filters.push(`id.eq.${con.contract_id}`);

  let q = supabase.from("contracts").select("*").order("created_at", { ascending: false });
  if (filters.length > 0) q = q.or(filters.join(","));
  const { data, error } = await q;
  if (error) throw error;

  return (data || []).filter(c => {
    const meta = unpackMeta(c.notes);
    if (meta) return meta.construction_id === constructionId;
    return c.id === con.contract_id;
  }).map(c => {
    const meta = unpackMeta(c.notes);
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

export async function createContractDoc(input: {
  construction_id: string;
  template_id: string;
  title: string;
  form: Record<string, string | number>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { data: con } = await supabase.from("constructions").select("customer_id").eq("id", input.construction_id).single();

  const { count } = await supabase.from("contracts").select("*", { count: "exact", head: true });
  const contractNo = `CTR-${String((count || 0) + 1).padStart(4, "0")}`;
  const amount = Number(input.form.amount_excl_tax) || 0;
  const taxRate = Number(input.form.tax_rate) || 10;
  const total = amount + Math.floor(amount * taxRate / 100);
  const contractDate = (input.form.contract_date as string) || null;

  const meta: DocMeta = {
    construction_id: input.construction_id,
    template_id: input.template_id,
    form: input.form,
  };

  const { data, error } = await supabase
    .from("contracts")
    .insert({
      company_id: profile.company_id,
      customer_id: con?.customer_id || null,
      contract_no: contractNo,
      title: input.title,
      status: "preparing",
      amount: total,
      contract_date: contractDate,
      notes: packMeta(meta),
    })
    .select()
    .single();
  if (error) throw error;
  return { ...data, template_id: input.template_id, form: input.form };
}

export async function updateContractDoc(input: {
  id: string;
  construction_id: string;
  template_id: string;
  title?: string;
  form: Record<string, string | number>;
  status?: string;
}) {
  const supabase = await createClient();
  const amount = Number(input.form.amount_excl_tax) || 0;
  const taxRate = Number(input.form.tax_rate) || 10;
  const total = amount + Math.floor(amount * taxRate / 100);
  const contractDate = (input.form.contract_date as string) || null;
  const meta: DocMeta = {
    construction_id: input.construction_id,
    template_id: input.template_id,
    form: input.form,
  };
  const update: Record<string, unknown> = {
    notes: packMeta(meta),
    amount: total,
    contract_date: contractDate,
  };
  if (input.title !== undefined) update.title = input.title;
  if (input.status !== undefined) update.status = input.status;
  const { error } = await supabase.from("contracts").update(update).eq("id", input.id);
  if (error) throw error;
}

export async function deleteContractDoc(id: string, constructionId?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("contracts").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) {
    throw new Error("契約書を削除できませんでした。権限がないか、既に削除されています。");
  }
  if (constructionId) {
    await supabase
      .from("constructions")
      .update({ contract_id: null })
      .eq("id", constructionId)
      .eq("contract_id", id);
  }
}

export async function seedContractorOrders(constructionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const seeds = [
    { title: "基礎工事 下請発注", amount: 1_200_000, status: "approved" as const, notes: "2026年3月着工予定" },
    { title: "木工事（躯体・造作）下請発注", amount: 3_500_000, status: "submitted" as const, notes: "木造建設㈱への発注書" },
    { title: "屋根・板金工事 下請発注", amount: 480_000, status: "draft" as const, notes: "見積査定中" },
  ];

  const { data, error } = await supabase
    .from("contractor_orders")
    .insert(seeds.map(s => ({
      company_id: profile.company_id,
      construction_id: constructionId,
      craftsman_id: null,
      title: s.title,
      amount: s.amount,
      status: s.status,
      notes: s.notes,
    })))
    .select("*, craftsman:craftsmen(id, name, company_name)");
  if (error) throw error;
  return data;
}

export async function seedConstructionEstimates(constructionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { data: construction } = await supabase
    .from("constructions")
    .select("customer_id, title")
    .eq("id", constructionId)
    .single();
  if (!construction) throw new Error("Construction not found");

  // 5バージョンの見積データ
  const versions: Array<{
    title: string;
    status: "draft" | "issued" | "sent" | "accepted" | "rejected";
    categories: Array<{ name: string; items: Array<{ name: string; spec: string; qty: number; unit: string; price: number; cost_rate: number }> }>;
  }> = [
    {
      title: "初回提案",
      status: "draft",
      categories: [
        {
          name: "外構工事",
          items: [
            { name: "門扉", spec: "BH1000 CL", qty: 1, unit: "個", price: 14800, cost_rate: 0.878 },
            { name: "壁上センサー", spec: "ハクナップLEDライト", qty: 1, unit: "個", price: 7600, cost_rate: 0.855 },
            { name: "ステールサイン", spec: "—", qty: 1, unit: "個", price: 8500, cost_rate: 0.847 },
            { name: "ポスト", spec: "メールボックス・ア", qty: 1, unit: "個", price: 8000, cost_rate: 0.850 },
            { name: "カーポート取り付け工事", spec: "—", qty: 1, unit: "式", price: 40000, cost_rate: 0.875 },
          ],
        },
        {
          name: "外構工事2",
          items: [
            { name: "フェンス設置", spec: "高さ1.2m アルミ製", qty: 20, unit: "m", price: 8500, cost_rate: 0.882 },
          ],
        },
        {
          name: "植栽工事",
          items: [
            { name: "デザイン設計", spec: "—", qty: 1, unit: "式", price: 50000, cost_rate: 0.800 },
            { name: "シンボルツリー", spec: "シマトネリコ H=3m", qty: 2, unit: "本", price: 18000, cost_rate: 0.833 },
            { name: "低木植栽", spec: "ツツジ・サツキ他", qty: 15, unit: "本", price: 4200, cost_rate: 0.833 },
          ],
        },
      ],
    },
    {
      title: "変更見積",
      status: "draft",
      categories: [
        { name: "外構工事", items: [
          { name: "門扉", spec: "BH1000 CL（カラー変更）", qty: 1, unit: "個", price: 16800, cost_rate: 0.880 },
          { name: "カーポート取り付け工事", spec: "サイズ拡張", qty: 1, unit: "式", price: 55000, cost_rate: 0.873 },
        ]},
        { name: "植栽工事", items: [
          { name: "シンボルツリー", spec: "シマトネリコ H=3.5m に変更", qty: 2, unit: "本", price: 22000, cost_rate: 0.818 },
        ]},
      ],
    },
    {
      title: "追加工事",
      status: "draft",
      categories: [
        { name: "追加外構", items: [
          { name: "宅配ボックス", spec: "Panasonic コンボ", qty: 1, unit: "台", price: 45000, cost_rate: 0.844 },
        ]},
      ],
    },
    {
      title: "最終提案",
      status: "draft",
      categories: [
        { name: "本体工事", items: [
          { name: "基礎工事", spec: "ベタ基礎", qty: 1, unit: "式", price: 1800000, cost_rate: 0.867 },
          { name: "木工事", spec: "在来軸組工法", qty: 1, unit: "式", price: 4500000, cost_rate: 0.867 },
          { name: "屋根・板金工事", spec: "ガルバリウム鋼板", qty: 1, unit: "式", price: 850000, cost_rate: 0.847 },
          { name: "外壁工事", spec: "サイディング張", qty: 1, unit: "式", price: 1200000, cost_rate: 0.875 },
          { name: "内装工事", spec: "クロス・床材一式", qty: 1, unit: "式", price: 1400000, cost_rate: 0.857 },
          { name: "電気設備工事", spec: "—", qty: 1, unit: "式", price: 680000, cost_rate: 0.853 },
          { name: "給排水衛生工事", spec: "—", qty: 1, unit: "式", price: 950000, cost_rate: 0.853 },
        ]},
        { name: "諸経費", items: [
          { name: "諸経費", spec: "現場管理費・一般管理費", qty: 1, unit: "式", price: 1850000, cost_rate: 0.870 },
        ]},
      ],
    },
    {
      title: "追加変更",
      status: "draft",
      categories: [
        { name: "追加工事", items: [
          { name: "システムキッチン グレードアップ", spec: "LIXIL リシェル SI", qty: 1, unit: "式", price: 850000, cost_rate: 0.812 },
          { name: "造作家具追加", spec: "リビング収納", qty: 1, unit: "式", price: 420000, cost_rate: 0.810 },
          { name: "床暖房追加", spec: "リビング 10畳", qty: 1, unit: "式", price: 300000, cost_rate: 0.800 },
        ]},
      ],
    },
  ];

  const created = [];
  for (let i = 0; i < versions.length; i++) {
    const v = versions[i];
    const allItems = v.categories.flatMap(c => c.items);
    const subtotal = allItems.reduce((s, it) => s + Math.round(it.qty * it.price), 0);
    const costTotal = allItems.reduce((s, it) => s + Math.round(it.qty * it.price * it.cost_rate), 0);
    const tax = Math.floor(subtotal * 0.1);
    const total = subtotal + tax;
    const grossProfit = subtotal - costTotal;
    const grossProfitRate = subtotal > 0 ? (grossProfit / subtotal) * 100 : 0;

    const estimate = await allocateUniqueEstimateNo(supabase, profile.company_id, (estimateNo) =>
      supabase
        .from("estimates")
        .insert({
          company_id: profile.company_id,
          customer_id: construction.customer_id,
          construction_id: constructionId,
          estimate_no: estimateNo,
          title: v.title,
          status: v.status,
          subtotal,
          tax,
          total,
          cost_total: costTotal,
          gross_profit: grossProfit,
          gross_profit_rate: grossProfitRate,
          version: i + 1,
          notes: null,
        })
        .select()
        .single(),
    );

    for (let ci = 0; ci < v.categories.length; ci++) {
      const cat = v.categories[ci];
      const { data: category, error: catErr } = await supabase
        .from("estimate_categories")
        .insert({
          company_id: profile.company_id,
          estimate_id: estimate.id,
          name: cat.name,
          sort_order: ci,
        })
        .select()
        .single();
      if (catErr) throw catErr;

      for (let ii = 0; ii < cat.items.length; ii++) {
        const it = cat.items[ii];
        const sellingAmount = Math.round(it.qty * it.price);
        const costAmount = Math.round(sellingAmount * it.cost_rate);
        const gp = sellingAmount - costAmount;
        const gpRate = sellingAmount > 0 ? (gp / sellingAmount) * 100 : 0;
        const { error: itemErr } = await supabase
          .from("estimate_items")
          .insert({
            company_id: profile.company_id,
            estimate_id: estimate.id,
            category_id: category.id,
            name: it.name,
            specification: it.spec === "—" ? null : it.spec,
            quantity: it.qty,
            unit: it.unit,
            cost_price: Math.round(it.price * it.cost_rate),
            cost_amount: costAmount,
            selling_price: it.price,
            selling_amount: sellingAmount,
            gross_profit: gp,
            gross_profit_rate: gpRate,
            sort_order: ii,
          });
        if (itemErr) throw itemErr;
      }
    }
    created.push(estimate);
  }

  return created;
}

export async function createEmptyEstimateForConstruction(constructionId: string, title: string, createdByName?: string): Promise<{ id: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { data: construction } = await supabase
    .from("constructions")
    .select("customer_id")
    .eq("id", constructionId)
    .single();
  if (!construction) throw new Error("Construction not found");

  const { data: existingVersions } = await supabase
    .from("estimates")
    .select("version")
    .eq("construction_id", constructionId)
    .order("version", { ascending: false })
    .limit(1);
  const nextVersion = (existingVersions?.[0]?.version ?? 0) + 1;

  return allocateUniqueEstimateNo(supabase, profile.company_id, (estimateNo) =>
    supabase
      .from("estimates")
      .insert({
        company_id: profile.company_id,
        customer_id: construction.customer_id,
        construction_id: constructionId,
        estimate_no: estimateNo,
        title,
        status: "draft",
        version: nextVersion,
        subtotal: 0,
        tax: 0,
        total: 0,
        cost_total: 0,
        gross_profit: 0,
        gross_profit_rate: 0,
        assigned_to: user.id,
        notes: buildAuthorNotes(createdByName),
      })
      .select()
      .single(),
  );
}

export async function copyEstimateForConstruction(constructionId: string, sourceEstimateId: string, title: string, createdByName?: string): Promise<{ id: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { data: source, error: sourceError } = await supabase
    .from("estimates")
    .select("*, categories:estimate_categories(*), items:estimate_items(*)")
    .eq("id", sourceEstimateId)
    .single();
  throwIfSupabaseError(sourceError);
  if (!source) throw new Error("Source estimate not found");

  const { data: construction } = await supabase
    .from("constructions")
    .select("customer_id")
    .eq("id", constructionId)
    .single();
  if (!construction) throw new Error("Construction not found");

  const { data: existingVersions } = await supabase
    .from("estimates")
    .select("version")
    .eq("construction_id", constructionId)
    .order("version", { ascending: false })
    .limit(1);
  const nextVersion = (existingVersions?.[0]?.version ?? 0) + 1;

  const newEstimate = await allocateUniqueEstimateNo(supabase, profile.company_id, (estimateNo) =>
    supabase
      .from("estimates")
      .insert({
        company_id: profile.company_id,
        customer_id: construction.customer_id,
        construction_id: constructionId,
        estimate_no: estimateNo,
        title,
        status: "draft",
        version: nextVersion,
        subtotal: source.subtotal,
        tax: source.tax,
        total: source.total,
        cost_total: source.cost_total,
        gross_profit: source.gross_profit,
        gross_profit_rate: source.gross_profit_rate,
        notes: buildAuthorNotes(createdByName, source.notes),
        assigned_to: user.id,
      })
      .select()
      .single(),
  );

  const categoryMap = new Map<string, string>();
  for (const cat of source.categories ?? []) {
    const { data: newCat, error: catError } = await supabase
      .from("estimate_categories")
      .insert({
        company_id: profile.company_id,
        estimate_id: newEstimate.id,
        name: cat.name,
        sort_order: cat.sort_order,
      })
      .select()
      .single();
    throwIfSupabaseError(catError);
    if (newCat) categoryMap.set(cat.id, newCat.id);
  }

  if (source.items?.length) {
    const { error: itemsError } = await supabase.from("estimate_items").insert(
      source.items.map((item: Record<string, unknown>, index: number) => ({
        company_id: profile.company_id,
        estimate_id: newEstimate.id,
        category_id: item.category_id ? categoryMap.get(String(item.category_id)) ?? null : null,
        name: item.name,
        description: item.description,
        specification: item.specification,
        quantity: item.quantity,
        unit: item.unit,
        cost_price: item.cost_price,
        cost_amount: item.cost_amount,
        selling_price: item.selling_price,
        selling_amount: item.selling_amount,
        gross_profit: item.gross_profit,
        gross_profit_rate: item.gross_profit_rate,
        sort_order: (item.sort_order as number | undefined) ?? index,
        notes: item.notes,
      })),
    );
    throwIfSupabaseError(itemsError);
  }

  return newEstimate;
}

export async function refreshEstimateTotals(estimateId: string) {
  const supabase = await createClient();
  return recalculateEstimateTotals(supabase, estimateId);
}

async function recalculateEstimateTotals(
  supabase: Awaited<ReturnType<typeof createClient>>,
  estimateId: string,
) {
  const [
    { data: items, error: itemsError },
    { data: categories, error: catsError },
    { data: est, error: estError },
  ] = await Promise.all([
    supabase
      .from("estimate_items")
      .select("category_id, selling_amount, cost_amount, is_text_row, vendor_craftsman_id")
      .eq("estimate_id", estimateId),
    supabase
      .from("estimate_categories")
      .select("id, quantity, cost_price, selling_price")
      .eq("estimate_id", estimateId),
    supabase
      .from("estimates")
      .select("id, company_id")
      .eq("id", estimateId)
      .single(),
  ]);
  throwIfSupabaseError(itemsError);
  throwIfSupabaseError(catsError);
  throwIfSupabaseError(estError);

  const vendorIds = [
    ...new Set(
      (items ?? [])
        .map((item) => item.vendor_craftsman_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const managementIds = new Set<string>();
  const reserveIds = new Set<string>();
  if (vendorIds.length > 0) {
    const { data: crafts } = await supabase
      .from("craftsmen")
      .select("id, kind, system_key")
      .in("id", vendorIds);
    for (const craftsman of crafts ?? []) {
      if (craftsman.kind !== "system") continue;
      if (craftsman.system_key === "management") managementIds.add(craftsman.id);
      if (craftsman.system_key === "reserve") reserveIds.add(craftsman.id);
    }
  }

  const itemsForTotals = (items ?? []).filter(
    (item) => !item.vendor_craftsman_id || !managementIds.has(item.vendor_craftsman_id),
  );

  const { effectiveCategoryAmounts } = await import("@/lib/estimate-category-totals");
  const { calcManagementFeeAmount, normalizeFeeRate } = await import("@/lib/estimate-management-fee");

  // 大項目直接入力と配下詳細行の優先ロジック（No.68: 詳細行があれば詳細優先）
  let subtotal = 0;
  let lineCost = 0;
  for (const cat of categories ?? []) {
    const catItems = itemsForTotals.filter((i) => i.category_id === cat.id);
    const eff = effectiveCategoryAmounts(cat, catItems);
    subtotal += eff.selling_amount;
    lineCost += eff.cost_amount;
  }
  const uncategorized = itemsForTotals.filter((i) => !i.category_id && !i.is_text_row);
  subtotal += uncategorized.reduce((s, i) => s + Number(i.selling_amount ?? 0), 0);
  lineCost += uncategorized.reduce((s, i) => s + Number(i.cost_amount ?? 0), 0);

  const reserveCost = (items ?? [])
    .filter((item) => item.vendor_craftsman_id && reserveIds.has(item.vendor_craftsman_id) && !item.is_text_row)
    .reduce((sum, item) => sum + Number(item.cost_amount ?? 0), 0);

  const { data: setting } = est?.company_id
    ? await supabase
        .from("bi_annual_settings")
        .select("reserve_fee_rate")
        .eq("company_id", est.company_id)
        .order("fiscal_year", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };
  const feeRate = normalizeFeeRate(setting?.reserve_fee_rate);
  const managementFee = calcManagementFeeAmount({
    sellingTotal: subtotal,
    reserveCost,
    rate: feeRate,
  });

  const costTotal = lineCost + managementFee;
  const tax = Math.floor(subtotal * 0.1);
  const total = subtotal + tax;
  const grossProfit = subtotal - costTotal;
  const grossProfitRate = subtotal > 0 ? (grossProfit / subtotal) * 100 : 0;

  const totals = { subtotal, tax, total, cost_total: costTotal, gross_profit: grossProfit, gross_profit_rate: grossProfitRate };

  const { error } = await supabase
    .from("estimates")
    .update({
      ...totals,
      reserve_fee_1_amount: managementFee,
      reserve_fee_1_rate: feeRate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", estimateId);
  throwIfSupabaseError(error);

  return totals;
}

function calcItemAmounts(quantity: number, costPrice: number, sellingPrice: number) {
  const qty = Number(quantity) || 0;
  const cost = Number(costPrice) || 0;
  const selling = Number(sellingPrice) || 0;
  const costAmount = Math.round(qty * cost);
  const sellingAmount = Math.round(qty * selling);
  const grossProfit = sellingAmount - costAmount;
  const grossProfitRate = sellingAmount > 0 ? (grossProfit / sellingAmount) * 100 : 0;
  return {
    cost_amount: costAmount,
    selling_amount: sellingAmount,
    gross_profit: grossProfit,
    gross_profit_rate: grossProfitRate,
  };
}

async function assertEstimateAccess(estimateId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { data: estimate, error } = await supabase
    .from("estimates")
    .select("id, company_id")
    .eq("id", estimateId)
    .single();
  throwIfSupabaseError(error);
  if (!estimate || estimate.company_id !== profile.company_id) throw new Error("見積が見つかりません");

  return { supabase, companyId: profile.company_id };
}

export async function addEstimateCategory(estimateId: string, name: string) {
  const trimmed = name.trim();

  const { supabase, companyId } = await assertEstimateAccess(estimateId);

  const { data: existing } = await supabase
    .from("estimate_categories")
    .select("sort_order")
    .eq("estimate_id", estimateId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const sortOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const { data: category, error } = await supabase
    .from("estimate_categories")
    .insert({
      company_id: companyId,
      estimate_id: estimateId,
      name: trimmed,
      sort_order: sortOrder,
    })
    .select()
    .single();
  throwIfSupabaseError(error);

  await supabase
    .from("estimates")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", estimateId);

  return category;
}

export async function updateEstimateCategoryReserve(categoryId: string, reserveFeeRate: number) {
  const supabase = await createClient();
  const rate = Math.max(0, Math.min(1, reserveFeeRate));
  const { data, error } = await supabase
    .from("estimate_categories")
    .update({ reserve_fee_rate: rate })
    .eq("id", categoryId)
    .select()
    .single();
  throwIfSupabaseError(error);
  return data;
}

export async function updateEstimateCategoryName(categoryId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("大項目名を入力してください");

  const supabase = await createClient();
  const { data: category, error: findError } = await supabase
    .from("estimate_categories")
    .select("id, estimate_id, name")
    .eq("id", categoryId)
    .single();
  throwIfSupabaseError(findError);
  if (!category) throw new Error("大項目が見つかりません");

  await assertEstimateAccess(category.estimate_id);

  if (category.name === trimmed) return category;

  const { data, error } = await supabase
    .from("estimate_categories")
    .update({ name: trimmed })
    .eq("id", categoryId)
    .select()
    .single();
  throwIfSupabaseError(error);

  await supabase
    .from("estimates")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", category.estimate_id);

  return data;
}

export async function addEstimateItem(
  estimateId: string,
  categoryId: string | null,
  name?: string,
  options?: { isTextRow?: boolean },
) {
  const trimmed = name?.trim() ?? "";
  const isTextRow = options?.isTextRow === true;

  // 独立テキスト行（No.69②）のみ大項目なしを許可
  if (!categoryId && !isTextRow) throw new Error("大項目を指定してください");

  const { supabase, companyId } = await assertEstimateAccess(estimateId);

  if (categoryId) {
    const { data: category, error: catError } = await supabase
      .from("estimate_categories")
      .select("id")
      .eq("id", categoryId)
      .eq("estimate_id", estimateId)
      .single();
    throwIfSupabaseError(catError);
    if (!category) throw new Error("大項目が見つかりません");
  }

  let existingQuery = supabase
    .from("estimate_items")
    .select("sort_order")
    .eq("estimate_id", estimateId)
    .order("sort_order", { ascending: false })
    .limit(1);
  existingQuery = categoryId
    ? existingQuery.eq("category_id", categoryId)
    : existingQuery.is("category_id", null);
  const { data: existing } = await existingQuery;

  const sortOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const { data: item, error } = await supabase
    .from("estimate_items")
    .insert({
      company_id: companyId,
      estimate_id: estimateId,
      category_id: categoryId,
      name: trimmed || (isTextRow ? "（注釈）" : ""),
      quantity: isTextRow ? 0 : 1,
      unit: isTextRow ? null : "式",
      cost_price: 0,
      cost_amount: 0,
      selling_price: 0,
      selling_amount: 0,
      gross_profit: 0,
      gross_profit_rate: 0,
      sort_order: sortOrder,
      is_text_row: isTextRow,
      text_row_scope: isTextRow ? (categoryId ? "category" : "standalone") : null,
    })
    .select()
    .single();
  throwIfSupabaseError(error);

  await recalculateEstimateTotals(supabase, estimateId);
  return item;
}

/** 明細行（計算行・テキスト行）を削除する（No.69） */
export async function deleteEstimateItem(itemId: string) {
  const supabase = await createClient();
  const { data: item, error: findError } = await supabase
    .from("estimate_items")
    .select("id, estimate_id")
    .eq("id", itemId)
    .single();
  throwIfSupabaseError(findError);
  if (!item) throw new Error("明細が見つかりません");

  await assertEstimateAccess(item.estimate_id);

  const { error } = await supabase.from("estimate_items").delete().eq("id", itemId);
  throwIfSupabaseError(error);

  const totals = await recalculateEstimateTotals(supabase, item.estimate_id);
  return { totals };
}

/** 大項目と配下明細を削除する（No.68/69） */
export async function deleteEstimateCategory(categoryId: string) {
  const supabase = await createClient();
  const { data: category, error: findError } = await supabase
    .from("estimate_categories")
    .select("id, estimate_id")
    .eq("id", categoryId)
    .single();
  throwIfSupabaseError(findError);
  if (!category) throw new Error("大項目が見つかりません");

  await assertEstimateAccess(category.estimate_id);

  const { error: itemsError } = await supabase
    .from("estimate_items")
    .delete()
    .eq("category_id", categoryId);
  throwIfSupabaseError(itemsError);

  const { error } = await supabase.from("estimate_categories").delete().eq("id", categoryId);
  throwIfSupabaseError(error);

  const totals = await recalculateEstimateTotals(supabase, category.estimate_id);
  return { totals };
}

export type EstimateItemUpdatePatch = {
  name?: string;
  specification?: string | null;
  notes?: string | null;
  quantity?: number;
  unit?: string | null;
  cost_price?: number;
  selling_price?: number;
  /** 発注業者（業者マスタ参照）。null で解除 */
  vendor_craftsman_id?: string | null;
  /** 発注業者の表示名（自由入力含む） */
  vendor_name?: string | null;
};

export async function updateEstimateItem(itemId: string, patch: EstimateItemUpdatePatch) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { data: current, error: fetchError } = await supabase
    .from("estimate_items")
    .select("*")
    .eq("id", itemId)
    .single();
  throwIfSupabaseError(fetchError);
  if (!current || current.company_id !== profile.company_id) throw new Error("明細が見つかりません");

  // システム原価行判定（No.61/67/106）: 予備費・経営調整費は種別フラグで判定（文字列判定しない）
  let isReserveRow: boolean = Boolean(current.is_reserve_row);
  const vendorCraftsmanId =
    patch.vendor_craftsman_id !== undefined ? patch.vendor_craftsman_id : current.vendor_craftsman_id;
  if (patch.vendor_craftsman_id !== undefined) {
    if (patch.vendor_craftsman_id) {
      const { data: craftsman } = await supabase
        .from("craftsmen")
        .select("kind, system_key")
        .eq("id", patch.vendor_craftsman_id)
        .single();
      isReserveRow = craftsman?.kind === "system" && craftsman?.system_key === "reserve";
    } else {
      isReserveRow = false;
    }
  }

  const quantity = patch.quantity ?? Number(current.quantity) ?? 0;
  const costPrice = patch.cost_price ?? Number(current.cost_price) ?? 0;
  // 予備費行は売価入力不可（売価0固定・No.65/61）
  const sellingPrice = isReserveRow
    ? 0
    : patch.selling_price ?? Number(current.selling_price) ?? 0;
  const amounts = calcItemAmounts(quantity, costPrice, sellingPrice);

  const { data: item, error } = await supabase
    .from("estimate_items")
    .update({
      name: patch.name ?? current.name,
      specification: patch.specification !== undefined ? patch.specification : current.specification,
      notes: patch.notes !== undefined ? patch.notes : current.notes,
      quantity,
      unit: patch.unit !== undefined ? patch.unit : current.unit,
      cost_price: costPrice,
      selling_price: sellingPrice,
      vendor_craftsman_id: vendorCraftsmanId ?? null,
      vendor_name: patch.vendor_name !== undefined ? patch.vendor_name : current.vendor_name,
      is_reserve_row: isReserveRow,
      ...amounts,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .select()
    .single();
  throwIfSupabaseError(error);

  const totals = await recalculateEstimateTotals(supabase, current.estimate_id);
  return { item, totals };
}

export type EstimateCategoryDetailPatch = {
  specification?: string | null;
  vendor_craftsman_id?: string | null;
  vendor_name?: string | null;
  quantity?: number;
  unit?: string | null;
  cost_price?: number;
  selling_price?: number;
};

/** 大項目（カテゴリ行）の直接入力を更新する（No.70） */
export async function updateEstimateCategoryDetails(
  categoryId: string,
  patch: EstimateCategoryDetailPatch,
) {
  const supabase = await createClient();
  const { data: category, error: findError } = await supabase
    .from("estimate_categories")
    .select("id, estimate_id")
    .eq("id", categoryId)
    .single();
  throwIfSupabaseError(findError);
  if (!category) throw new Error("大項目が見つかりません");

  await assertEstimateAccess(category.estimate_id);

  const { data, error } = await supabase
    .from("estimate_categories")
    .update(patch)
    .eq("id", categoryId)
    .select()
    .single();
  throwIfSupabaseError(error);

  const totals = await recalculateEstimateTotals(supabase, category.estimate_id);
  return { category: data, totals };
}

/** 大項目の並べ替え（No.59） */
export async function reorderEstimateCategories(estimateId: string, orderedIds: string[]) {
  const { supabase } = await assertEstimateAccess(estimateId);
  for (const [index, id] of orderedIds.entries()) {
    const { error } = await supabase
      .from("estimate_categories")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("estimate_id", estimateId);
    throwIfSupabaseError(error);
  }
  await supabase
    .from("estimates")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", estimateId);
}

/** 明細行の並べ替え（同一大項目内・No.59） */
export async function reorderEstimateItems(estimateId: string, orderedIds: string[]) {
  const { supabase } = await assertEstimateAccess(estimateId);
  for (const [index, id] of orderedIds.entries()) {
    const { error } = await supabase
      .from("estimate_items")
      .update({ sort_order: index, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("estimate_id", estimateId);
    throwIfSupabaseError(error);
  }
  await supabase
    .from("estimates")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", estimateId);
}

/**
 * 全明細に対して粗利率を基準に原価単価 or 見積単価を一括計算して更新する。
 * mode='cost'  : selling_price が基準 → cost_price = selling_price × (1 - rate)
 * mode='sell'  : cost_price が基準   → selling_price = cost_price / (1 - rate)
 */
export async function bulkApplyMarginToEstimate(
  estimateId: string,
  mode: "cost" | "sell",
  ratePercent: number,
) {
  if (ratePercent < 0 || ratePercent >= 100) throw new Error("粗利率は 0〜99.9% の範囲で入力してください");
  const rate = ratePercent / 100;

  const { supabase, companyId } = await assertEstimateAccess(estimateId);

  const { data: allItems, error: fetchErr } = await supabase
    .from("estimate_items")
    .select("*")
    .eq("estimate_id", estimateId)
    .eq("company_id", companyId);
  throwIfSupabaseError(fetchErr);
  if (!allItems || allItems.length === 0) throw new Error("明細がありません");

  const calcItems = allItems.filter((item) => !item.is_text_row);
  if (calcItems.length === 0) throw new Error("計算対象の明細がありません");

  const updates = calcItems.map((item) => {
    const qty = Number(item.quantity) || 0;
    let costPrice: number;
    let sellingPrice: number;

    if (mode === "cost") {
      sellingPrice = Number(item.selling_price) || 0;
      costPrice = Math.round(sellingPrice * (1 - rate));
    } else {
      costPrice = Number(item.cost_price) || 0;
      sellingPrice = rate < 1 ? Math.round(costPrice / (1 - rate)) : costPrice;
    }

    const amounts = calcItemAmounts(qty, costPrice, sellingPrice);
    return {
      id: item.id,
      cost_price: costPrice,
      selling_price: sellingPrice,
      ...amounts,
      updated_at: new Date().toISOString(),
    };
  });

  for (const row of updates) {
    const { id, ...patch } = row;
    const { error: rowErr } = await supabase
      .from("estimate_items")
      .update(patch)
      .eq("id", id)
      .eq("company_id", companyId);
    throwIfSupabaseError(rowErr);
  }

  const totals = await recalculateEstimateTotals(supabase, estimateId);

  const { data: updatedItems, error: reloadErr } = await supabase
    .from("estimate_items")
    .select("*")
    .eq("estimate_id", estimateId)
    .eq("company_id", companyId);
  throwIfSupabaseError(reloadErr);

  return { items: updatedItems ?? [], totals };
}

/** Linq ドラフトの大項目・明細を既存見積に追加する */
export async function applyEstimateDraftToEstimate(
  estimateId: string,
  draft: {
    title?: string;
    notes?: string;
    items: Array<{
      categoryName?: string;
      name: string;
      quantity?: number;
      unit?: string;
      costPrice?: number;
      sellingPrice?: number;
      specification?: string;
    }>;
  },
) {
  const { supabase, companyId } = await assertEstimateAccess(estimateId);

  const { data: existingCats } = await supabase
    .from("estimate_categories")
    .select("id, name, sort_order")
    .eq("estimate_id", estimateId);
  const catByName = new Map((existingCats ?? []).map((c) => [c.name, c]));
  let catSort =
    (existingCats ?? []).reduce((max, c) => Math.max(max, c.sort_order ?? 0), -1) + 1;

  const { count: itemCountStart } = await supabase
    .from("estimate_items")
    .select("*", { count: "exact", head: true })
    .eq("estimate_id", estimateId);
  let itemSort = itemCountStart ?? 0;

  const grouped = new Map<string, typeof draft.items>();
  for (const item of draft.items) {
    const key = item.categoryName?.trim() || "追加工事";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }

  for (const [catName, catItems] of grouped) {
    let categoryId: string;
    const existing = catByName.get(catName);
    if (existing) {
      categoryId = existing.id;
    } else {
      const { data: cat, error: catErr } = await supabase
        .from("estimate_categories")
        .insert({
          company_id: companyId,
          estimate_id: estimateId,
          name: catName,
          sort_order: catSort++,
        })
        .select("id")
        .single();
      throwIfSupabaseError(catErr);
      categoryId = cat!.id;
      catByName.set(catName, { id: categoryId, name: catName, sort_order: catSort - 1 });
    }

    const rows = catItems.map((item) => {
      const qty = Number(item.quantity) || 1;
      const costPrice = Number(item.costPrice) || 0;
      const sellingPrice = Number(item.sellingPrice) || 0;
      const amounts = calcItemAmounts(qty, costPrice, sellingPrice);
      return {
        company_id: companyId,
        estimate_id: estimateId,
        category_id: categoryId,
        name: item.name.trim() || "明細",
        specification: item.specification?.trim() || null,
        quantity: qty,
        unit: item.unit?.trim() || "式",
        cost_price: costPrice,
        selling_price: sellingPrice,
        ...amounts,
        sort_order: itemSort++,
        notes: null,
        is_text_row: false,
      };
    });

    const { error: insertErr } = await supabase.from("estimate_items").insert(rows);
    throwIfSupabaseError(insertErr);
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (draft.notes?.trim()) {
    patch.notes = draft.notes.trim();
  }
  const { error: patchErr } = await supabase.from("estimates").update(patch).eq("id", estimateId);
  throwIfSupabaseError(patchErr);

  await recalculateEstimateTotals(supabase, estimateId);
  return getConstructionEstimate(estimateId);
}

/** 工事に紐づく最新見積 ID（Linq 共同作成のフォールバック） */
export async function getPrimaryConstructionEstimateId(constructionId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("estimates")
    .select("id")
    .eq("construction_id", constructionId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data?.id ?? null;
}

export async function getConstructionEstimate(estimateId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("estimates")
    .select("*, categories:estimate_categories(*), items:estimate_items(*)")
    .eq("id", estimateId)
    .single();
  if (error) throw error;
  return data;
}

export async function linkEstimateToConstruction(estimateId: string, constructionId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("estimates")
    .update({ construction_id: constructionId })
    .eq("id", estimateId);
  if (error) throw error;
}

export async function importCategoryFromReference(
  estimateId: string,
  categoryName: string,
  itemsData: Array<{
    name: string;
    specification?: string | null;
    notes?: string | null;
    quantity: number;
    unit: string | null;
    cost_price: number;
    cost_amount: number;
    selling_price: number;
    selling_amount: number;
    gross_profit: number;
    gross_profit_rate: number;
  }>,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { count: catCount } = await supabase
    .from("estimate_categories")
    .select("*", { count: "exact", head: true })
    .eq("estimate_id", estimateId);

  const { data: category, error: catError } = await supabase
    .from("estimate_categories")
    .insert({
      company_id: profile.company_id,
      estimate_id: estimateId,
      name: categoryName,
      sort_order: catCount ?? 0,
    })
    .select()
    .single();
  throwIfSupabaseError(catError);

  const { count: itemCount } = await supabase
    .from("estimate_items")
    .select("*", { count: "exact", head: true })
    .eq("estimate_id", estimateId);

  let items: EstimateItem[] = [];
  if (itemsData.length > 0) {
    const { data: inserted, error: itemsError } = await supabase
      .from("estimate_items")
      .insert(
        itemsData.map((item, i) => ({
          company_id: profile.company_id,
          estimate_id: estimateId,
          category_id: (category as EstimateCategory).id,
          name: item.name,
          specification: item.specification ?? null,
          notes: item.notes ?? null,
          quantity: item.quantity,
          unit: item.unit,
          cost_price: item.cost_price,
          cost_amount: item.cost_amount,
          selling_price: item.selling_price,
          selling_amount: item.selling_amount,
          gross_profit: item.gross_profit,
          gross_profit_rate: item.gross_profit_rate,
          sort_order: (itemCount ?? 0) + i,
        })),
      )
      .select();
    throwIfSupabaseError(itemsError);
    items = (inserted ?? []) as EstimateItem[];
  }

  const totals = await recalculateEstimateTotals(supabase, estimateId);
  return { category: category as EstimateCategory, items, totals };
}

export async function createOrdersFromEstimate(constructionId: string, estimateId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { data: construction } = await supabase
    .from("constructions")
    .select("start_date, end_date")
    .eq("id", constructionId)
    .single();
  if (!construction) throw new Error("Construction not found");

  const { data: items } = await supabase
    .from("estimate_items")
    .select("*")
    .eq("estimate_id", estimateId)
    .order("sort_order");

  if (!items?.length) throw new Error("見積明細がありません");

  const today = new Date().toISOString().split("T")[0];
  const created = [];

  for (const item of items) {
    const amount = Number(item.cost_amount || item.selling_amount || 0);
    if (amount <= 0) continue;
    const schedule = buildPaymentSchedule(
      amount,
      "2回",
      construction.start_date,
      construction.end_date,
    );
    const { data, error } = await supabase
      .from("contractor_orders")
      .insert({
        company_id: profile.company_id,
        construction_id: constructionId,
        title: item.name,
        amount,
        status: "draft",
        order_date: today,
        start_date: construction.start_date,
        end_date: construction.end_date,
        payment_count: "2回",
        work_content: item.specification || item.name,
        payment_schedule: schedule,
      })
      .select("*, craftsman:craftsmen(id, name, company_name)")
      .single();
    if (error) throw error;
    created.push(data);
  }

  return created;
}
