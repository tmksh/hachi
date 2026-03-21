"use server";

import { createClient } from "@/lib/supabase/server";
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
