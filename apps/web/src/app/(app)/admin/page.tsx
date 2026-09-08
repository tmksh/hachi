import { Suspense } from "react";
import { AdminPageClient } from "./admin-page-client";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";

export default function AdminPage() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <AdminPageClient />
    </Suspense>
  );
}
