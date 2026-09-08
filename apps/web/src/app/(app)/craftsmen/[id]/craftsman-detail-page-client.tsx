"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";
import { DETAIL_STALE_MS, fetchCraftsman, QK } from "@/lib/queries/portal";
import { CraftsmanDetailClient } from "./craftsman-detail-client";

export function CraftsmanDetailPageClient() {
  const { id } = useParams<{ id: string }>();
  const { data, isPending } = useQuery({
    queryKey: QK.craftsman(id),
    queryFn: () => fetchCraftsman(id).catch(() => null),
    staleTime: DETAIL_STALE_MS,
    enabled: !!id,
  });

  if (isPending) return <PageLoadingFallback />;
  return <CraftsmanDetailClient initialData={data ?? null} />;
}
