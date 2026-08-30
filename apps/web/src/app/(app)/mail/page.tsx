import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getEmailAccounts, getEmailThreads } from "@/lib/actions/mail";
import { MailClient } from "./mail-client";

export const dynamic = "force-dynamic";

export default async function MailPage() {
  const [initialAccounts, initialThreads] = await Promise.all([
    getEmailAccounts(),
    getEmailThreads().catch(() => []),
  ]);

  return (
    <Suspense
      fallback={
        <div className="p-4 md:p-6 space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-[600px]" />
        </div>
      }
    >
      <MailClient
        initialAccounts={initialAccounts}
        initialThreads={initialThreads}
      />
    </Suspense>
  );
}
