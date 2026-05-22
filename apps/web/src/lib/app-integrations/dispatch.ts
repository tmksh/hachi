import { createAdminClient } from "@/lib/supabase/admin";
import type { WebhookEvent } from "@/lib/webhooks";
import { formatChatworkMessage, postChatworkMessage } from "./chatwork";
import { formatIntegrationNotification } from "./format-message";
import { postKintoneRecord, validateKintoneCredentials } from "./kintone";
import { formatLineNotifyMessage, postLineNotify } from "./line-notify";
import { postLineWorksMessage, validateLineWorksCredentials } from "./line-works";
import type { AppIntegrationProvider } from "./types";
import { postWebhookMessage } from "./webhook";

type IntegrationRow = {
  id: string;
  provider: AppIntegrationProvider;
  credentials: Record<string, string>;
  settings: Record<string, string>;
  events: string[] | null;
};

export async function sendProviderNotification(
  provider: AppIntegrationProvider,
  credentials: Record<string, string>,
  settings: Record<string, string>,
  input: { title: string; body: string; event: string }
): Promise<void> {
  switch (provider) {
    case "chatwork": {
      const apiToken = credentials.api_token;
      const roomId = settings.room_id;
      if (!apiToken || !roomId) throw new Error("Chatwork の設定が不足しています");
      await postChatworkMessage(apiToken, roomId, formatChatworkMessage(input.title, input.body));
      return;
    }
    case "slack":
    case "teams":
    case "google_chat":
    case "discord": {
      const webhookUrl = credentials.webhook_url;
      if (!webhookUrl) throw new Error("Webhook URL が設定されていません");
      await postWebhookMessage(provider, webhookUrl, input.title, input.body);
      return;
    }
    case "line_notify": {
      const accessToken = credentials.access_token;
      if (!accessToken) throw new Error("LINE Notify トークンが設定されていません");
      await postLineNotify(accessToken, formatLineNotifyMessage(input.title, input.body));
      return;
    }
    case "line_works": {
      await postLineWorksMessage(
        validateLineWorksCredentials(credentials),
        formatLineNotifyMessage(input.title, input.body)
      );
      return;
    }
    case "kintone": {
      await postKintoneRecord(validateKintoneCredentials(credentials), settings, input);
      return;
    }
  }
}

export async function dispatchAppIntegrations(
  companyId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  const notification = formatIntegrationNotification(event, data);
  if (!notification) return;

  const admin = createAdminClient();
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
      .map((row) =>
        sendToIntegration(row as IntegrationRow, event, notification.title, notification.body)
      )
  );
}

async function sendToIntegration(
  row: IntegrationRow,
  event: string,
  title: string,
  body: string
): Promise<void> {
  try {
    await sendProviderNotification(row.provider, row.credentials, row.settings, {
      title,
      body,
      event,
    });

    const admin = createAdminClient();
    await admin
      .from("app_integrations")
      .update({ last_notified_at: new Date().toISOString() })
      .eq("id", row.id);
  } catch {
    // Notification failures should not block business operations.
  }
}

export async function sendIntegrationTest(
  provider: AppIntegrationProvider,
  credentials: Record<string, string>,
  settings: Record<string, string>
): Promise<void> {
  await sendProviderNotification(provider, credentials, settings, {
    title: "BRIDGE 連携テスト",
    body: `${getProviderLabel(provider)} 連携のテスト通知です。設定が正しく完了しています。`,
    event: "test.connected",
  });
}

function getProviderLabel(provider: AppIntegrationProvider): string {
  const labels: Record<AppIntegrationProvider, string> = {
    chatwork: "Chatwork",
    slack: "Slack",
    teams: "Microsoft Teams",
    google_chat: "Google Chat",
    discord: "Discord",
    line_notify: "LINE Notify",
    line_works: "LINE WORKS",
    kintone: "kintone",
  };
  return labels[provider];
}
