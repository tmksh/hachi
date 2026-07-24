import { getCustomer } from "@/lib/actions/customers";
import { getProfiles } from "@/lib/actions/profiles";
import { getCustomerTagMasters, getLeadSources } from "@/lib/actions/deals";
import { getBiDepartmentNames } from "@/lib/actions/bi";
import { CrmEditClient } from "./crm-edit-client";

export default async function CrmEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [customer, profiles, tagMasters, leadSources, departments] = await Promise.all([
    getCustomer(id).catch(() => null),
    getProfiles().catch(() => []),
    getCustomerTagMasters().catch(() => []),
    getLeadSources().catch(() => []),
    getBiDepartmentNames().catch(() => [] as string[]),
  ]);

  return (
    <CrmEditClient
      initialName={customer?.name ?? ""}
      initialCustomer={customer}
      initialProfiles={profiles.map((p) => ({ id: p.id, display_name: p.display_name }))}
      initialTagMasters={tagMasters.map((t) => ({ id: t.id, label: t.label }))}
      initialLeadSources={leadSources.map((s) => ({ id: s.id, label: s.label }))}
      initialDepartments={departments}
    />
  );
}
