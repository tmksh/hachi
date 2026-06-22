import {
  getConstruction,
  getConstructionContractDocs,
} from "@/lib/actions/constructions";
import { getChangeOrders } from "@/lib/actions/change-orders";
import { getCompany } from "@/lib/actions/profiles";
import { getInvoicesForConstruction } from "@/lib/actions/invoices";
import { ConstructionDetailClient } from "./construction-detail-client";

export default async function ConstructionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [initialData, initialDocs, initialChangeOrders, company, initialInvoices] = await Promise.all([
    getConstruction(id).catch(() => null),
    getConstructionContractDocs(id).catch(() => []),
    getChangeOrders(id).catch(() => []),
    getCompany().catch(() => null),
    getInvoicesForConstruction(id).catch(() => []),
  ]);

  const settings = company?.settings as Record<string, unknown> | undefined;
  const initialClosingDayLabel =
    settings?.invoice_closing_day === "20" ? "20日締め" : "月末締め";

  return (
    <ConstructionDetailClient
      initialData={initialData}
      initialDocs={initialDocs}
      initialChangeOrders={initialChangeOrders}
      initialClosingDayLabel={initialClosingDayLabel}
      initialInvoices={initialInvoices}
    />
  );
}
