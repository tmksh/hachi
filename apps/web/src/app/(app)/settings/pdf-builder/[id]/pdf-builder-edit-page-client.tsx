"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";
import type { PdfFormDocType } from "@/lib/pdf-form-template";
import {
  fetchCustomerCustomFieldKeys,
  fetchPdfFormTemplates,
  LIST_STALE_MS,
  QK,
} from "@/lib/queries/portal";
import { getSignedStorageUrl } from "@/lib/storage-browser";
import { PdfBuilderEditClient } from "./pdf-builder-edit-client";

function PdfBuilderEditPageContent() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const initDocType = (searchParams.get("type") ?? "contract") as PdfFormDocType;
  const isNew = id === "new";

  const { data: templates, isPending: tPending } = useQuery({
    queryKey: QK.pdfTemplates,
    queryFn: fetchPdfFormTemplates,
    staleTime: LIST_STALE_MS,
  });
  const initialTemplate = isNew ? null : templates?.find((t) => t.id === id) ?? null;

  const { data: pdfUrl, isPending: urlPending } = useQuery({
    queryKey: ["pdf-template-url", initialTemplate?.storagePath ?? ""],
    queryFn: () =>
      initialTemplate
        ? getSignedStorageUrl("documents", initialTemplate.storagePath).catch(() => null)
        : Promise.resolve(null),
    staleTime: LIST_STALE_MS,
    enabled: !tPending,
  });
  const { data: customFieldKeys, isPending: keysPending } = useQuery({
    queryKey: QK.customerCustomFieldKeys,
    queryFn: () => fetchCustomerCustomFieldKeys().catch(() => [] as string[]),
    staleTime: 5 * 60_000,
  });

  if (tPending || urlPending || keysPending || templates === undefined) {
    return <PageLoadingFallback />;
  }

  return (
    <PdfBuilderEditClient
      id={id}
      initDocType={initDocType}
      initialTemplate={initialTemplate}
      initialPdfUrl={pdfUrl ?? null}
      customFieldKeys={customFieldKeys ?? []}
    />
  );
}

export function PdfBuilderEditPageClient() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <PdfBuilderEditPageContent />
    </Suspense>
  );
}
