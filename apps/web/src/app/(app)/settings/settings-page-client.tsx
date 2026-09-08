"use client";

import { useQuery } from "@tanstack/react-query";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";
import { fetchSettingsBundle, LIST_STALE_MS, QK } from "@/lib/queries/portal";
import { SettingsClient } from "./settings-client";

export function SettingsPageClient() {
  const { data, isPending } = useQuery({
    queryKey: QK.settingsBundle,
    queryFn: fetchSettingsBundle,
    staleTime: LIST_STALE_MS,
  });

  if (isPending || !data) return <PageLoadingFallback />;

  return (
    <SettingsClient
      initialCompany={data.initialCompany}
      initialSignature={data.initialSignature}
      initialMembers={data.initialMembers}
      initialCrmMaster={data.initialCrmMaster}
      initialCraftsmenMaster={data.initialCraftsmenMaster}
      initialAppIntegrations={data.initialAppIntegrations}
    />
  );
}
