import { getContract } from "@/lib/actions/contracts";
import { ContractDetailClient } from "./contract-detail-client";

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initialData = await getContract(id).catch(() => null);

  return <ContractDetailClient initialData={initialData} />;
}
