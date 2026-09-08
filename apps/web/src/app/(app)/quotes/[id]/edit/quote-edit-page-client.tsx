"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";
import { fetchEstimate } from "@/lib/queries/details";
import { fetchCustomers } from "@/lib/queries/customers";
import { LIST_STALE_MS } from "@/lib/queries/lists";
import { DETAIL_STALE_MS } from "@/lib/queries/portal";
import { QuoteEditClient } from "./quote-edit-client";

export function QuoteEditPageClient() {
  const { id } = useParams<{ id: string }>();
  const { data: estimate, isPending: ePending } = useQuery({
    queryKey: ["estimate", id],
    queryFn: () => fetchEstimate(id).catch(() => null),
    staleTime: DETAIL_STALE_MS,
    enabled: !!id,
  });
  const { data: customerResult, isPending: cPending } = useQuery({
    queryKey: ["quotes-customers"],
    queryFn: () => fetchCustomers({ page: 1, limit: 100 }).then((r) => r.customers),
    staleTime: LIST_STALE_MS,
  });

  if (ePending || cPending) return <PageLoadingFallback />;

  return (
    <QuoteEditClient
      initialEstimate={estimate ?? null}
      initialCustomers={(customerResult ?? []).map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
