import type { getContract } from "@/lib/actions/contracts";

export type ContractDetail = Awaited<ReturnType<typeof getContract>> & {
  customer?: { name: string; company_name?: string | null; email?: string | null } | null;
  customer_id?: string;
};
