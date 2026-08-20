import type { getContract } from "@/lib/actions/contracts";
import type { Customer } from "@/lib/database.types";

export type ContractDetail = Awaited<ReturnType<typeof getContract>> & {
  customer?: Customer | null;
  customer_id?: string;
};
