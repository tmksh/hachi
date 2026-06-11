import { getConstructions } from "@/lib/actions/constructions";
import { getProfiles } from "@/lib/actions/profiles";
import { ConstructionsClient } from "./constructions-client";

export default async function ConstructionsPage() {
  const [initialRows, initialProfiles] = await Promise.all([
    getConstructions(),
    getProfiles(),
  ]);

  return (
    <ConstructionsClient
      initialRows={initialRows}
      initialProfiles={initialProfiles}
    />
  );
}
