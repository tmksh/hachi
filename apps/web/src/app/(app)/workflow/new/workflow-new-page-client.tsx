"use client";

import { useQuery } from "@tanstack/react-query";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";
import { fetchProfiles } from "@/lib/queries/lists";
import { useAuth } from "@/hooks/use-auth";
import { fetchWorkflowTypes, LIST_STALE_MS, QK } from "@/lib/queries/portal";
import { WorkflowNewClient } from "./workflow-new-client";

export function WorkflowNewPageClient() {
  const { profile } = useAuth();
  const currentUserId = profile?.id ?? null;
  const { data: types, isPending: tPending } = useQuery({
    queryKey: QK.workflowTypes,
    queryFn: fetchWorkflowTypes,
    staleTime: LIST_STALE_MS,
  });
  const { data: profiles, isPending: pPending } = useQuery({
    queryKey: ["profiles"],
    queryFn: fetchProfiles,
    staleTime: 5 * 60_000,
  });

  if (tPending || pPending || !types || !profiles) return <PageLoadingFallback />;

  return (
    <WorkflowNewClient
      initialTypes={types}
      initialProfiles={profiles.map((x) => ({ id: x.id, display_name: x.display_name, role: x.role, department: x.department }))}
      currentUserId={currentUserId}
    />
  );
}
