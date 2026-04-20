"use server";

import { createClient } from "@/lib/supabase/server";
import type { Budget, BudgetItem } from "@/lib/database.types";

/** 年度（4月始まり）の開始日・終了日を返す */
function fiscalYearRange(year: number) {
  return {
    start: `${year}-04-01`,
    end:   `${year + 1}-03-31`,
  };
}

export async function getBudgets() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budgets")
    .select("*, items:budget_items(*)")
    .order("fiscal_year", { ascending: false });
  if (error) throw error;

  // 各年度の完了工事実績を集計して付加する
  const enriched = await Promise.all(
    (data ?? []).map(async (budget) => {
      const { start, end } = fiscalYearRange(budget.fiscal_year);
      const { data: constructions } = await supabase
        .from("constructions")
        .select("order_amount, actual_cost, budget_cost")
        .eq("status", "completed")
        .gte("end_date", start)
        .lte("end_date", end);

      const actualRevenue  = (constructions ?? []).reduce((s, c) => s + (c.order_amount ?? 0), 0);
      const actualCost     = (constructions ?? []).reduce((s, c) => s + (c.actual_cost  ?? 0), 0);
      const budgetCostSum  = (constructions ?? []).reduce((s, c) => s + (c.budget_cost  ?? 0), 0);
      const grossProfit    = actualRevenue - actualCost;
      const completedCount = (constructions ?? []).length;

      return {
        ...budget,
        actuals: {
          revenue:      actualRevenue,
          cost:         actualCost,
          budget_cost:  budgetCostSum,
          gross_profit: grossProfit,
          gross_rate:   actualRevenue > 0 ? (grossProfit / actualRevenue) * 100 : 0,
          completed_count: completedCount,
        },
      };
    })
  );

  return enriched;
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
