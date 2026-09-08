"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDashboardData, type DashboardData } from "@/lib/queries/dashboard";
import { fetchTodayAttendance } from "@/lib/queries/attendance";
import type { AttendanceEntry } from "@/lib/database.types";

export function useDashboardData(initialData?: DashboardData) {
  return useQuery({
    queryKey: ["dashboard-data"],
    queryFn: fetchDashboardData,
    staleTime: 120_000,
    initialData,
    initialDataUpdatedAt: initialData ? Date.now() : undefined,
  });
}

export function useTodayAttendance(initialData?: AttendanceEntry | null) {
  return useQuery({
    queryKey: ["today-attendance"],
    queryFn: fetchTodayAttendance,
    staleTime: 120_000,
    initialData: initialData ?? undefined,
    initialDataUpdatedAt: initialData != null ? Date.now() : undefined,
  });
}
