import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { getProfiles } from "@/lib/actions/profiles";
import { getCustomerTagMasters, getLeadSources } from "@/lib/actions/deals";
import { getBiDepartmentNames } from "@/lib/actions/bi";
import { CrmNewClient } from "./crm-new-client";

export default async function CrmNewPage() {
  const [profiles, tagMasters, leadSources, departments] = await Promise.all([
    getProfiles().catch(() => []),
    getCustomerTagMasters().catch(() => []),
    getLeadSources().catch(() => []),
    getBiDepartmentNames().catch(() => [] as string[]),
  ]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/crm">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">新規顧客登録</h1>
      </div>
      <CrmNewClient
        initialProfiles={profiles.map((p) => ({ id: p.id, display_name: p.display_name }))}
        initialTagMasters={tagMasters.map((t) => ({ id: t.id, label: t.label }))}
        initialLeadSources={leadSources.map((s) => ({ id: s.id, label: s.label }))}
        initialDepartments={departments}
      />
    </div>
  );
}
