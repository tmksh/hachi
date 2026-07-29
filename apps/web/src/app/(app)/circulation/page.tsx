import { getAnnouncements } from "@/lib/actions/announcements";
import { CirculationClient } from "./circulation-client";

export const dynamic = "force-dynamic";

export default async function CirculationPage() {
  const initialItems = await getAnnouncements().catch(() => []);

  return <CirculationClient initialItems={initialItems} />;
}
