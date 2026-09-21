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
  getAdminUsageSummary,
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
    usage,
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
    getAdminUsageSummary(),
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
    companyUsage: usage.companyUsage,
    aiUsage: usage.aiUsage,
  };
}

export function AdminPageClient() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["admin-bundle"],
    queryFn: fetchAdminBundle,
    staleTime: LIST_STALE_MS,
  });

  if (isError) return (
    <div role="alert" className="p-6 space-y-3">
      <p>運営管理データを取得できませんでした。</p>
      <button type="button" className="underline" onClick={() => void refetch()}>再読み込み</button>
    </div>
  );
  if (isPending || !data) return <PageLoadingFallback />;
  return <AdminClient initialData={data} />;
}
