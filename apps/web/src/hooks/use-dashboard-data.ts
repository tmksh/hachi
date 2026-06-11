"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDashboardData, type DashboardData } from "@/lib/queries/dashboard";
import { getTodayAttendance } from "@/lib/actions/attendance";
import type { AttendanceEntry } from "@/lib/database.types";

export function useDashboardData(initialData?: DashboardData) {
  return useQuery({
    queryKey: ["dashboard-data"],
    queryFn: fetchDashboardData,
    initialData,
    initialDataUpdatedAt: initialData ? Date.now() : undefined,
  });
}

export function useTodayAttendance(initialData?: AttendanceEntry | null) {
  return useQuery({
    queryKey: ["today-attendance"],
    queryFn: getTodayAttendance,
    initialData: initialData ?? undefined,
    initialDataUpdatedAt: initialData !== undefined ? Date.now() : undefined,
  });
}
