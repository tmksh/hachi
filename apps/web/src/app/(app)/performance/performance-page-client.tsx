"use client";

import { useQuery } from "@tanstack/react-query";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";
import { fetchPerformance, LIST_STALE_MS, QK } from "@/lib/queries/portal";
import { getCurrentFiscalYear } from "@/lib/bi-utils";
import { PerformanceClient } from "./performance-client";

export function PerformancePageClient() {
  const year = getCurrentFiscalYear();
  const { data, isPending } = useQuery({
    queryKey: QK.performance(year),
    queryFn: () => fetchPerformance(year),
    staleTime: LIST_STALE_MS,
  });

  if (isPending) return <PageLoadingFallback />;
  return <PerformanceClient initialData={data ?? null} />;
}
