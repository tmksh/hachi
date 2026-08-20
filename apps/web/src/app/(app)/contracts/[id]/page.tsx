import { getContract } from "@/lib/actions/contracts";
import { getCustomerEntryMasters } from "@/lib/actions/customers";
import { ContractDetailClient } from "./contract-detail-client";

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [initialData, initialMasters] = await Promise.all([
    getContract(id).catch(() => null),
    getCustomerEntryMasters().catch(() => ({
      profiles: [],
      tagMasters: [],
      leadSources: [],
      departments: [],
    })),
  ]);

  return <ContractDetailClient initialData={initialData} initialMasters={initialMasters} />;
}
