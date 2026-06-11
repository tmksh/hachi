import { getCustomer } from "@/lib/actions/customers";
import { CrmEditClient } from "./crm-edit-client";

export default async function CrmEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer(id).catch(() => null);
  return <CrmEditClient initialName={customer?.name ?? ""} />;
}
