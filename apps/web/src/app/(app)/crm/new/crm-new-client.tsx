"use client";

import { useRouter } from "next/navigation";
import { CustomerEntryForm } from "@/components/crm/customer-entry-form";

export function CrmNewClient({
  initialProfiles,
  initialTagMasters,
  initialLeadSources,
  initialDepartments,
}: {
  initialProfiles: { id: string; display_name: string }[];
  initialTagMasters: { id: string; label: string }[];
  initialLeadSources: { id: string; label: string }[];
  initialDepartments: string[];
}) {
  const router = useRouter();

  return (
    <CustomerEntryForm
      mode="create"
      initialProfiles={initialProfiles}
      initialTagMasters={initialTagMasters}
      initialLeadSources={initialLeadSources}
      initialDepartments={initialDepartments}
      onSaved={(newId) => router.push(`/crm/${newId}?tab=entry`)}
    />
  );
}
