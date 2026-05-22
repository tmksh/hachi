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

export async function getInvoice(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*, customer:customers(id, name, company_name, address), construction:constructions(id, title)")
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
