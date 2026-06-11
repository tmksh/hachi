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
import { AdminClient } from "./admin-client";

export default async function AdminPage() {
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

  return (
    <AdminClient
      initialData={{
        stats,
        companies: companies ?? [],
        users: users ?? [],
        bi,
        biRanking,
        biTrend,
        biStatus,
        biDist,
        aiSettings,
      }}
    />
  );
}
