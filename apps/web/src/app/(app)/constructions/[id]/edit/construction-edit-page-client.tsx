"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";
import { fetchConstruction } from "@/lib/queries/details";
import { fetchDepartmentNames, fetchCompanyLocations } from "@/lib/queries/portal";
import { DETAIL_STALE_MS } from "@/lib/queries/portal";
import { ConstructionEditClient } from "./construction-edit-client";

export function ConstructionEditPageClient() {
  const { id } = useParams<{ id: string }>();
  const { data: construction, isPending: cPending } = useQuery({
    queryKey: ["construction", id],
    queryFn: () => fetchConstruction(id),
    staleTime: DETAIL_STALE_MS,
    enabled: !!id,
  });
  const { data: departments = [], isPending: dPending } = useQuery({
    queryKey: ["bi-departments"],
    queryFn: () => fetchDepartmentNames().catch(() => [] as string[]),
    staleTime: 5 * 60_000,
  });
  const { data: locations = [], isPending: lPending } = useQuery({
    queryKey: ["company-locations"],
    queryFn: () => fetchCompanyLocations().catch(() => []),
    staleTime: 5 * 60_000,
  });

  if (cPending || dPending || lPending) return <PageLoadingFallback />;
  if (!construction) {
    return <p className="p-6 text-sm text-muted-foreground">工事が見つかりません</p>;
  }

  return (
    <ConstructionEditClient
      id={id}
      initialConstruction={construction}
      initialDepartments={departments}
      initialLocations={locations}
    />
  );
}
