"use server";

import { createClient } from "@/lib/supabase/server";
import type { Craftsman } from "@/lib/database.types";

export async function getCraftsmen() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("craftsmen")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data as Craftsman[];
}

export async function getCraftsman(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("craftsmen")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Craftsman;
}

export async function createCraftsman(input: Omit<Craftsman, "id" | "company_id" | "created_at" | "updated_at" | "deleted_at">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { data, error } = await supabase
    .from("craftsmen")
    .insert({ ...input, company_id: profile.company_id })
    .select()
    .single();
  if (error) throw error;
  return data as Craftsman;
}

export async function updateCraftsman(id: string, input: Partial<Omit<Craftsman, "id" | "company_id" | "created_at" | "updated_at">>) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("craftsmen")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Craftsman;
}

export async function deleteCraftsman(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("craftsmen")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ── 職人マスタ CRUD ─────────────────────────

const MASTER_ADMIN_ROLES = new Set(["hq_admin", "admin", "owner"]);

function isRlsOrPermissionError(message: string): boolean {
  return /row-level security|permission denied|42501|403/i.test(message);
}

async function getCraftsmenMasterContext(opts?: { requireAdmin?: boolean }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("プロフィールが見つかりません");
  if (opts?.requireAdmin && !MASTER_ADMIN_ROLES.has(profile.role)) {
    throw new Error("マスタの編集は本部管理者のみ可能です");
  }
  return { supabase, company_id: profile.company_id as string, role: profile.role as string };
}

async function nextSortOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "craftsmen_specialties" | "craftsmen_qualifications",
  company_id: string,
): Promise<number> {
  // .single() は 0 件でエラーになるため maybeSingle を使う
  const { data: last } = await supabase
    .from(table)
    .select("sort_order")
    .eq("company_id", company_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (last?.sort_order ?? -1) + 1;
}

async function insertMasterRow(
  table: "craftsmen_specialties" | "craftsmen_qualifications",
  company_id: string,
  label: string,
) {
  const trimmed = label.trim();
  if (!trimmed) throw new Error("名称を入力してください");

  const { supabase } = await getCraftsmenMasterContext({ requireAdmin: true });
  const sort_order = await nextSortOrder(supabase, table, company_id);
  const row = { company_id, label: trimmed, sort_order };

  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (!error && data) return data;

  const message = error?.message ?? "追加に失敗しました";
  // リモートに新 RLS 未適用でも管理者操作は通す
  if (isRlsOrPermissionError(message)) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const retry = await admin.from(table).insert(row).select().single();
    if (retry.error) {
      if (/duplicate|unique/i.test(retry.error.message)) {
        throw new Error("同じ名称は既に登録されています");
      }
      throw new Error(retry.error.message);
    }
    return retry.data;
  }
  if (/duplicate|unique/i.test(message)) {
    throw new Error("同じ名称は既に登録されています");
  }
  throw new Error(message);
}

async function deleteMasterRow(
  table: "craftsmen_specialties" | "craftsmen_qualifications",
  id: string,
) {
  const { supabase, company_id } = await getCraftsmenMasterContext({ requireAdmin: true });
  const { error } = await supabase.from(table).delete().eq("id", id).eq("company_id", company_id);
  if (!error) return;

  const message = error.message ?? "削除に失敗しました";
  if (isRlsOrPermissionError(message)) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const retry = await admin.from(table).delete().eq("id", id).eq("company_id", company_id);
    if (retry.error) throw new Error(retry.error.message);
    return;
  }
  throw new Error(message);
}

export async function getCraftsmenSpecialties() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) return [];
  const { data } = await supabase.from("craftsmen_specialties").select("*").eq("company_id", profile.company_id).order("sort_order");
  return data ?? [];
}

export async function createCraftsmanSpecialty(label: string) {
  const { company_id } = await getCraftsmenMasterContext({ requireAdmin: true });
  return insertMasterRow("craftsmen_specialties", company_id, label);
}

export async function deleteCraftsmanSpecialty(id: string) {
  return deleteMasterRow("craftsmen_specialties", id);
}

export async function getCraftsmenQualifications() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) return [];
  const { data } = await supabase.from("craftsmen_qualifications").select("*").eq("company_id", profile.company_id).order("sort_order");
  return data ?? [];
}

export async function createCraftsmanQualification(label: string) {
  const { company_id } = await getCraftsmenMasterContext({ requireAdmin: true });
  return insertMasterRow("craftsmen_qualifications", company_id, label);
}

export async function deleteCraftsmanQualification(id: string) {
  await deleteMasterRow("craftsmen_qualifications", id);
}
