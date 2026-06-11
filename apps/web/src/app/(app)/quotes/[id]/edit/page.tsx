import { getEstimate } from "@/lib/actions/estimates";
import { getCustomers } from "@/lib/actions/customers";
import { QuoteEditClient } from "./quote-edit-client";

export default async function QuoteEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [initialEstimate, customerResult] = await Promise.all([
    getEstimate(id).catch(() => null),
    getCustomers({ limit: 100 }).catch(() => ({ customers: [] as Awaited<ReturnType<typeof getCustomers>>["customers"] })),
  ]);

  return (
    <QuoteEditClient
      initialEstimate={initialEstimate}
      initialCustomers={customerResult.customers.map(c => ({ id: c.id, name: c.name }))}
    />
  );
}
