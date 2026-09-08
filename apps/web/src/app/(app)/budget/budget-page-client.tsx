"use client";

import { useQuery } from "@tanstack/react-query";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";
import { fetchBudgets, LIST_STALE_MS, QK } from "@/lib/queries/portal";
import { BudgetClient } from "./budget-client";

export function BudgetPageClient() {
  const { data, isPending } = useQuery({
    queryKey: QK.budgets,
    queryFn: fetchBudgets,
    staleTime: LIST_STALE_MS,
  });

  if (isPending || data === undefined) return <PageLoadingFallback />;
  return <BudgetClient initialBudgets={data} />;
}
