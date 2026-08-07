import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getCompany } from "@/lib/actions/profiles";
import { getMailSignature } from "@/lib/actions/mail";
import { listTeamMembers } from "@/lib/actions/team";
import {
  getDealStages,
  getLostReasons,
  getLeadSources,
  getCustomerTagMasters,
  getDepartmentMarginRates,
} from "@/lib/actions/deals";
import { getCompanyLocations } from "@/lib/actions/bi";
import {
  getCraftsmenSpecialties,
  getCraftsmenQualifications,
} from "@/lib/actions/craftsmen";
import {
  getAppIntegrations,
  getProviderDefinitionsForClient,
} from "@/lib/actions/app-integrations";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  // タブ切替時の待ちを消すため、マスタ・連携も初回 SSR で並列取得
  const [
    initialCompany,
    initialSignature,
    initialMembers,
    stages,
    lostReasons,
    leadSources,
    tags,
    departmentMargins,
    locations,
    specialties,
    qualifications,
    appIntegrations,
    providerDefinitions,
  ] = await Promise.all([
    getCompany().catch(() => null),
    getMailSignature().catch(() => ""),
    listTeamMembers().catch(() => []),
    getDealStages().catch(() => []),
    getLostReasons().catch(() => []),
    getLeadSources().catch(() => []),
    getCustomerTagMasters().catch(() => []),
    getDepartmentMarginRates().catch(() => []),
    getCompanyLocations().catch(() => []),
    getCraftsmenSpecialties().catch(() => []),
    getCraftsmenQualifications().catch(() => []),
    getAppIntegrations().catch(() => []),
    getProviderDefinitionsForClient().catch(() => []),
  ]);

  return (
    <Suspense fallback={<div className="p-4 md:p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full rounded-xl" /></div>}>
      <SettingsClient
        initialCompany={initialCompany}
        initialSignature={initialSignature}
        initialMembers={initialMembers}
        initialCrmMaster={{
          stages: stages as Array<{
            id: string;
            key: string;
            label: string;
            color: string;
            sort_order: number;
            is_won: boolean;
            is_lost: boolean;
          }>,
          lostReasons: lostReasons as Array<{ id: string; label: string; sort_order: number }>,
          leadSources: leadSources as Array<{ id: string; label: string; sort_order: number }>,
          tags: tags as Array<{ id: string; label: string; sort_order: number }>,
          departmentMargins,
          locations,
        }}
        initialCraftsmenMaster={{
          specialties: specialties as Array<{ id: string; label: string; sort_order: number }>,
          qualifications: qualifications as Array<{ id: string; label: string; sort_order: number }>,
        }}
        initialAppIntegrations={{
          integrations: appIntegrations,
          catalog: providerDefinitions,
        }}
      />
    </Suspense>
  );
}
