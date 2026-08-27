import type { getContract } from "@/lib/actions/contracts";
import type { Customer } from "@/lib/database.types";

export type ContractDetail = Awaited<ReturnType<typeof getContract>> & {
  customer?: Customer | null;
  customer_id?: string;
  customer_assignee_name?: string | null;
  linked_construction?: {
    id: string;
    title: string;
    construction_no?: string | null;
    start_date: string | null;
    end_date: string | null;
    order_amount: number | null;
  } | null;
};
