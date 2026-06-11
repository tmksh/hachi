import { getCustomers } from "@/lib/actions/customers";
import { getEstimates } from "@/lib/actions/estimates";
import { getProfiles } from "@/lib/actions/profiles";
import { ContractNewClient } from "./contract-new-client";

export default async function ContractNewPage() {
  const [customerResult, estimates, profiles] = await Promise.all([
    getCustomers({ limit: 100 }),
    getEstimates(),
    getProfiles(),
  ]);

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
    <ContractNewClient
      initialCustomers={initialCustomers}
      initialEstimates={initialEstimates}
      initialProfiles={initialProfiles}
    />
  );
}
