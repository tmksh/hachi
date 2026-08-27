import { getCompanyOrders, getProcurementMasters } from "@/lib/actions/procurement";
import { EMPTY_TRANSFER_SENDER } from "@/lib/procurement";
import { FulfillmentClient } from "./fulfillment-client";

export default async function FulfillmentPage() {
  const [orders, masters] = await Promise.all([
    getCompanyOrders().catch(() => []),
    getProcurementMasters().catch(() => ({
      departments: [] as string[],
      accountItems: [] as string[],
      sender: EMPTY_TRANSFER_SENDER,
    })),
  ]);
  return <FulfillmentClient initialOrders={orders} departments={masters.departments} />;
}
