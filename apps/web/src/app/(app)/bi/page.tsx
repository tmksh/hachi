import { Suspense } from "react";
import { BiClient } from "./bi-client";

export default function BiDashboardPage() {
  return (
    <Suspense fallback={<div className="p-4 md:p-6"><div className="h-8 w-48 bg-muted animate-pulse rounded mb-4" /><div className="h-96 bg-muted animate-pulse rounded-xl" /></div>}>
      <BiClient />
    </Suspense>
  );
}
