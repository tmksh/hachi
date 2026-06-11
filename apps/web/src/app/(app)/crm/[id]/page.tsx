import { getCustomer, getCustomerRelated } from "@/lib/actions/customers";
import { CrmDetailClient } from "./crm-detail-client";

export default async function CrmDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [initialData, initialRelated] = await Promise.all([
    getCustomer(id).catch(() => null),
    getCustomerRelated(id).catch(() => null),
  ]);

  return (
    <CrmDetailClient
      initialData={initialData}
      initialRelated={initialRelated}
    />
  );
}
