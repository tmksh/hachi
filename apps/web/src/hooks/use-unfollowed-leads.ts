"use client";

import { useQuerySeedAt } from "@/hooks/use-query-seed-at";
import { useQuery } from "@tanstack/react-query";
import { fetchUnfollowedLeads, type UnfollowedLead } from "@/lib/queries/dashboard";

export function useUnfollowedLeads(days = 7, initialData?: UnfollowedLead[], enabled = true) {
  const querySeedAt = useQuerySeedAt();
  return useQuery({
    queryKey: ["unfollowed-leads", days],
    queryFn: () => fetchUnfollowedLeads(days),
    staleTime: 120_000,
    enabled,
    initialData,
    initialDataUpdatedAt: initialData ? querySeedAt : undefined,
  });
}
