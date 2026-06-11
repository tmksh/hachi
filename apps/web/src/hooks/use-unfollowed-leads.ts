"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchUnfollowedLeads } from "@/lib/queries/dashboard";

export function useUnfollowedLeads(days = 7) {
  return useQuery({
    queryKey: ["unfollowed-leads", days],
    queryFn: () => fetchUnfollowedLeads(days),
    staleTime: 120_000,
  });
}
