import { Suspense } from "react";
import { CalendarClient } from "./calendar-client";
import { Skeleton } from "@/components/ui/skeleton";

export default function CalendarPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-xl" />}>
      <CalendarClient initialEvents={[]} initialMembers={[]} />
    </Suspense>
  );
}
