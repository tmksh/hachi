"use server";

import { createHmac } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchAppIntegrations } from "@/lib/app-integrations/dispatch";

export type WebhookEvent =
  | "customer.created"
  | "customer.updated"
  | "customer.deleted"
  | "deal.created"
  | "deal.updated"
  | "deal.stage_changed"
  | "deal.closed"
  | "estimate.created"
  | "estimate.approved"
  | "estimate.rejected"
  | "estimate.approval_requested"
  | "contract.created"
  | "contract.signed"
  | "contract.workflow_submitted"
  | "contract.cloudsign_sent"
  | "construction.created"
  | "construction.started"
  | "construction.completed"
  | "sales_flow.notification"
  | "invoice.issued"
  | "invoice.paid"
  | "workflow.approved"
  | "workflow.rejected"
  | "announcement.published";

export async function dispatchWebhook(
  companyId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  const admin = createAdminClient();
  const { data: endpoints } = await admin
    .from("webhook_endpoints")
    .select("id, url, secret, events")
    .eq("company_id", companyId)
    .eq("is_active", true);

  void dispatchAppIntegrations(companyId, event, data);

  if (!endpoints?.length) return;

  const payload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };
  const body = JSON.stringify(payload);

  await Promise.all(
    endpoints
      .filter((ep) => !ep.events?.length || ep.events.includes(event) || ep.events.includes("*"))
      .map(async (ep) => {
        const signature = createHmac("sha256", ep.secret).update(body).digest("hex");
        let responseStatus: number | null = null;
        let responseBody = "";
        let success = false;

        try {
          const res = await fetch(ep.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Bridge-Signature": `sha256=${signature}`,
              "X-Bridge-Event": event,
            },
            body,
            signal: AbortSignal.timeout(10000),
          });
          responseStatus = res.status;
          responseBody = (await res.text()).slice(0, 2000);
          success = res.ok;
        } catch (err) {
          responseBody = err instanceof Error ? err.message : "Unknown error";
        }

        await admin.from("webhook_logs").insert({
          company_id: companyId,
          endpoint_id: ep.id,
          event,
          payload,
          response_status: responseStatus,
          response_body: responseBody,
          success,
        });
      })
  );
}

/** Authenticated server action context helper */
export async function getCompanyIdForWebhook(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  return profile?.company_id ?? null;
}
