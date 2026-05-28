"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CustomerEntryForm } from "@/components/crm/customer-entry-form";

export default function CrmNewPage() {
  const router = useRouter();

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/crm"><Button variant="ghost" size="icon" className="size-8"><ArrowLeft className="size-4" /></Button></Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">新規顧客登録</h1>
      </div>
      <CustomerEntryForm
        mode="create"
        onSaved={(newId) => router.push(`/crm/${newId}?tab=entry`)}
      />
    </div>
  );
}
