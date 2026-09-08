"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";
import { DETAIL_STALE_MS, fetchCraftsman, QK } from "@/lib/queries/portal";
import { CraftsmanEditClient } from "./craftsman-edit-client";

export function CraftsmanEditPageClient() {
  const { id } = useParams<{ id: string }>();
  const { data, isPending } = useQuery({
    queryKey: QK.craftsman(id),
    queryFn: () => fetchCraftsman(id),
    staleTime: DETAIL_STALE_MS,
    enabled: !!id,
  });

  if (isPending) return <PageLoadingFallback />;
  if (!data) return <p className="p-6 text-sm text-muted-foreground">職人が見つかりません</p>;

  return <CraftsmanEditClient id={id} initialCraftsman={data} />;
}
