"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";
import { DETAIL_STALE_MS, fetchInvoice, QK } from "@/lib/queries/portal";
import { InvoiceDetailClient } from "./invoice-detail-client";

export function InvoiceDetailPageClient() {
  const { id } = useParams<{ id: string }>();
  const { data, isPending } = useQuery({
    queryKey: QK.invoice(id),
    queryFn: () => fetchInvoice(id).catch(() => null),
    staleTime: DETAIL_STALE_MS,
    enabled: !!id,
  });

  if (isPending) return <PageLoadingFallback />;
  return <InvoiceDetailClient initialData={data ?? null} />;
}
