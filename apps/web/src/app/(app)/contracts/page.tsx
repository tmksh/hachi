import { getContracts } from "@/lib/actions/contracts";
import { ContractsClient } from "./contracts-client";

export default async function ContractsPage() {
  const initialRows = await getContracts().catch(() => []);

  return <ContractsClient initialRows={initialRows} />;
}
