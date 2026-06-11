import { getMailSignature } from "@/lib/actions/mail";
import { MailComposeClient } from "./mail-compose-client";

export default async function MailComposePage() {
  const initialSignature = await getMailSignature().catch(() => "");
  return <MailComposeClient initialSignature={initialSignature ?? ""} />;
}
