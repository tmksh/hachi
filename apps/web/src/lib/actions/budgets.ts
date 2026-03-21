"use server";

import { createClient } from "@/lib/supabase/server";
import type { Budget, BudgetItem } from "@/lib/database.types";

export async function getBudgets() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budgets")
    .select("*, items:budget_items(*)")
    .order("fiscal_year", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getBudget(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;

  const { data: items } = await supabase
    .from("budget_items")
    .select("*")
    .eq("budget_id", id)
    .order("sort_order");

  return { ...data, items: items || [] };
}

export async function createBudget(
  input: { fiscal_year: number; branch?: string; target_revenue?: number },
  items: Array<{ category: BudgetItem["category"]; name: string; amount: number }>
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { data: budget, error } = await supabase
    .from("budgets")
    .insert({
      company_id: profile.company_id,
      fiscal_year: input.fiscal_year,
      branch: input.branch || null,
      target_revenue: input.target_revenue || 0,
      status: "draft",
      created_by: user.id,
    })
    .select()
    .single();
  if (error) throw error;

  if (items.length > 0) {
    await supabase.from("budget_items").insert(
      items.map((item, i) => ({
        company_id: profile.company_id,
        budget_id: budget.id,
        category: item.category,
        name: item.name,
        amount: item.amount,
        sort_order: i,
      }))
    );
  }

  return budget as Budget;
}

export async function updateBudget(id: string, input: Partial<Pick<Budget, "target_revenue" | "status" | "branch">>) {
  const supabase = await createClient();
  const { error } = await supabase.from("budgets").update(input).eq("id", id);
  if (error) throw error;
}
