import { Suspense } from "react";
import { MailPageClient } from "./mail-page-client";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";

export default function MailPage() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <MailPageClient />
    </Suspense>
  );
}
