"use client";

import { CustomerEntryForm } from "@/components/crm/customer-entry-form";
import { useRouter } from "next/navigation";

export function CrmNewClient() {
  const router = useRouter();

  return (
    <CustomerEntryForm
      mode="create"
      onSaved={(newId) => router.push(`/crm/${newId}?tab=entry`)}
    />
  );
}
