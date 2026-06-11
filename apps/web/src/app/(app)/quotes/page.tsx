import { getEstimates } from "@/lib/actions/estimates";
import { getCustomers } from "@/lib/actions/customers";
import { QuotesClient } from "./quotes-client";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  const { customer: customerParam } = await searchParams;

  const [initialRows, customerResult] = await Promise.all([
    getEstimates().catch(() => []),
    getCustomers({ limit: 100 }).catch(() => ({ customers: [] as Awaited<ReturnType<typeof getCustomers>>["customers"] })),
  ]);

  return (
    <QuotesClient
      initialRows={initialRows}
      initialCustomers={customerResult.customers}
      initialCustomerId={customerParam ?? null}
    />
  );
}
