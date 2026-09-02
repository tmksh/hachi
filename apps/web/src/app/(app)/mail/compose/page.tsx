import { getMailSignature } from "@/lib/actions/mail";
import { MailComposeClient } from "./mail-compose-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MailComposePage() {
  const initialSignature = await getMailSignature().catch(() => "");
  return <MailComposeClient initialSignature={initialSignature ?? ""} />;
}
