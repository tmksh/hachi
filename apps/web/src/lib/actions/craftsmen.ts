"use server";

import { createClient } from "@/lib/supabase/server";
import type { Craftsman } from "@/lib/database.types";
import {
  createCraftsmanMasterItem,
  deleteCraftsmanMasterItem,
  listCraftsmanMasterItems,
} from "@/lib/craftsmen-master";
import { CACHE_TTL, cachedByCompany, invalidateMyCompanyCache } from "@/lib/supabase/auth-context";

export async function getCraftsmen() {
  return cachedByCompany("craftsmen", CACHE_TTL.list, loadCraftsmen);
}

async function loadCraftsmen() {
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

// ── システム予約業者（No.66）────────────────────
// 「未登録業者」「予備費」「経営調整費」をテナントごとに自動作成する。削除・改名不可。

const SYSTEM_CRAFTSMEN: Array<{
  system_key: "unregistered" | "reserve" | "management";
  name: string;
}> = [
  { system_key: "unregistered", name: "未登録業者" },
  { system_key: "reserve", name: "予備費" },
  { system_key: "management", name: "経営調整費" },
];

/** システム予約業者が無ければ作成する */
export async function ensureSystemCraftsmen(): Promise<void> {
  return cachedByCompany("system-craftsmen", CACHE_TTL.systemSeed, seedSystemCraftsmen);
}

async function seedSystemCraftsmen(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { data: existing } = await supabase
    .from("craftsmen")
    .select("system_key")
    .eq("company_id", profile.company_id)
    .eq("kind", "system")
    .is("deleted_at", null);
  const existingKeys = new Set((existing ?? []).map((r) => r.system_key));

  const missing = SYSTEM_CRAFTSMEN.filter((s) => !existingKeys.has(s.system_key));
  if (missing.length === 0) return;

  const { error } = await supabase.from("craftsmen").insert(
    missing.map((s) => ({
      company_id: profile.company_id,
      name: s.name,
      kind: "system",
      system_key: s.system_key,
    })),
  );
  // 同時実行時のユニーク制約違反は無視してよい
  if (error && !/duplicate|unique/i.test(error.message)) throw error;
}

export type VendorCandidate = {
  id: string;
  name: string;
  company_name: string | null;
  bank_account_kana?: string | null;
  kind: "vendor" | "system";
  system_key: "unregistered" | "reserve" | "management" | null;
};

/** 発注業者のインクリメンタルサーチ候補（システム予約含む）。無ければシステム予約をseed */
export async function getVendorCandidates(): Promise<VendorCandidate[]> {
  try {
    await ensureSystemCraftsmen();
  } catch {
    // seed失敗でも候補一覧は返す
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("craftsmen")
    .select("id, name, company_name, bank_account_kana, kind, system_key")
    .is("deleted_at", null)
    .order("kind", { ascending: false }) // system を先頭に
    .order("name")
    .limit(500);
  if (error && /bank_account_kana/i.test(error.message)) {
    const retry = await supabase
      .from("craftsmen")
      .select("id, name, company_name, kind, system_key")
      .is("deleted_at", null)
      .order("kind", { ascending: false })
      .order("name")
      .limit(500);
    if (retry.error) throw retry.error;
    return (retry.data ?? []) as VendorCandidate[];
  }
  if (error) throw error;
  return (data ?? []) as VendorCandidate[];
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
  if (error && /invoice_channel/i.test(error.message)) {
    const { invoice_channel: _channel, ...rest } = input;
    void _channel;
    const retry = await supabase
      .from("craftsmen")
      .insert({ ...rest, company_id: profile.company_id })
      .select()
      .single();
    if (retry.error) throw retry.error;
    await invalidateMyCompanyCache();
    return retry.data as Craftsman;
  }
  if (error) throw error;
  await invalidateMyCompanyCache();
  return data as Craftsman;
}

export async function updateCraftsman(id: string, input: Partial<Omit<Craftsman, "id" | "company_id" | "created_at" | "updated_at">>) {
  const supabase = await createClient();
  const { data: current } = await supabase.from("craftsmen").select("kind, name").eq("id", id).single();
  if (current?.kind === "system") {
    // システム予約は改名・種別変更不可
    if ((input.name && input.name !== current.name) || input.kind || input.system_key !== undefined) {
      throw new Error("システム予約の業者は名称・種別を変更できません");
    }
  }
  let payload: Partial<Omit<Craftsman, "id" | "company_id" | "created_at" | "updated_at">> = { ...input };
  let { data, error } = await supabase
    .from("craftsmen")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error && /invoice_channel/i.test(error.message)) {
    const { invoice_channel: _channel, ...rest } = payload;
    void _channel;
    payload = rest;
    ({ data, error } = await supabase
      .from("craftsmen")
      .update(payload)
      .eq("id", id)
      .select()
      .single());
  }
  if (error && /bank_code|bank_name_kana|bank_branch_code|bank_branch_kana/i.test(error.message)) {
    const {
      bank_code,
      bank_name_kana,
      bank_branch_code,
      bank_branch_kana,
      ...rest
    } = payload;
    const packedName = [bank_code, bank_name_kana || rest.bank_name].filter(Boolean).join(" ");
    const packedBranch = [bank_branch_code, bank_branch_kana || rest.bank_branch].filter(Boolean).join(" ");
    const { data: fallback, error: fallbackErr } = await supabase
      .from("craftsmen")
      .update({
        ...rest,
        bank_name: packedName || rest.bank_name || null,
        bank_branch: packedBranch || rest.bank_branch || null,
      })
      .eq("id", id)
      .select()
      .single();
    if (fallbackErr) throw fallbackErr;
    return fallback as Craftsman;
  }
  if (error) throw error;
  await invalidateMyCompanyCache();
  return data as Craftsman;
}

export async function deleteCraftsman(id: string) {
  const supabase = await createClient();
  const { data: current } = await supabase.from("craftsmen").select("kind").eq("id", id).single();
  if (current?.kind === "system") {
    throw new Error("システム予約の業者（未登録業者・予備費・経営調整費）は削除できません");
  }
  const { error } = await supabase
    .from("craftsmen")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  await invalidateMyCompanyCache();
}

// ── 職人マスタ CRUD ─────────────────────────

export async function getCraftsmenSpecialties() {
  return listCraftsmanMasterItems("specialties");
}

export async function createCraftsmanSpecialty(label: string) {
  const result = await createCraftsmanMasterItem("specialties", label);
  if ("error" in result) throw new Error(result.error);
  return result.item;
}

export async function deleteCraftsmanSpecialty(id: string) {
  const result = await deleteCraftsmanMasterItem("specialties", id);
  if ("error" in result) throw new Error(result.error);
}

export async function getCraftsmenQualifications() {
  return listCraftsmanMasterItems("qualifications");
}

export async function createCraftsmanQualification(label: string) {
  const result = await createCraftsmanMasterItem("qualifications", label);
  if ("error" in result) throw new Error(result.error);
  return result.item;
}

export async function deleteCraftsmanQualification(id: string) {
  const result = await deleteCraftsmanMasterItem("qualifications", id);
  if ("error" in result) throw new Error(result.error);
}
