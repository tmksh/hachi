import { Suspense } from "react";
import { SettingsPageClient } from "./settings-page-client";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <SettingsPageClient />
    </Suspense>
  );
}
