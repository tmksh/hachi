import { getCustomers } from "@/lib/actions/customers";
import { MarketingSnsClient } from "./marketing-sns-client";

export default async function MarketingSnsPage() {
  const { customers: initialCustomers } = await getCustomers({ limit: 100 }).catch(() => ({ customers: [] }));

  return <MarketingSnsClient initialCustomers={initialCustomers} />;
}
