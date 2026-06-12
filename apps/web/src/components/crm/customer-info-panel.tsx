"use client";

import Link from "next/link";
import { ExternalLink, Users } from "lucide-react";
import { CustomerEntryForm } from "@/components/crm/customer-entry-form";
import type { Customer } from "@/lib/database.types";

type CustomerInfoContext = "crm" | "contract" | "construction";

const CONTEXT_LABELS: Record<Exclude<CustomerInfoContext, "crm">, string> = {
  contract: "契約管理",
  construction: "工事管理",
};

export function CustomerInfoPanel({
  customerId,
  context = "crm",
  onSaved,
  initialCustomer,
}: {
  customerId: string;
  context?: CustomerInfoContext;
  onSaved?: () => void;
  initialCustomer?: Customer;
}) {
  return (
    <div className="space-y-4">
      {context !== "crm" && (
        <div className="rounded-lg border border-primary/15 bg-primary/5 px-4 py-3">
          <div className="flex items-start gap-2">
            <Users className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">共通顧客情報（{CONTEXT_LABELS[context]}）</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                ここで編集した氏名・連絡先・住所などは、CRM・契約管理・工事管理ですべて同じ内容になります。
              </p>
              <Link
                href={`/crm/${customerId}?tab=entry`}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
              >
                CRM で開く
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      <CustomerEntryForm
        mode="edit"
        customerId={customerId}
        initialCustomer={initialCustomer}
        onSaved={onSaved}
        showCard={context === "crm"}
      />
    </div>
  );
}
