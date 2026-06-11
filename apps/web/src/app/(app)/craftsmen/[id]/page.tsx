import { getCraftsman } from "@/lib/actions/craftsmen";
import { CraftsmanDetailClient } from "./craftsman-detail-client";

export default async function CraftsmanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initialData = await getCraftsman(id).catch(() => null);

  return <CraftsmanDetailClient initialData={initialData} />;
}
