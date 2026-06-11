import { getInvoices } from "@/lib/actions/invoices";
import { InvoicesClient } from "./invoices-client";

export default async function InvoicesPage() {
  const initialInvoices = await getInvoices().catch(() => []);

  return <InvoicesClient initialInvoices={initialInvoices} />;
}
