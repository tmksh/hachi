import {
  getCustomers,
  getCustomerCounts,
  getUnfollowedCustomersCount,
} from "@/lib/actions/customers";
import { CrmClient } from "./crm-client";

export default async function CrmPage() {
  // 件数系は顧客一覧と独立しているため並列で取得する
  // 商談サマリーは一覧表示をブロックしない（クライアントの React Query で取得）
  const [initialCustomers, initialCounts, initialUnfollowedCount] = await Promise.all([
    getCustomers({ page: 1, limit: 50 }),
    getCustomerCounts(),
    getUnfollowedCustomersCount(),
  ]);

  return (
    <CrmClient
      initialCustomers={initialCustomers}
      initialCounts={initialCounts}
      initialUnfollowedCount={initialUnfollowedCount}
      initialDealSummaries={{}}
    />
  );
}
