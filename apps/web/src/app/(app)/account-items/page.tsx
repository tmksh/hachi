import { getCompanyOrders, getProcurementMasters } from "@/lib/actions/procurement";
import { AccountItemsClient } from "./account-items-client";

export default async function AccountItemsPage() {
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
  return <AccountItemsClient initialOrders={orders} accountItems={masters.accountItems} />;
}
