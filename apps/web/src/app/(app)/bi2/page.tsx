import { Suspense } from "react";
import { Bi2Client } from "./bi2-client";

export default function Bi2DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 md:p-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded mb-4" />
          <div className="h-96 bg-muted animate-pulse rounded-xl" />
        </div>
      }
    >
      <Bi2Client />
    </Suspense>
  );
}
