"use server";

import { createClient } from "@/lib/supabase/server";

export type CostBudgetRow = {
  id: string;
  status: "発注済" | "未発注";
  name: string;
  work_type: string;
  budget: number;
  add_contracts: number[];
  management_budget: number;
  order_amount: number;
  add_orders: number[];
  monthly: Partial<Record<string, number>>;
};

export type CostBudgetComment = {
  id: string;
  cellKey: string;
  author: string;
  avatarInitial: string;
  avatarColor: string;
  text: string;
  createdAt: string;
};

export async function getCostBudget(constructionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("construction_cost_budgets")
    .select("*")
    .eq("construction_id", constructionId)
    .maybeSingle();
  if (error) throw error;
  return data as {
    id: string;
    contract_amount: number;
    period_start: string;
    rows: CostBudgetRow[];
    comments: CostBudgetComment[];
  } | null;
}

export async function saveCostBudget(input: {
  constructionId: string;
  contractAmount: number;
  periodStart: string;
  rows: CostBudgetRow[];
  comments: CostBudgetComment[];
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const payload = {
    company_id: profile.company_id,
    construction_id: input.constructionId,
    contract_amount: input.contractAmount,
    period_start: input.periodStart,
    rows: input.rows,
    comments: input.comments,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from("construction_cost_budgets")
    .select("id")
    .eq("construction_id", input.constructionId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("construction_cost_budgets")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("construction_cost_budgets").insert(payload);
    if (error) throw error;
  }
}
