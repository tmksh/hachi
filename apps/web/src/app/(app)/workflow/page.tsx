import { getWorkflowRequests } from "@/lib/actions/workflow";
import { WorkflowClient } from "./workflow-client";

export default async function WorkflowPage() {
  const initialRows = await getWorkflowRequests().catch(() => []);

  return <WorkflowClient initialRows={initialRows} />;
}
