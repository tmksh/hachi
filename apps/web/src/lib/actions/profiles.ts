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
  invoice_closing_day?: "20" | "end_of_month";
  cloudsign?: { enabled?: boolean; api_key?: string; client_id?: string };
  attendance_settings?: Record<string, unknown>;
  role_permissions?: Record<string, string[]>;
  custom_roles?: Array<{ id: string; name: string; base_role: string; color: string }>;
  pdf_templates?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase.from("profiles").select("company_id, role").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");
  if (profile.role !== "hq_admin") throw new Error("権限がありません");

  const { data: current } = await supabase.from("companies").select("settings").eq("id", profile.company_id).single();

  const newSettings = {
    ...(current?.settings ?? {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.address !== undefined ? { address: input.address } : {}),
    ...(input.postal_code !== undefined ? { postal_code: input.postal_code } : {}),
    ...(input.representative !== undefined ? { representative: input.representative } : {}),
    ...(input.invoice_number !== undefined ? { invoice_number: input.invoice_number } : {}),
    ...(input.invoice_closing_day !== undefined ? { invoice_closing_day: input.invoice_closing_day } : {}),
    ...(input.cloudsign !== undefined ? {
      cloudsign: {
        ...((current?.settings as Record<string, unknown> | null)?.cloudsign as Record<string, unknown> ?? {}),
        ...input.cloudsign,
      },
    } : {}),
    ...(input.attendance_settings !== undefined ? { attendance_settings: input.attendance_settings } : {}),
    ...(input.role_permissions !== undefined ? { role_permissions: input.role_permissions } : {}),
    ...(input.custom_roles !== undefined ? { custom_roles: input.custom_roles } : {}),
    ...(input.pdf_templates !== undefined ? { pdf_templates: input.pdf_templates } : {}),
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
