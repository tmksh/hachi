import { getInboundLeads, getInboundWebhookConfig } from "@/lib/actions/leads";
import { LeadsClient } from "./leads-client";

export default async function LeadsPage() {
  const [initialLeads, initialWebhook] = await Promise.all([
    getInboundLeads("all").catch(() => []),
    getInboundWebhookConfig().catch(() => ({
      enabled: false,
      token: null,
      secret_prefix: null,
      path: null,
      created_at: null,
      rotated_at: null,
      canManage: false,
    })),
  ]);
  return <LeadsClient initialLeads={initialLeads} initialWebhook={initialWebhook} />;
}
