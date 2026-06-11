import { getInvoice } from "@/lib/actions/invoices";
import { InvoiceDetailClient } from "./invoice-detail-client";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initialData = await getInvoice(id).catch(() => null);

  return <InvoiceDetailClient initialData={initialData} />;
}
