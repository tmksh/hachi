import type { getContract } from "@/lib/actions/contracts";

export type ContractDetail = Awaited<ReturnType<typeof getContract>> & {
  customer?: { id: string; name: string; company_name?: string | null; email?: string | null; address?: string | null } | null;
  customer_id?: string;
};
