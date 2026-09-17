"use client";

import { useQuery } from "@tanstack/react-query";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";
import { useAuth } from "@/hooks/use-auth";
import { fetchAttendanceEntriesRange, fetchCompany, LIST_STALE_MS, QK } from "@/lib/queries/portal";
import { periodContaining } from "@/lib/attendance-period";
import { AttendanceClient, closingDayFromCompany } from "./attendance-client";

export function AttendancePageClient() {
  const { user, loading: authLoading } = useAuth();
  const { data: company, isPending: companyPending } = useQuery({
    queryKey: QK.company,
    queryFn: fetchCompany,
    staleTime: 5 * 60_000,
  });
  const closingDay = closingDayFromCompany(company ?? null);
  const period = periodContaining(new Date(), closingDay);
  const { data: entries, isPending: entriesPending } = useQuery({
    queryKey: QK.attendanceRange(period.start, period.end, "all"),
    queryFn: () => fetchAttendanceEntriesRange(period.start, period.end),
    staleTime: LIST_STALE_MS,
    enabled: !!user?.id && !companyPending,
  });

  if (authLoading || !user || companyPending || entriesPending || entries === undefined) {
    return <PageLoadingFallback />;
  }

  return (
    <AttendanceClient
      initialCompany={company ?? null}
      initialEntries={entries}
      initialUserId={user.id}
    />
  );
}
