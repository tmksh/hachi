"use server";

import { createClient } from "@/lib/supabase/server";

const SUPER_ADMIN_EMAIL = "admin@example.com";

async function assertSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== SUPER_ADMIN_EMAIL) {
    throw new Error("Unauthorized");
  }
  return supabase;
}

export async function getAdminStats() {
  const supabase = await assertSuperAdmin();

  const [
    { count: companyCount },
    { count: userCount },
    { count: constructionCount },
    { count: contractCount },
  ] = await Promise.all([
    supabase.from("companies").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("constructions").select("*", { count: "exact", head: true }),
    supabase.from("contracts").select("*", { count: "exact", head: true }),
  ]);

  return {
    companyCount: companyCount ?? 0,
    userCount: userCount ?? 0,
    constructionCount: constructionCount ?? 0,
    contractCount: contractCount ?? 0,
  };
}

export async function getAdminCompanies() {
  const supabase = await assertSuperAdmin();

  const { data, error } = await supabase
    .from("companies")
    .select("id, name, plan, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getAdminUsers() {
  const supabase = await assertSuperAdmin();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, role, company_id, created_at, companies(name)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as Array<{
    id: string;
    display_name: string;
    email: string;
    role: string;
    company_id: string;
    created_at: string;
    companies: { name: string } | null;
  }>;
}
