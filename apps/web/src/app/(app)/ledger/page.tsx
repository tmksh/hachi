import { getCompanyOrders, getProcurementMasters } from "@/lib/actions/procurement";
import { LedgerClient } from "./ledger-client";

export default async function LedgerPage() {
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
  return <LedgerClient initialOrders={orders} masters={masters} />;
}
