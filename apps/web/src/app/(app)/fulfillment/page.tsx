import { getCompanyOrders, getProcurementMasters } from "@/lib/actions/procurement";
import { FulfillmentClient } from "./fulfillment-client";

export default async function FulfillmentPage() {
  const [orders, masters] = await Promise.all([
    getCompanyOrders().catch(() => []),
    getProcurementMasters().catch(() => ({
      departments: [] as string[],
      accountItems: [] as string[],
      sender: {
        bankName: "",
        branchName: "",
        accountType: "普通",
        accountNumber: "",
        senderCode: "",
        senderName: "",
      },
    })),
  ]);
  return <FulfillmentClient initialOrders={orders} departments={masters.departments} />;
}
