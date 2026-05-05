"use server";

import { createClient } from "@/lib/supabase/server";
import type { Profile, Company } from "@/lib/database.types";

export async function getProfiles() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("display_name");
  if (error) throw error;
  return data as Profile[];
}

export async function getProfile(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function updateProfile(input: Partial<Pick<Profile, "display_name" | "phone" | "department" | "position" | "avatar_url">>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("profiles")
    .update(input)
    .eq("id", user.id)
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function getCompany() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", profile.company_id)
    .single();
  if (error) throw error;
  return data as Company;
}

export async function updateCompany(input: {
  name?: string;
  phone?: string;
  address?: string;
  postal_code?: string;
  representative?: string;
  invoice_number?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase.from("profiles").select("company_id, role").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");
  if (!["owner", "hq_admin"].includes(profile.role)) throw new Error("権限がありません");

  const { data: current } = await supabase.from("companies").select("settings").eq("id", profile.company_id).single();

  const newSettings = {
    ...(current?.settings ?? {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.address !== undefined ? { address: input.address } : {}),
    ...(input.postal_code !== undefined ? { postal_code: input.postal_code } : {}),
    ...(input.representative !== undefined ? { representative: input.representative } : {}),
    ...(input.invoice_number !== undefined ? { invoice_number: input.invoice_number } : {}),
  };

  const updatePayload: Record<string, unknown> = { settings: newSettings };
  if (input.name !== undefined) updatePayload.name = input.name;

  const { data, error } = await supabase
    .from("companies")
    .update(updatePayload)
    .eq("id", profile.company_id)
    .select()
    .single();
  if (error) throw error;
  return data as Company;
}
