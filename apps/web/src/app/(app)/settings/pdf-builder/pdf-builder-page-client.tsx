"use client";

import { useQuery } from "@tanstack/react-query";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";
import { fetchPdfFormTemplates, LIST_STALE_MS, QK } from "@/lib/queries/portal";
import { PdfBuilderClient } from "./pdf-builder-client";

export function PdfBuilderPageClient() {
  const { data, isPending } = useQuery({
    queryKey: QK.pdfTemplates,
    queryFn: fetchPdfFormTemplates,
    staleTime: LIST_STALE_MS,
  });

  if (isPending || data === undefined) return <PageLoadingFallback />;
  return <PdfBuilderClient initialTemplates={data} />;
}
