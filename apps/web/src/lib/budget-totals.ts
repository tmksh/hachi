/** The editor and list must use the same gross-profit definition. */
export function budgetPlanTotals(
  items: ReadonlyArray<{ category: string | null; amount: number }>,
) {
  let revenue = 0;
  let cost = 0;
  for (const item of items) {
    if (item.category === "revenue") revenue += item.amount;
    // Indirect expenses are kept in the budget, but are not direct construction cost.
    if (item.category === "direct_cost") cost += item.amount;
  }
  return { revenue, cost, grossProfit: revenue - cost };
}
