import { getAnnouncement } from "@/lib/actions/announcements";
import { CirculationDetailClient } from "./circulation-detail-client";

export default async function CirculationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initialData = await getAnnouncement(id).catch(() => null);

  return <CirculationDetailClient initialData={initialData} />;
}
