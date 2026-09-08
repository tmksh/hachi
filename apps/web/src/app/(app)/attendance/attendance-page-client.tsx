"use client";

import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";
import { useAuth } from "@/hooks/use-auth";
import { fetchAttendanceEntries, fetchCompany, LIST_STALE_MS, QK } from "@/lib/queries/portal";
import { AttendanceClient } from "./attendance-client";

export function AttendancePageClient() {
  const { user, loading: authLoading } = useAuth();
  const month = format(new Date(), "yyyy-MM");
  const { data: company, isPending: companyPending } = useQuery({
    queryKey: QK.company,
    queryFn: fetchCompany,
    staleTime: 5 * 60_000,
  });
  const { data: entries, isPending: entriesPending } = useQuery({
    queryKey: QK.attendance(month),
    queryFn: () => fetchAttendanceEntries(month),
    staleTime: LIST_STALE_MS,
    enabled: !!user?.id,
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
