import { getCustomer, getCustomerRelated, getCustomerEntryMasters } from "@/lib/actions/customers";
import { CrmDetailClient } from "./crm-detail-client";

export default async function CrmDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [initialData, initialRelated, initialMasters] = await Promise.all([
    getCustomer(id).catch(() => null),
    getCustomerRelated(id).catch(() => null),
    getCustomerEntryMasters().catch(() => ({
      profiles: [],
      tagMasters: [],
      leadSources: [],
      departments: [],
    })),
  ]);

  return (
    <CrmDetailClient
      initialData={initialData}
      initialRelated={initialRelated}
      initialMasters={initialMasters}
    />
  );
}
