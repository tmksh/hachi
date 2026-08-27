import { getCompanyOrders, getProcurementMasters } from "@/lib/actions/procurement";
import { EMPTY_TRANSFER_SENDER } from "@/lib/procurement";
import { LedgerClient } from "./ledger-client";

export default async function LedgerPage() {
  const [orders, masters] = await Promise.all([
    getCompanyOrders().catch(() => []),
    getProcurementMasters().catch(() => ({
      departments: [] as string[],
      accountItems: [] as string[],
      sender: EMPTY_TRANSFER_SENDER,
    })),
  ]);
  return <LedgerClient initialOrders={orders} masters={masters} />;
}
