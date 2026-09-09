"use client";

import { useQuerySeedAt } from "@/hooks/use-query-seed-at";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboardData, type DashboardData } from "@/lib/queries/dashboard";
import { fetchTodayAttendance } from "@/lib/queries/attendance";
import type { AttendanceEntry } from "@/lib/database.types";

export function useDashboardData(initialData?: DashboardData) {
  const querySeedAt = useQuerySeedAt();
  return useQuery({
    queryKey: ["dashboard-data"],
    queryFn: fetchDashboardData,
    staleTime: 120_000,
    initialData,
    initialDataUpdatedAt: initialData ? querySeedAt : undefined,
  });
}

export function useTodayAttendance(initialData?: AttendanceEntry | null) {
  const querySeedAt = useQuerySeedAt();
  return useQuery({
    queryKey: ["today-attendance"],
    queryFn: fetchTodayAttendance,
    staleTime: 120_000,
    initialData: initialData ?? undefined,
    initialDataUpdatedAt: initialData != null ? querySeedAt : undefined,
  });
}
