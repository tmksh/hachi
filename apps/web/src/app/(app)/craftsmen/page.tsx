import { getCraftsmen } from "@/lib/actions/craftsmen";
import { CraftsmenClient } from "./craftsmen-client";

export default async function CraftsmenPage() {
  const initialRows = await getCraftsmen().catch(() => []);

  return <CraftsmenClient initialRows={initialRows} />;
}
