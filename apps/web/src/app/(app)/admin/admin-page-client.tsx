"use client";

import { useQuery } from "@tanstack/react-query";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";
import {
  getAdminStats,
  getAdminCompanies,
  getAdminUsers,
  getAdminBiOverview,
  getAdminBiCompanyRanking,
  getAdminBiMonthlyTrend,
  getAdminBiStatusBreakdown,
  getAdminBiGrossRateDistribution,
  getAdminLinqAiSettings,
} from "@/lib/actions/admin";
import { LIST_STALE_MS } from "@/lib/queries/portal";
import { AdminClient } from "./admin-client";

async function fetchAdminBundle() {
  const [
    stats,
    companies,
    users,
    bi,
    biRanking,
    biTrend,
    biStatus,
    biDist,
    aiSettings,
  ] = await Promise.all([
    getAdminStats(),
    getAdminCompanies(),
    getAdminUsers(),
    getAdminBiOverview(),
    getAdminBiCompanyRanking(),
    getAdminBiMonthlyTrend(),
    getAdminBiStatusBreakdown(),
    getAdminBiGrossRateDistribution(),
    getAdminLinqAiSettings(),
  ]);
  return {
    stats,
    companies: companies ?? [],
    users: users ?? [],
    bi,
    biRanking,
    biTrend,
    biStatus,
    biDist,
    aiSettings,
  };
}

export function AdminPageClient() {
  const { data, isPending } = useQuery({
    queryKey: ["admin-bundle"],
    queryFn: fetchAdminBundle,
    staleTime: LIST_STALE_MS,
  });

  if (isPending || !data) return <PageLoadingFallback />;
  return <AdminClient initialData={data} />;
}
