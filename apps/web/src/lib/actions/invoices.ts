"use server";

import { createClient } from "@/lib/supabase/server";
import { dispatchWebhook } from "@/lib/webhooks";
import type { Invoice, InvoiceItem } from "@/lib/database.types";

export async function getInvoices() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*, customer:customers(id, name, company_name), construction:constructions(id, title)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getInvoicesForConstruction(constructionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_no, invoice_date, due_date, total, status, created_at")
    .eq("construction_id", constructionId)
    .order("invoice_date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getInvoice(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*, customer:customers(id, name, company_name, address, email), construction:constructions(id, title)")
    .eq("id", id)
    .single();
  if (error) throw error;

  const { data: items } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", id)
    .order("sort_order");

  return { ...data, items: items || [] };
}

export async function updateInvoiceStatus(id: string, status: "draft" | "sent" | "paid" | "cancelled") {
  const supabase = await createClient();
  const { data: before } = await supabase
    .from("invoices")
    .select("status, company_id, invoice_no, total, recipient")
    .eq("id", id)
    .single();

  const patch: { status: typeof status; paid_at?: string | null } = { status };
  if (status === "paid") {
    patch.paid_at = new Date().toISOString();
  } else if (before?.status === "paid") {
    patch.paid_at = null;
  }

  const { data, error } = await supabase.from("invoices").update(patch).eq("id", id).select().single();
  if (error) throw error;

  if (before && before.status !== status) {
    if (status === "sent") {
      void dispatchWebhook(data.company_id, "invoice.issued", {
        id: data.id,
        invoice_no: data.invoice_no,
        total: data.total,
        recipient: data.recipient,
      });
    }
    if (status === "paid") {
      void dispatchWebhook(data.company_id, "invoice.paid", {
        id: data.id,
        invoice_no: data.invoice_no,
        total: data.total,
        recipient: data.recipient,
        paid_at: data.paid_at,
      });
    }
  }
}

export async function updateInvoice(
  id: string,
  input: Partial<Pick<Invoice, "recipient" | "invoice_date" | "due_date" | "payment_terms" | "notes">>,
  items?: Array<{ description: string; quantity: number; unit_price: number; amount: number }>,
) {
  const supabase = await createClient();
  const { data: invoice, error } = await supabase
    .from("invoices")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;

  if (items) {
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const tax = Math.floor(subtotal * 0.1);
    await supabase.from("invoices").update({ subtotal, tax, total: subtotal + tax }).eq("id", id);
    await supabase.from("invoice_items").delete().eq("invoice_id", id);
    if (items.length > 0) {
      await supabase.from("invoice_items").insert(
        items.map((item, i) => ({
          company_id: invoice.company_id,
          invoice_id: id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
          sort_order: i,
        }))
      );
    }
  }
}

export async function deleteInvoice(id: string) {
  const supabase = await createClient();
  await supabase.from("invoice_items").delete().eq("invoice_id", id);
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) throw error;
}

export async function createInvoiceFromConstruction(constructionId: string, amount?: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { data: con } = await supabase
    .from("constructions")
    .select("id, title, customer_id, order_amount, contract_id, end_date")
    .eq("id", constructionId)
    .single();
  if (!con) throw new Error("Construction not found");

  const billAmount = amount ?? con.order_amount ?? 0;
  const subtotal = billAmount;
  const tax = Math.floor(subtotal * 0.1);

  const { count } = await supabase.from("invoices").select("*", { count: "exact", head: true });
  const invoiceNo = `INV-${String((count || 0) + 1).padStart(4, "0")}`;

  const today = new Date().toISOString().split("T")[0];

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      company_id: profile.company_id,
      invoice_no: invoiceNo,
      construction_id: constructionId,
      customer_id: con.customer_id,
      invoice_date: today,
      subtotal,
      tax,
      total: subtotal + tax,
      status: "draft",
      created_by: user.id,
    })
    .select()
    .single();
  if (error) throw error;

  await supabase.from("invoice_items").insert([{
    company_id: profile.company_id,
    invoice_id: invoice.id,
    description: con.title,
    quantity: 1,
    unit_price: subtotal,
    amount: subtotal,
    sort_order: 0,
  }]);

  return invoice as Invoice;
}

export async function createInvoice(
  input: {
    construction_id?: string;
    customer_id?: string;
    recipient?: string;
    invoice_date?: string;
    due_date?: string;
    payment_terms?: string;
  },
  items: Array<{ description: string; quantity: number; unit_price: number; amount: number }>
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { count } = await supabase.from("invoices").select("*", { count: "exact", head: true });
  const invoiceNo = `INV-${String((count || 0) + 1).padStart(4, "0")}`;

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const tax = Math.floor(subtotal * 0.1);

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      company_id: profile.company_id,
      invoice_no: invoiceNo,
      construction_id: input.construction_id || null,
      customer_id: input.customer_id || null,
      recipient: input.recipient || null,
      invoice_date: input.invoice_date || null,
      due_date: input.due_date || null,
      payment_terms: input.payment_terms || null,
      subtotal,
      tax,
      total: subtotal + tax,
      status: "draft",
      created_by: user.id,
    })
    .select()
    .single();
  if (error) throw error;

  if (items.length > 0) {
    await supabase.from("invoice_items").insert(
      items.map((item, i) => ({
        company_id: profile.company_id,
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
        sort_order: i,
      }))
    );
  }

  return invoice as Invoice;
}

type ClosingDaySetting = "20" | "end_of_month";

function getClosingDay(settings: Record<string, unknown> | null | undefined): ClosingDaySetting {
  const day = settings?.invoice_closing_day;
  return day === "20" ? "20" : "end_of_month";
}

function getBillingPeriod(reference: Date, closingDay: ClosingDaySetting) {
  const y = reference.getFullYear();
  const m = reference.getMonth();
  if (closingDay === "20") {
    const end = new Date(y, m, 20);
    const start = new Date(y, m - 1, 21);
    return { start, end, label: `${start.getFullYear()}年${start.getMonth() + 1}月21日〜${end.getFullYear()}年${end.getMonth() + 1}月20日` };
  }
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return { start, end, label: `${y}年${m + 1}月（月末締め）` };
}

function monthsBetween(start: string, end: string): number {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  return Math.max(1, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1);
}

/** 工程表・締日に基づく月次請求の自動生成 */
export async function generateMonthlyInvoices(constructionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { data: company } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", profile.company_id)
    .single();
  const closingDay = getClosingDay(company?.settings as Record<string, unknown>);

  const { data: con } = await supabase
    .from("constructions")
    .select("id, title, customer_id, order_amount, start_date, end_date")
    .eq("id", constructionId)
    .single();
  if (!con?.start_date || !con?.end_date) {
    throw new Error("工期（開始日・終了日）を設定してください");
  }

  const monthCount = monthsBetween(con.start_date, con.end_date);
  const monthlyAmount = Math.floor((con.order_amount ?? 0) / monthCount);
  const created = [];

  for (let i = 0; i < monthCount; i++) {
    const ref = new Date(con.start_date + "T00:00:00");
    ref.setMonth(ref.getMonth() + i);
    const period = getBillingPeriod(ref, closingDay);

    const invoiceDate = period.end.toISOString().split("T")[0];
    const dueDate = new Date(period.end);
    dueDate.setMonth(dueDate.getMonth() + 1);
    if (closingDay === "20") {
      dueDate.setDate(20);
    } else {
      dueDate.setMonth(dueDate.getMonth() + 1);
      dueDate.setDate(0);
    }

    const { data: existing } = await supabase
      .from("invoices")
      .select("id")
      .eq("construction_id", constructionId)
      .eq("invoice_date", invoiceDate)
      .maybeSingle();
    if (existing) continue;

    const amount = i === monthCount - 1
      ? (con.order_amount ?? 0) - monthlyAmount * (monthCount - 1)
      : monthlyAmount;
    const subtotal = amount;
    const tax = Math.floor(subtotal * 0.1);

    const { count } = await supabase.from("invoices").select("*", { count: "exact", head: true });
    const invoiceNo = `INV-${String((count || 0) + 1).padStart(4, "0")}`;

    const { data: invoice, error } = await supabase
      .from("invoices")
      .insert({
        company_id: profile.company_id,
        invoice_no: invoiceNo,
        construction_id: constructionId,
        customer_id: con.customer_id,
        invoice_date: invoiceDate,
        due_date: dueDate.toISOString().split("T")[0],
        payment_terms: closingDay === "20" ? "20日締め翌月20日払い" : "月末締め翌月末払い",
        subtotal,
        tax,
        total: subtotal + tax,
        status: "draft",
        notes: `${period.label} 分`,
        created_by: user.id,
      })
      .select()
      .single();
    if (error) throw error;

    await supabase.from("invoice_items").insert({
      company_id: profile.company_id,
      invoice_id: invoice.id,
      description: `${con.title}（${period.label}）`,
      quantity: 1,
      unit_price: subtotal,
      amount: subtotal,
      sort_order: 0,
    });

    created.push(invoice);
  }

  return created;
}

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 指定月（YYYY-MM）の締日ベースで、対象工事の月次請求書を一括生成する */
export async function generateMonthlyInvoicesForMonth(month: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const [y, m] = month.split("-").map(Number);
  if (!y || !m) throw new Error("対象月の形式が不正です");

  const { data: company } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", profile.company_id)
    .single();
  const closingDay = getClosingDay(company?.settings as Record<string, unknown>);
  const period = getBillingPeriod(new Date(y, m - 1, 1), closingDay);

  const invoiceDate = toLocalDateString(period.end);
  // 支払期限は翌月末
  const dueDate = toLocalDateString(new Date(period.end.getFullYear(), period.end.getMonth() + 2, 0));

  const monthStart = toLocalDateString(new Date(y, m - 1, 1));
  const monthEnd = toLocalDateString(new Date(y, m, 0));

  const { data: constructions } = await supabase
    .from("constructions")
    .select("id, title, customer_id, order_amount")
    .in("status", ["in_progress", "completed"])
    .gt("order_amount", 0);

  const { data: existingInvoices } = await supabase
    .from("invoices")
    .select("construction_id")
    .gte("invoice_date", monthStart)
    .lte("invoice_date", monthEnd)
    .not("construction_id", "is", null);
  const invoicedIds = new Set((existingInvoices ?? []).map((r) => r.construction_id as string));

  const targets = (constructions ?? []).filter((c) => !invoicedIds.has(c.id));
  const skipped = (constructions ?? []).length - targets.length;

  const { count } = await supabase.from("invoices").select("*", { count: "exact", head: true });
  let seq = count || 0;
  let created = 0;

  for (const con of targets) {
    const subtotal = con.order_amount as number;
    const tax = Math.floor(subtotal * 0.1);
    seq += 1;
    const invoiceNo = `INV-${String(seq).padStart(4, "0")}`;

    const { data: invoice, error } = await supabase
      .from("invoices")
      .insert({
        company_id: profile.company_id,
        invoice_no: invoiceNo,
        construction_id: con.id,
        customer_id: con.customer_id,
        invoice_date: invoiceDate,
        due_date: dueDate,
        payment_terms: closingDay === "20" ? "20日締め翌月末払い" : "月末締め翌月末払い",
        subtotal,
        tax,
        total: subtotal + tax,
        status: "draft",
        notes: `${period.label} 分（月次一括生成）`,
        created_by: user.id,
      })
      .select()
      .single();
    if (error) throw error;

    await supabase.from("invoice_items").insert({
      company_id: profile.company_id,
      invoice_id: invoice.id,
      description: `${con.title}（${period.label}）`,
      quantity: 1,
      unit_price: subtotal,
      amount: subtotal,
      sort_order: 0,
    });

    created += 1;
  }

  return { created, skipped };
}

/** 請求書を顧客へメール送付し、送付済みステータスに更新する */
export async function sendInvoiceEmail(
  id: string,
  input: { to: string; subject: string; body: string },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const to = input.to.trim();
  if (!to) throw new Error("宛先メールアドレスを入力してください");

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, company_id, invoice_no, status")
    .eq("id", id)
    .single();
  if (!invoice) throw new Error("請求書が見つかりません");

  if (!process.env.RESEND_API_KEY) {
    await updateInvoiceStatus(id, "sent");
    return { sent: false as const };
  }

  const { getResend, CUSTOMER_FROM_EMAIL } = await import("@/lib/resend");
  const escaped = input.body
    .split("\n")
    .map((line) => `<p style="margin:0 0 8px;white-space:pre-wrap;">${line.replace(/</g, "&lt;").replace(/>/g, "&gt;") || "&nbsp;"}</p>`)
    .join("");

  const { error: mailError } = await getResend().emails.send({
    from: CUSTOMER_FROM_EMAIL,
    to,
    subject: input.subject.trim() || `請求書のご送付（${invoice.invoice_no ?? ""}）`,
    html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;">${escaped}</div>`,
    text: input.body,
  });
  if (mailError) {
    throw new Error(`メール送信に失敗しました: ${mailError.message}`);
  }

  await updateInvoiceStatus(id, "sent");
  return { sent: true as const, sentTo: to };
}
