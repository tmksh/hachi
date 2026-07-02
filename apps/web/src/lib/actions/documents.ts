"use server";

import { createClient } from "@/lib/supabase/server";
import { uploadToStorage } from "@/lib/storage-server";
import type { Document } from "@/lib/database.types";

// ── ドキュメントカテゴリ ─────────────────────────────────────────────

export type DocCategory = { id: string; key: string; label: string; sort_order: number };

async function getCompanyId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");
  return { supabase, company_id: profile.company_id };
}

export async function getDocumentCategories(): Promise<DocCategory[]> {
  const { supabase, company_id } = await getCompanyId();
  const { data, error } = await supabase
    .from("document_categories")
    .select("id, key, label, sort_order")
    .eq("company_id", company_id)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as DocCategory[];
}

export async function createDocumentCategory(label: string) {
  const { supabase, company_id } = await getCompanyId();
  const key = `cat_${Date.now()}`;
  const { data: existing } = await supabase
    .from("document_categories")
    .select("sort_order")
    .eq("company_id", company_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();
  const { data, error } = await supabase
    .from("document_categories")
    .insert({ company_id, key, label, sort_order: (existing?.sort_order ?? -1) + 1 })
    .select()
    .single();
  if (error) throw error;
  return data as DocCategory;
}

export async function updateDocumentCategory(id: string, label: string) {
  const { supabase } = await getCompanyId();
  const { data, error } = await supabase
    .from("document_categories")
    .update({ label })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DocCategory;
}

export async function deleteDocumentCategory(id: string) {
  const { supabase } = await getCompanyId();
  const { error } = await supabase.from("document_categories").delete().eq("id", id);
  if (error) throw error;
}

export async function getDocuments(filters?: { category?: string; customer_id?: string; construction_id?: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("documents")
    .select("*, uploader:profiles!documents_uploaded_by_fkey(id, display_name), customer:customers(id, name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (filters?.category && filters.category !== "all") {
    query = query.eq("category", filters.category);
  }
  if (filters?.customer_id) {
    query = query.eq("customer_id", filters.customer_id);
  }
  if (filters?.construction_id) {
    query = query.eq("construction_id", filters.construction_id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** 顧客に紐づくドキュメントを横断取得（CRM直接 + 全工事タブ分） */
export async function getCustomerDocumentsAll(customerId: string) {
  const supabase = await createClient();

  const { data: constructions } = await supabase
    .from("constructions")
    .select("id")
    .eq("customer_id", customerId);

  const constructionIds = (constructions ?? []).map((c) => c.id);

  const select =
    "*, uploader:profiles!documents_uploaded_by_fkey(id, display_name), customer:customers(id, name), construction:constructions(id, title)";

  let query = supabase
    .from("documents")
    .select(select)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (constructionIds.length > 0) {
    query = query.or(
      `customer_id.eq.${customerId},construction_id.in.(${constructionIds.join(",")})`,
    );
  } else {
    query = query.eq("customer_id", customerId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createDocument(input: {
  name: string;
  category?: Document["category"];
  description?: string;
  storage_path: string;
  file_name: string;
  mime_type?: string;
  size?: number;
  customer_id?: string;
  construction_id?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { data, error } = await supabase
    .from("documents")
    .insert({
      company_id: profile.company_id,
      name: input.name,
      category: input.category || null,
      description: input.description || null,
      storage_path: input.storage_path,
      file_name: input.file_name,
      mime_type: input.mime_type || null,
      size: input.size || 0,
      customer_id: input.customer_id || null,
      construction_id: input.construction_id || null,
      uploaded_by: user.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Document;
}

export async function deleteDocument(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("documents").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

/** 確定した契約書 HTML をストレージ + documents テーブルへ保存 */
export async function archiveContractDocumentHtml(input: {
  html: string;
  name: string;
  customer_id: string;
  construction_id?: string;
  contract_id?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const safeName = input.name.replace(/[^\w\u3000-\u9fff\-（）()]/g, "_").slice(0, 80);
  const path = `customers/${input.customer_id}/contracts/${Date.now()}_${Math.random().toString(36).slice(2)}_${safeName}.html`;
  const bytes = Buffer.from(input.html, "utf-8");

  await uploadToStorage("documents", path, bytes, { contentType: "text/html; charset=utf-8", upsert: false });

  const description = input.contract_id ? `source:contract:${input.contract_id}` : undefined;
  const fileName = `${input.name}.html`;

  const { data, error } = await supabase
    .from("documents")
    .insert({
      company_id: profile.company_id,
      name: input.name,
      category: "other",
      description,
      storage_path: path,
      file_name: fileName,
      mime_type: "text/html",
      size: bytes.length,
      customer_id: input.customer_id,
      construction_id: input.construction_id ?? null,
      uploaded_by: user.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Document;
}
