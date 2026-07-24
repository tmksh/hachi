import { getCustomers } from "@/lib/actions/customers";
import { QuoteNewPageShell } from "./quote-new-client";

export default async function QuoteNewPage() {
  const { customers } = await getCustomers({ limit: 100 }).catch(() => ({
    customers: [] as Awaited<ReturnType<typeof getCustomers>>["customers"],
  }));

  return (
    <QuoteNewPageShell
      initialCustomers={customers.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
