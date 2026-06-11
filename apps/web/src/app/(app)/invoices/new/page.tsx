import { getCustomers } from "@/lib/actions/customers";
import { getConstructions } from "@/lib/actions/constructions";
import { InvoiceNewClient } from "./invoice-new-client";

export default async function InvoiceNewPage() {
  const [customerResult, constructions] = await Promise.all([
    getCustomers({ limit: 100 }),
    getConstructions(),
  ]);

  return (
    <InvoiceNewClient
      initialCustomers={customerResult.customers.map((x) => ({ id: x.id, name: x.name }))}
      initialConstructions={constructions.map((x) => ({ id: x.id, title: x.title }))}
    />
  );
}
