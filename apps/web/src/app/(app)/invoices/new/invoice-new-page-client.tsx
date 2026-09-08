"use client";

import { useQuery } from "@tanstack/react-query";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";
import { fetchCustomers } from "@/lib/queries/customers";
import { fetchConstructions, LIST_STALE_MS } from "@/lib/queries/lists";
import { InvoiceNewClient } from "./invoice-new-client";

export function InvoiceNewPageClient() {
  const { data: customerResult, isPending: cPending } = useQuery({
    queryKey: ["customers", 1, ""],
    queryFn: () => fetchCustomers({ page: 1, limit: 100 }),
    staleTime: LIST_STALE_MS,
  });
  const { data: constructions, isPending: nPending } = useQuery({
    queryKey: ["constructions"],
    queryFn: fetchConstructions,
    staleTime: LIST_STALE_MS,
  });

  if (cPending || nPending || !customerResult || !constructions) {
    return <PageLoadingFallback />;
  }

  return (
    <InvoiceNewClient
      initialCustomers={customerResult.customers.map((x) => ({ id: x.id, name: x.name }))}
      initialConstructions={constructions.map((x) => ({ id: x.id, title: x.title }))}
    />
  );
}
