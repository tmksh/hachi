"use client";

import { useQuery } from "@tanstack/react-query";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";
import { fetchFinancialsBundle, LIST_STALE_MS, QK } from "@/lib/queries/portal";
import { FinancialsClient } from "./financials-client";

export function FinancialsPageClient() {
  const { data, isPending } = useQuery({
    queryKey: QK.financials,
    queryFn: fetchFinancialsBundle,
    staleTime: LIST_STALE_MS,
  });

  if (isPending || !data) return <PageLoadingFallback />;

  return (
    <FinancialsClient
      initialItems={data.items}
      initialStatements={data.statements}
      initialSettings={data.settings}
    />
  );
}
