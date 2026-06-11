import { getBudgets } from "@/lib/actions/budgets";
import { BudgetClient } from "./budget-client";

export default async function BudgetPage() {
  const initialBudgets = await getBudgets().catch(() => []);

  return <BudgetClient initialBudgets={initialBudgets} />;
}
