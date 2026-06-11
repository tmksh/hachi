import { getWorkflowTypes } from "@/lib/actions/workflow";
import { getProfiles } from "@/lib/actions/profiles";
import { WorkflowNewClient } from "./workflow-new-client";

export default async function WorkflowNewPage() {
  const [types, profiles] = await Promise.all([
    getWorkflowTypes().catch(() => []),
    getProfiles().catch(() => []),
  ]);

  const initialProfiles = profiles.map(x => ({ id: x.id, display_name: x.display_name }));

  return (
    <WorkflowNewClient
      initialTypes={types}
      initialProfiles={initialProfiles}
    />
  );
}
