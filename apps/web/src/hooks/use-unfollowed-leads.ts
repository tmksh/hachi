"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchUnfollowedLeads, type UnfollowedLead } from "@/lib/queries/dashboard";

export function useUnfollowedLeads(days = 7, initialData?: UnfollowedLead[]) {
  return useQuery({
    queryKey: ["unfollowed-leads", days],
    queryFn: () => fetchUnfollowedLeads(days),
    staleTime: 120_000,
    initialData,
    initialDataUpdatedAt: initialData ? Date.now() : undefined,
  });
}
