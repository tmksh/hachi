import {
  getCustomers,
  getCustomerCounts,
  getUnfollowedCustomersCount,
  getCustomerDealSummaries,
} from "@/lib/actions/customers";
import { CrmClient } from "./crm-client";

export default async function CrmPage() {
  const initialCustomers = await getCustomers({ page: 1, limit: 50 });
  const customerIds = initialCustomers.customers.map((c) => c.id);

  const [initialCounts, initialUnfollowedCount, initialDealSummaries] = await Promise.all([
    getCustomerCounts(),
    getUnfollowedCustomersCount(),
    getCustomerDealSummaries(customerIds),
  ]);

  return (
    <CrmClient
      initialCustomers={initialCustomers}
      initialCounts={initialCounts}
      initialUnfollowedCount={initialUnfollowedCount}
      initialDealSummaries={initialDealSummaries}
    />
  );
}
