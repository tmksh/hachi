"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CustomerEntryForm } from "@/components/crm/customer-entry-form";
import { CustomerAvatar } from "@/components/shared/customer-avatar";
import { useEffect, useState } from "react";
import type { Customer } from "@/lib/database.types";

export function CrmEditClient({
  initialName,
  initialCustomer,
  initialProfiles,
  initialTagMasters,
  initialLeadSources,
  initialDepartments,
}: {
  initialName: string;
  initialCustomer: Customer | null;
  initialProfiles: { id: string; display_name: string }[];
  initialTagMasters: { id: string; label: string }[];
  initialLeadSources: { id: string; label: string }[];
  initialDepartments: string[];
}) {
  const { id } = useParams();
  const router = useRouter();
  const [name, setName] = useState(initialName);

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/crm/${id}`}>
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        {name && <CustomerAvatar seed={id as string} name={name} size="md" />}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">顧客編集</h1>
      </div>
      <CustomerEntryForm
        mode="edit"
        customerId={id as string}
        initialCustomer={initialCustomer ?? undefined}
        initialProfiles={initialProfiles}
        initialTagMasters={initialTagMasters}
        initialLeadSources={initialLeadSources}
        initialDepartments={initialDepartments}
        onSaved={() => router.push(`/crm/${id}?tab=entry`)}
      />
    </div>
  );
}
