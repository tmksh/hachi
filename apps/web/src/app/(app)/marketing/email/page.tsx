import { getEmailThreads } from "@/lib/actions/mail";
import { MarketingEmailClient } from "./marketing-email-client";

export default async function MarketingEmailPage() {
  const initialThreads = await getEmailThreads().catch(() => []);

  return <MarketingEmailClient initialThreads={initialThreads} />;
}
