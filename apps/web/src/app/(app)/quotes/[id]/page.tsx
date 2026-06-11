import { getEstimate } from "@/lib/actions/estimates";
import { QuoteDetailClient } from "./quote-detail-client";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initialData = await getEstimate(id).catch(() => null);

  return <QuoteDetailClient initialData={initialData} />;
}
