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

async function getCraftsmenCompanyId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");
  return { supabase, company_id: profile.company_id };
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
  const { supabase, company_id } = await getCraftsmenCompanyId();
  const { data: last } = await supabase.from("craftsmen_specialties").select("sort_order").eq("company_id", company_id).order("sort_order", { ascending: false }).limit(1).single();
  const { data, error } = await supabase.from("craftsmen_specialties").insert({ company_id, label, sort_order: (last?.sort_order ?? -1) + 1 }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCraftsmanSpecialty(id: string) {
  const { supabase } = await getCraftsmenCompanyId();
  const { error } = await supabase.from("craftsmen_specialties").delete().eq("id", id);
  if (error) throw error;
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
  const { supabase, company_id } = await getCraftsmenCompanyId();
  const { data: last } = await supabase.from("craftsmen_qualifications").select("sort_order").eq("company_id", company_id).order("sort_order", { ascending: false }).limit(1).single();
  const { data, error } = await supabase.from("craftsmen_qualifications").insert({ company_id, label, sort_order: (last?.sort_order ?? -1) + 1 }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCraftsmanQualification(id: string) {
  const { supabase } = await getCraftsmenCompanyId();
  const { error } = await supabase.from("craftsmen_qualifications").delete().eq("id", id);
  if (error) throw error;
}
