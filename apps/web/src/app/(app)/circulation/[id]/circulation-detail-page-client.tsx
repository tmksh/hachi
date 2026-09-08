"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";
import { DETAIL_STALE_MS, fetchAnnouncement, QK } from "@/lib/queries/portal";
import { CirculationDetailClient } from "./circulation-detail-client";

export function CirculationDetailPageClient() {
  const { id } = useParams<{ id: string }>();
  const { data, isPending } = useQuery({
    queryKey: QK.announcement(id),
    queryFn: () => fetchAnnouncement(id).catch(() => null),
    staleTime: DETAIL_STALE_MS,
    enabled: !!id,
  });

  if (isPending) return <PageLoadingFallback />;
  return <CirculationDetailClient initialData={data ?? null} />;
}
