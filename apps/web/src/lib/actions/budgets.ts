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

  const budgets = data ?? [];
  if (budgets.length === 0) return [];

  // 全対象年度をカバーする範囲で完了工事を一括取得し、年度別に集計する（N+1 回避）
  const years = budgets.map((b) => b.fiscal_year);
  const { start: rangeStart } = fiscalYearRange(Math.min(...years));
  const { end: rangeEnd }     = fiscalYearRange(Math.max(...years));

  const { data: constructions } = await supabase
    .from("constructions")
    .select("order_amount, actual_cost, budget_cost, end_date")
    .eq("status", "completed")
    .gte("end_date", rangeStart)
    .lte("end_date", rangeEnd);

  return budgets.map((budget) => {
    const { start, end } = fiscalYearRange(budget.fiscal_year);
    const inYear = (constructions ?? []).filter(
      (c) => c.end_date != null && c.end_date >= start && c.end_date <= end,
    );

    const actualRevenue  = inYear.reduce((s, c) => s + (c.order_amount ?? 0), 0);
    const actualCost     = inYear.reduce((s, c) => s + (c.actual_cost  ?? 0), 0);
    const budgetCostSum  = inYear.reduce((s, c) => s + (c.budget_cost  ?? 0), 0);
    const grossProfit    = actualRevenue - actualCost;

    return {
      ...budget,
      actuals: {
        revenue:      actualRevenue,
        cost:         actualCost,
        budget_cost:  budgetCostSum,
        gross_profit: grossProfit,
        gross_rate:   actualRevenue > 0 ? (grossProfit / actualRevenue) * 100 : 0,
        completed_count: inYear.length,
      },
    };
  });
}

export async function getBudget(id: string) {
  const supabase = await createClient();
  const [{ data, error }, { data: items }] = await Promise.all([
    supabase
      .from("budgets")
      .select("*")
      .eq("id", id)
      .single(),
    supabase
      .from("budget_items")
      .select("*")
      .eq("budget_id", id)
      .order("sort_order"),
  ]);
  if (error) throw error;

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

export async function updateBudget(
  id: string,
  input: Partial<Pick<Budget, "target_revenue" | "status" | "branch" | "fiscal_year">>,
  items?: Array<{ category: BudgetItem["category"]; name: string; amount: number }>,
) {
  const supabase = await createClient();
  const { error } = await supabase.from("budgets").update(input).eq("id", id);
  if (error) throw error;

  if (items) {
    const { data: budget } = await supabase.from("budgets").select("company_id").eq("id", id).single();
    if (!budget) throw new Error("Budget not found");
    await supabase.from("budget_items").delete().eq("budget_id", id);
    if (items.length > 0) {
      await supabase.from("budget_items").insert(
        items.map((item, i) => ({
          company_id: budget.company_id,
          budget_id: id,
          category: item.category,
          name: item.name,
          amount: item.amount,
          sort_order: i,
        }))
      );
    }
  }
}

export async function deleteBudget(id: string) {
  const supabase = await createClient();
  await supabase.from("budget_items").delete().eq("budget_id", id);
  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) throw error;
}
