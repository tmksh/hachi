import { getVendorInvoiceByToken } from "@/lib/actions/procurement";
import { VendorInvoiceClient } from "./vendor-invoice-client";

export default async function VendorInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invoice = await getVendorInvoiceByToken(token);
  return <VendorInvoiceClient token={token} initial={invoice} />;
}
