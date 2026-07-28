"use server";

import { createClient } from "@/lib/supabase/server";
import type { Craftsman } from "@/lib/database.types";
import {
  createCraftsmanMasterItem,
  deleteCraftsmanMasterItem,
  listCraftsmanMasterItems,
} from "@/lib/craftsmen-master";

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
