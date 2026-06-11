import { getEmailThread } from "@/lib/actions/mail";
import { MarketingEmailDetailClient } from "./marketing-email-detail-client";

export default async function MarketingEmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initialData = await getEmailThread(id).catch(() => null);

  return <MarketingEmailDetailClient initialData={initialData} />;
}
