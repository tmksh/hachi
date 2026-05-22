/**
 * dispatchWebhook 相当の処理（Next.js 非依存・QA 用）
 */
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export async function runDispatchWebhook(env, companyId, event, data) {
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: endpoints } = await admin
    .from("webhook_endpoints")
    .select("id, url, secret, events")
    .eq("company_id", companyId)
    .eq("is_active", true);

  await dispatchAppIntegrations(admin, companyId, event, data);

  if (!endpoints?.length) return { webhookHits: 0, logSuccess: false };

  const payload = { event, timestamp: new Date().toISOString(), data };
  const body = JSON.stringify(payload);
  let logSuccess = false;

  await Promise.all(
    endpoints
      .filter((ep) => !ep.events?.length || ep.events.includes(event) || ep.events.includes("*"))
      .map(async (ep) => {
        const signature = createHmac("sha256", ep.secret).update(body).digest("hex");
        let responseStatus = null;
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
        if (success) logSuccess = true;
      })
  );

  return { webhookHits: endpoints.length, logSuccess };
}

async function dispatchAppIntegrations(admin, companyId, event, data) {
  const notification = formatNotification(event, data);
  if (!notification) return;

  const { data: integrations } = await admin
    .from("app_integrations")
    .select("id, provider, credentials, settings, events")
    .eq("company_id", companyId)
    .eq("is_active", true);

  if (!integrations?.length) return;

  await Promise.all(
    integrations
      .filter((row) => {
        const events = row.events ?? [];
        return !events.length || events.includes(event) || events.includes("*");
      })
      .map(async (row) => {
        const url = row.credentials?.webhook_url;
        if (!url) return;
        try {
          await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: `*${notification.title}*\n${notification.body}` }),
            signal: AbortSignal.timeout(10000),
          });
          await admin
            .from("app_integrations")
            .update({ last_notified_at: new Date().toISOString() })
            .eq("id", row.id);
        } catch {
          // 通知失敗は業務処理を止めない
        }
      })
  );
}

function formatNotification(event, data) {
  switch (event) {
    case "deal.updated":
    case "deal.stage_changed":
      return {
        title: "BRIDGE: 商談更新",
        body: `商談「${data.title ?? "—"}」が更新されました。\nステージ: ${data.stage ?? "—"}`,
      };
    case "deal.closed":
      return {
        title: "BRIDGE: 商談クローズ",
        body: `商談「${data.title ?? "—"}」が ${data.stage === "won" ? "受注" : "失注"} になりました。`,
      };
    default:
      return { title: `BRIDGE: ${event}`, body: JSON.stringify(data) };
  }
}
