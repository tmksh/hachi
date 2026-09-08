"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CustomerEntryForm } from "@/components/crm/customer-entry-form";

export function CrmEditClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/crm/${id}`}>
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">顧客編集</h1>
      </div>
      <CustomerEntryForm
        mode="edit"
        customerId={id}
        onSaved={() => router.push(`/crm/${id}?tab=entry`)}
      />
    </div>
  );
}
