"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDashboardData } from "@/lib/queries/dashboard";
import { getTodayAttendance } from "@/lib/actions/attendance";

export function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard-data"],
    queryFn: fetchDashboardData,
  });
}

export function useTodayAttendance() {
  return useQuery({
    queryKey: ["today-attendance"],
    queryFn: getTodayAttendance,
  });
}
