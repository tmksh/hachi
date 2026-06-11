import { getDeals } from "@/lib/actions/deals";
import { MarketingRoiClient } from "./marketing-roi-client";

export default async function MarketingRoiPage() {
  const initialDeals = await getDeals().catch(() => []);

  return <MarketingRoiClient initialDeals={initialDeals} />;
}
