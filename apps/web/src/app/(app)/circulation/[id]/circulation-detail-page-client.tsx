"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";
import { extractDetailHref } from "@/lib/notification-href";
import { DETAIL_STALE_MS, fetchAnnouncement, QK } from "@/lib/queries/portal";
import { CirculationDetailClient } from "./circulation-detail-client";

export function CirculationDetailPageClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isPending } = useQuery({
    queryKey: QK.announcement(id),
    queryFn: () => fetchAnnouncement(id).catch(() => null),
    staleTime: DETAIL_STALE_MS,
    enabled: !!id,
  });

  const actionHref = extractDetailHref(data?.body);
  useEffect(() => {
    if (actionHref) router.replace(actionHref);
  }, [actionHref, router]);

  if (isPending || actionHref) return <PageLoadingFallback />;
  return <CirculationDetailClient initialData={data ?? null} />;
}
