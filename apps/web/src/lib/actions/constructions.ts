"use server";

import { createClient } from "@/lib/supabase/server";
import { dispatchWebhook } from "@/lib/webhooks";
import { buildPaymentSchedule } from "@/lib/construction/payment-schedule";
import type { Construction, ConstructionTask, ContractorOrder } from "@/lib/database.types";

const AUTHOR_NOTE_PREFIX = "作成者:";

function resolveEstimateAuthor(est: {
  created_by_name?: string | null;
  notes?: string | null;
  assignee?: { display_name?: string | null } | null;
}): string | null {
  if (est.created_by_name?.trim()) return est.created_by_name.trim();
  const match = est.notes?.match(new RegExp(`^${AUTHOR_NOTE_PREFIX}\\s*(.+?)(?:\\n|$)`));
  if (match?.[1]) return match[1].trim();
  return est.assignee?.display_name ?? null;
}

function buildAuthorNotes(createdByName?: string, existingNotes?: string | null): string | null {
  const name = createdByName?.trim();
  if (!name) return existingNotes ?? null;
  const authorLine = `${AUTHOR_NOTE_PREFIX} ${name}`;
  const stripped = existingNotes?.replace(new RegExp(`^${AUTHOR_NOTE_PREFIX}\\s*.+?\\n?`), "").trim();
  if (!stripped) return authorLine;
  return `${authorLine}\n${stripped}`;
}

function parseEstimateSequence(estimateNo: string): number {
  const match = estimateNo.match(/^EST-(?:\d{4}-)?(\d+)$/i);
  return match ? parseInt(match[1], 10) : 0;
}

function throwIfSupabaseError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

async function nextEstimateNo(supabase: Awaited<ReturnType<typeof createClient>>, companyId: string) {
  const { data, error } = await supabase
    .from("estimates")
    .select("estimate_no")
    .eq("company_id", companyId);
  throwIfSupabaseError(error);

  const max = (data ?? []).reduce((current, row) => {
    return Math.max(current, parseEstimateSequence(row.estimate_no));
  }, 0);
  return `EST-${String(max + 1).padStart(4, "0")}`;
}

export async function getConstructions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("constructions")
    .select("*, customer:customers(id, name, company_name), assignee:profiles!constructions_assigned_to_fkey(id, display_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
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
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((est) => ({
    ...est,
    created_by_name: resolveEstimateAuthor(est),
  }));
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

  // 契約に紐づく見積もり + 工事に直接紐づく見積もり一覧
  let estimate = null;
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

  const { data: linkedEstimates } = await supabase
    .from("estimates")
    .select("id, estimate_no, title, version, status, total, subtotal, gross_profit_rate, created_at, updated_at, notes, assignee:profiles!estimates_assigned_to_fkey(id, display_name)")
    .eq("construction_id", id)
    .order("version", { ascending: false });

  if (linkedEstimates?.length) {
    estimates = linkedEstimates.map((est) => ({
      ...est,
      created_by_name: resolveEstimateAuthor(est),
    })) as typeof estimates;
  }

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
        if (!estimates.some((e) => e.id === est.id)) {
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
  }

  // 契約見積がなければ最新版を詳細表示用に取得
  if (!estimate && estimates.length > 0) {
    const { data: est } = await supabase
      .from("estimates")
      .select("*, categories:estimate_categories(*), items:estimate_items(*)")
      .eq("id", estimates[0].id)
      .single();
    if (est) estimate = est;
  }

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_no, invoice_date, due_date, total, status, created_at")
    .eq("construction_id", id)
    .order("invoice_date", { ascending: false });

  return {
    ...data,
    tasks: tasks || [],
    orders: orders || [],
    estimate,
    estimates: estimates || [],
    invoices: invoices || [],
  };
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

  const paymentCount = input.paymentCount || "1回";
  const schedule = buildPaymentSchedule(
    input.amount,
    paymentCount,
    input.startDate,
    input.endDate,
  );

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

  const { data: existingNumbers, error: numbersError } = await supabase
    .from("estimates")
    .select("estimate_no")
    .eq("company_id", profile.company_id);
  throwIfSupabaseError(numbersError);
  const startNo = (existingNumbers ?? []).reduce((current, row) => {
    return Math.max(current, parseEstimateSequence(row.estimate_no));
  }, 0) + 1;

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
    const estimateNo = `EST-${String(startNo + i).padStart(4, "0")}`;

    const { data: estimate, error: estErr } = await supabase
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
      .single();
    if (estErr) throw estErr;

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

export async function createEmptyEstimateForConstruction(constructionId: string, title: string, createdByName?: string) {
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

  const estimateNo = await nextEstimateNo(supabase, profile.company_id);

  const { data: existingVersions } = await supabase
    .from("estimates")
    .select("version")
    .eq("construction_id", constructionId)
    .order("version", { ascending: false })
    .limit(1);
  const nextVersion = (existingVersions?.[0]?.version ?? 0) + 1;

  const { data: estimate, error } = await supabase
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
    .single();
  throwIfSupabaseError(error);
  return estimate;
}

export async function copyEstimateForConstruction(constructionId: string, sourceEstimateId: string, title: string, createdByName?: string) {
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

  const estimateNo = await nextEstimateNo(supabase, profile.company_id);

  const { data: existingVersions } = await supabase
    .from("estimates")
    .select("version")
    .eq("construction_id", constructionId)
    .order("version", { ascending: false })
    .limit(1);
  const nextVersion = (existingVersions?.[0]?.version ?? 0) + 1;

  const { data: newEstimate, error } = await supabase
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
    .single();
  throwIfSupabaseError(error);

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

async function recalculateEstimateTotals(
  supabase: Awaited<ReturnType<typeof createClient>>,
  estimateId: string,
) {
  const { data: items, error: itemsError } = await supabase
    .from("estimate_items")
    .select("selling_amount, cost_amount")
    .eq("estimate_id", estimateId);
  throwIfSupabaseError(itemsError);

  const subtotal = (items ?? []).reduce((sum, item) => sum + Number(item.selling_amount ?? 0), 0);
  const costTotal = (items ?? []).reduce((sum, item) => sum + Number(item.cost_amount ?? 0), 0);
  const tax = Math.floor(subtotal * 0.1);
  const total = subtotal + tax;
  const grossProfit = subtotal - costTotal;
  const grossProfitRate = subtotal > 0 ? (grossProfit / subtotal) * 100 : 0;

  const totals = { subtotal, tax, total, cost_total: costTotal, gross_profit: grossProfit, gross_profit_rate: grossProfitRate };

  const { error } = await supabase
    .from("estimates")
    .update({
      ...totals,
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

export async function addEstimateItem(estimateId: string, categoryId: string, name?: string) {
  const trimmed = name?.trim() ?? "";

  const { supabase, companyId } = await assertEstimateAccess(estimateId);

  const [{ data: category, error: catError }, { data: existing }] = await Promise.all([
    supabase
      .from("estimate_categories")
      .select("id")
      .eq("id", categoryId)
      .eq("estimate_id", estimateId)
      .single(),
    supabase
      .from("estimate_items")
      .select("sort_order")
      .eq("estimate_id", estimateId)
      .eq("category_id", categoryId)
      .order("sort_order", { ascending: false })
      .limit(1),
  ]);
  throwIfSupabaseError(catError);
  if (!category) throw new Error("大項目が見つかりません");

  const sortOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const { data: item, error } = await supabase
    .from("estimate_items")
    .insert({
      company_id: companyId,
      estimate_id: estimateId,
      category_id: categoryId,
      name: trimmed,
      quantity: 1,
      unit: "式",
      cost_price: 0,
      cost_amount: 0,
      selling_price: 0,
      selling_amount: 0,
      gross_profit: 0,
      gross_profit_rate: 0,
      sort_order: sortOrder,
    })
    .select()
    .single();
  throwIfSupabaseError(error);

  await recalculateEstimateTotals(supabase, estimateId);
  return item;
}

export type EstimateItemUpdatePatch = {
  name?: string;
  specification?: string | null;
  notes?: string | null;
  quantity?: number;
  unit?: string | null;
  cost_price?: number;
  selling_price?: number;
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

  const quantity = patch.quantity ?? Number(current.quantity) ?? 0;
  const costPrice = patch.cost_price ?? Number(current.cost_price) ?? 0;
  const sellingPrice = patch.selling_price ?? Number(current.selling_price) ?? 0;
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
      .select("*, craftsman:craftsmen(id, name)")
      .single();
    if (error) throw error;
    created.push(data);
  }

  return created;
}
