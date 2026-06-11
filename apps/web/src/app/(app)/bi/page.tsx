import { Suspense } from "react";
import { getBiSettings, getBiActuals } from "@/lib/actions/bi";
import { getCurrentFiscalYear } from "@/lib/bi-utils";
import { BiClient } from "./bi-client";

export default async function BiDashboardPage() {
  const fiscalYear = getCurrentFiscalYear();
  const [initialSettings, initialActuals] = await Promise.all([
    getBiSettings(fiscalYear),
    getBiActuals(fiscalYear),
  ]);

  return (
    <Suspense fallback={<div className="p-4 md:p-6"><div className="h-8 w-48 bg-muted animate-pulse rounded mb-4" /><div className="h-96 bg-muted animate-pulse rounded-xl" /></div>}>
      <BiClient
        initialSettings={initialSettings}
        initialActuals={initialActuals}
      />
    </Suspense>
  );
}
