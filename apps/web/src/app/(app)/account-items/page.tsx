import { getCompanyOrders, getProcurementMasters } from "@/lib/actions/procurement";
import { EMPTY_TRANSFER_SENDER } from "@/lib/procurement";
import { AccountItemsClient } from "./account-items-client";

export default async function AccountItemsPage() {
  const [orders, masters] = await Promise.all([
    getCompanyOrders().catch(() => []),
    getProcurementMasters().catch(() => ({
      departments: [] as string[],
      accountItems: [] as string[],
      sender: EMPTY_TRANSFER_SENDER,
      closingDay: "20" as const,
    })),
  ]);
  return <AccountItemsClient initialOrders={orders} accountItems={masters.accountItems} />;
}
