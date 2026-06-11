import { getDocuments } from "@/lib/actions/documents";
import { MarketingCreativeClient } from "./marketing-creative-client";

export default async function MarketingCreativePage() {
  const initialDocs = await getDocuments().catch(() => []);

  return <MarketingCreativeClient initialDocs={initialDocs} />;
}
