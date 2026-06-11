import { notFound } from "next/navigation";
import { getContract } from "@/lib/actions/contracts";
import { getCustomers } from "@/lib/actions/customers";
import { getEstimates } from "@/lib/actions/estimates";
import { getProfiles } from "@/lib/actions/profiles";
import { ContractEditClient } from "./contract-edit-client";

export default async function ContractEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [initialContract, customerResult, estimates, profiles] = await Promise.all([
    getContract(id).catch(() => null),
    getCustomers({ limit: 100 }),
    getEstimates(),
    getProfiles(),
  ]);

  if (!initialContract) {
    notFound();
  }

  const initialCustomers = customerResult.customers.map((x) => ({ id: x.id, name: x.name }));
  const initialEstimates = estimates.map((x) => ({
    id: x.id,
    estimate_no: x.estimate_no,
    title: x.title,
    customer_id: x.customer_id,
    total: x.total,
  }));
  const initialProfiles = profiles.map((x) => ({ id: x.id, display_name: x.display_name }));

  return (
    <ContractEditClient
      id={id}
      initialContract={initialContract}
      initialCustomers={initialCustomers}
      initialEstimates={initialEstimates}
      initialProfiles={initialProfiles}
    />
  );
}
