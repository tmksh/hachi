import {
  getCustomers,
  getCustomerCounts,
  getUnfollowedCustomersCount,
  getCustomerDealSummaries,
} from "@/lib/actions/customers";
import { CrmClient } from "./crm-client";

export default async function CrmPage() {
  // 件数系は顧客一覧と独立しているため並列で取得する
  const [initialCustomers, initialCounts, initialUnfollowedCount] = await Promise.all([
    getCustomers({ page: 1, limit: 50 }),
    getCustomerCounts(),
    getUnfollowedCustomersCount(),
  ]);
  const customerIds = initialCustomers.customers.map((c) => c.id);
  const initialDealSummaries = await getCustomerDealSummaries(customerIds);

  return (
    <CrmClient
      initialCustomers={initialCustomers}
      initialCounts={initialCounts}
      initialUnfollowedCount={initialUnfollowedCount}
      initialDealSummaries={initialDealSummaries}
    />
  );
}
