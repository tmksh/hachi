"use client";

import { useQuery } from "@tanstack/react-query";
import { getDashboardData } from "@/lib/actions/dashboard";
import { getTodayAttendance } from "@/lib/actions/attendance";

export function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard-data"],
    queryFn: getDashboardData,
  });
}

export function useTodayAttendance() {
  return useQuery({
    queryKey: ["today-attendance"],
    queryFn: getTodayAttendance,
  });
}
