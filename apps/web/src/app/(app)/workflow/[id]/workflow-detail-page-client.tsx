"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";
import {
  DETAIL_STALE_MS,
  fetchWorkflowApprovalSupport,
  fetchWorkflowRequest,
  QK,
} from "@/lib/queries/portal";
import { WorkflowDetailClient } from "./workflow-detail-client";

export function WorkflowDetailPageClient() {
  const { id } = useParams<{ id: string }>();
  const { data, isPending } = useQuery({
    queryKey: QK.workflowRequest(id),
    queryFn: async () => {
      const detail = await fetchWorkflowRequest(id).catch(() => null);
      if (!detail) return { detail: null, support: null };
      const payload = (detail as { payload?: Record<string, unknown> } | null)?.payload;
      const support = payload?.estimate_id ? await fetchWorkflowApprovalSupport(id) : null;
      return { detail, support };
    },
    staleTime: DETAIL_STALE_MS,
    enabled: !!id,
  });

  if (isPending) return <PageLoadingFallback />;
  return (
    <WorkflowDetailClient
      initialData={data?.detail ?? null}
      initialApprovalSupport={data?.support ?? null}
    />
  );
}
