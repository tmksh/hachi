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
  getAdminCompanyUsage,
  getAdminAiUsage,
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
    companyUsage,
    aiUsage,
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
    getAdminCompanyUsage(),
    getAdminAiUsage(),
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
    companyUsage,
    aiUsage,
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
