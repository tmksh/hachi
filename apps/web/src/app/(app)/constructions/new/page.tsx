import { getContracts } from "@/lib/actions/contracts";
import { getProfiles } from "@/lib/actions/profiles";
import { getBiDepartmentNames } from "@/lib/actions/bi";
import { ConstructionNewClient } from "./construction-new-client";

const ELIGIBLE_STATUSES = new Set(["contracted", "executing"]);

export default async function ConstructionNewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (key: string) => {
    const v = sp[key];
    return typeof v === "string" ? v : "";
  };

  const initialContractId = get("contract_id");

  const [allContracts, profiles, departments] = await Promise.all([
    getContracts(),
    getProfiles(),
    getBiDepartmentNames(),
  ]);

  const initialContracts = allContracts
    .filter((c) => ELIGIBLE_STATUSES.has(c.status) || c.id === initialContractId)
    .map((c) => ({
      id: c.id,
      contract_no: c.contract_no,
      title: c.title,
      status: c.status as "contracted" | "executing",
      customer_id: c.customer_id,
      customer_name: c.customer?.company_name || c.customer?.name || "（顧客未設定）",
      amount: c.amount,
      start_date: c.start_date,
      end_date: c.end_date,
      assigned_to: c.assigned_to,
      department_name: c.department_name,
    }));

  return (
    <ConstructionNewClient
      initialContracts={initialContracts}
      initialProfiles={profiles.map((x) => ({ id: x.id, display_name: x.display_name }))}
      initialDepartments={departments}
      initialCustomerId={get("customer_id")}
      initialContractId={initialContractId}
      initialDealId={get("deal_id")}
      initialEstimateId={get("estimate_id")}
      initialTitle={get("title")}
      initialOrderAmount={get("order_amount")}
      initialStartDate={get("start_date")}
      initialEndDate={get("end_date")}
      initialAssignedTo={get("assigned_to")}
    />
  );
}
