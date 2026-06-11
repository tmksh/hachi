import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getCompany } from "@/lib/actions/profiles";
import { getMailSignature } from "@/lib/actions/mail";
import { listTeamMembers } from "@/lib/actions/team";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const [initialCompany, initialSignature, initialMembers] = await Promise.all([
    getCompany().catch(() => null),
    getMailSignature().catch(() => ""),
    listTeamMembers().catch(() => []),
  ]);

  return (
    <Suspense fallback={<div className="p-4 md:p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full rounded-xl" /></div>}>
      <SettingsClient
        initialCompany={initialCompany}
        initialSignature={initialSignature}
        initialMembers={initialMembers}
      />
    </Suspense>
  );
}
