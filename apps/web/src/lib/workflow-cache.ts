import type { QueryClient } from "@tanstack/react-query";

/** Approval changes linked records as well as the workflow itself. */
export async function invalidateWorkflowRelatedQueries(
  client: QueryClient,
  payload?: Record<string, unknown> | null,
) {
  const keys: string[][] = [["dashboard-data"]];
  if (typeof payload?.contract_id === "string") {
    keys.push(["contracts"], ["contract", payload.contract_id], ["constructions"], ["construction"]);
  }
  if (typeof payload?.estimate_id === "string") {
    keys.push(["estimates"], ["estimate", payload.estimate_id], ["constructions"], ["construction"]);
  }
  const unique = [...new Map(keys.map((key) => [JSON.stringify(key), key])).values()];
  await Promise.all(unique.map((queryKey) => client.invalidateQueries({ queryKey })));
}
