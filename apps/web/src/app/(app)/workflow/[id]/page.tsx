import {
  getWorkflowRequest,
  getWorkflowApprovalSupport,
} from "@/lib/actions/workflow";
import { WorkflowDetailClient } from "./workflow-detail-client";

export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initialData = await getWorkflowRequest(id).catch(() => null);

  let initialApprovalSupport = null;
  if (initialData) {
    const payload = (initialData as { payload?: Record<string, unknown> }).payload;
    if (payload?.estimate_id) {
      initialApprovalSupport = await getWorkflowApprovalSupport(id).catch(() => null);
    }
  }

  return (
    <WorkflowDetailClient
      initialData={initialData}
      initialApprovalSupport={initialApprovalSupport}
    />
  );
}
