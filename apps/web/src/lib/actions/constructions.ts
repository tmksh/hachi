"use server";

import { createClient } from "@/lib/supabase/server";
import { dispatchWebhook } from "@/lib/webhooks";
import type { Construction, ConstructionTask, ContractorOrder } from "@/lib/database.types";

export async function getConstructions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("constructions")
    .select("*, customer:customers(id, name, company_name), assignee:profiles!constructions_assigned_to_fkey(id, display_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getConstruction(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("constructions")
    .select("*, customer:customers(id, name, company_name, address), contract:contracts(id, contract_no, title, amount, contract_date, start_date, end_date, notes, status, estimate_id), assignee:profiles!constructions_assigned_to_fkey(id, display_name)")
    .eq("id", id)
    .single();
  if (error) throw error;

  const { data: tasks } = await supabase
    .from("construction_tasks")
    .select("*")
    .eq("construction_id", id)
    .order("sort_order");

  const { data: orders } = await supabase
    .from("contractor_orders")
    .select("*, craftsman:craftsmen(id, name)")
    .eq("construction_id", id)
    .order("created_at", { ascending: false });

  // 契約に紐づく見積もり明細を取得
  let estimate = null;
  const contractData = data as typeof data & { estimate_id?: string | null };
  if (contractData.contract_id) {
    const { data: contract } = await supabase
      .from("contracts")
      .select("estimate_id")
      .eq("id", contractData.contract_id)
      .single();
    if (contract?.estimate_id) {
      const { data: est } = await supabase
        .from("estimates")
        .select("*, categories:estimate_categories(*), items:estimate_items(*)")
        .eq("id", contract.estimate_id)
        .single();
      if (est) {
        estimate = est;
      }
    }
  }

  return { ...data, tasks: tasks || [], orders: orders || [], estimate };
}

export async function createConstruction(input: {
  title: string;
  contract_id?: string;
  customer_id?: string;
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
  });

  return data as Construction;
}

export async function updateConstruction(id: string, input: Partial<Omit<Construction, "id" | "company_id" | "construction_no" | "created_at" | "updated_at">>) {
  const supabase = await createClient();
  const { data: before } = await supabase
    .from("constructions")
    .select("status, company_id, title, construction_no, order_amount")
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

  return data as Construction;
}

export async function deleteConstruction(id: string) {
  const supabase = await createClient();
  await supabase.from("construction_tasks").delete().eq("construction_id", id);
  await supabase.from("contractor_orders").delete().eq("construction_id", id);
  const { error } = await supabase.from("constructions").delete().eq("id", id);
  if (error) throw error;
}

export async function createConstructionTask(constructionId: string, input: { name: string; start_date?: string; end_date?: string; assigned_to?: string; description?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { data, error } = await supabase
    .from("construction_tasks")
    .insert({
      company_id: profile.company_id,
      construction_id: constructionId,
      name: input.name,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      assigned_to: input.assigned_to || null,
      description: input.description || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ConstructionTask;
}

export async function updateConstructionTask(id: string, input: Partial<Pick<ConstructionTask, "name" | "start_date" | "end_date" | "progress" | "status" | "assigned_to">>) {
  const supabase = await createClient();
  const { error } = await supabase.from("construction_tasks").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteConstructionTask(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("construction_tasks").delete().eq("id", id);
  if (error) throw error;
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
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

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
      order_date: input.orderDate || null,
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      completion_date: input.completionDate || null,
      payment_date: input.paymentDate || null,
      payment_count: input.paymentCount || "1回",
      work_content: input.workContent || null,
      special_notes: input.specialNotes || null,
    })
    .select("*, craftsman:craftsmen(id, name)")
    .single();
  if (error) throw error;
  return data;
}

export async function updateContractorOrder(
  id: string,
  input: { status?: "draft" | "submitted" | "approved" | "rejected"; notes?: string }
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

export async function deleteContractDoc(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("contracts").delete().eq("id", id);
  if (error) throw error;
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
    .select("*, craftsman:craftsmen(id, name)");
  if (error) throw error;
  return data;
}
