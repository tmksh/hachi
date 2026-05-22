"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchChatworkRooms } from "@/lib/app-integrations/chatwork";
import { sendIntegrationTest } from "@/lib/app-integrations/dispatch";
import { resolveKintoneSettings, validateKintoneCredentials } from "@/lib/app-integrations/kintone";
import { validateLineWorksCredentials } from "@/lib/app-integrations/line-works";
import { getProviderDefinition } from "@/lib/app-integrations/providers/registry";
import { validateWebhookUrl } from "@/lib/app-integrations/webhook";
import {
  DEFAULT_INTEGRATION_EVENTS,
  type AppIntegrationPublic,
  type AppIntegrationProvider,
  type ChatworkRoom,
} from "@/lib/app-integrations/types";

async function getAdminContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("認証が必要です");
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single();
  if (!profile || !["owner", "hq_admin"].includes(profile.role)) {
    throw new Error("権限がありません");
  }
  return { supabase, company_id: profile.company_id, user_id: user.id };
}

function maskSecret(value: string | undefined): string | null {
  if (!value) return null;
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function buildSummary(
  provider: AppIntegrationProvider,
  settings: Record<string, string>
): string | null {
  switch (provider) {
    case "chatwork":
      return settings.room_name ? `通知ルーム: ${settings.room_name}` : null;
    case "slack":
      return "Incoming Webhook";
    case "teams":
      return "Incoming Webhook";
    case "google_chat":
      return "スペース Webhook";
    case "discord":
      return "チャンネル Webhook";
    case "line_notify":
      return "LINE Notify";
    case "line_works":
      return settings.channel_id ? `Channel ID: ${settings.channel_id}` : "Bot 通知";
    case "kintone":
      return settings.subdomain_label
        ? `${settings.subdomain_label}.cybozu.com / App ${settings.app_id_label ?? ""}`.trim()
        : null;
    default:
      return null;
  }
}

function buildCredentialHint(
  provider: AppIntegrationProvider,
  credentials: Record<string, string>
): string | null {
  switch (provider) {
    case "chatwork":
    case "kintone":
      return maskSecret(credentials.api_token);
    case "slack":
    case "teams":
    case "google_chat":
    case "discord":
      return maskSecret(credentials.webhook_url);
    case "line_notify":
      return maskSecret(credentials.access_token);
    case "line_works":
      return maskSecret(credentials.client_secret);
    default:
      return null;
  }
}

function toPublic(row: {
  id: string;
  provider: AppIntegrationProvider;
  is_active: boolean;
  events: string[] | null;
  connected_at: string | null;
  settings: Record<string, string> | null;
  credentials: Record<string, string> | null;
}): AppIntegrationPublic {
  const settings = (row.settings ?? {}) as Record<string, string>;
  const credentials = row.credentials ?? {};

  return {
    id: row.id,
    provider: row.provider,
    is_active: row.is_active,
    events: row.events ?? [...DEFAULT_INTEGRATION_EVENTS],
    connected_at: row.connected_at,
    settings,
    credential_hint: buildCredentialHint(row.provider, credentials),
    summary: buildSummary(row.provider, settings),
  };
}

function validateCredentials(provider: AppIntegrationProvider, credentials: Record<string, string>) {
  const definition = getProviderDefinition(provider);

  for (const field of definition.fields) {
    if (!credentials[field.key]?.trim()) {
      throw new Error(`${field.label} を入力してください`);
    }
  }

  switch (provider) {
    case "slack":
    case "teams":
    case "google_chat":
    case "discord":
      validateWebhookUrl(provider, credentials.webhook_url);
      break;
    case "line_works":
      validateLineWorksCredentials(credentials);
      break;
    case "kintone":
      validateKintoneCredentials(credentials);
      break;
  }
}

export async function getAppIntegrations(): Promise<AppIntegrationPublic[]> {
  const { supabase, company_id } = await getAdminContext();
  const { data, error } = await supabase
    .from("app_integrations")
    .select("id, provider, is_active, events, connected_at, settings, credentials")
    .eq("company_id", company_id)
    .order("provider");
  if (error) throw error;
  return (data ?? []).map((row) => toPublic(row as Parameters<typeof toPublic>[0]));
}

export async function listChatworkRooms(apiToken: string): Promise<ChatworkRoom[]> {
  await getAdminContext();
  if (!apiToken.trim()) throw new Error("API トークンを入力してください");
  return fetchChatworkRooms(apiToken);
}

export async function connectAppIntegration(input: {
  provider: AppIntegrationProvider;
  credentials: Record<string, string>;
  settings?: Record<string, string>;
  events?: string[];
}) {
  const { supabase, company_id, user_id } = await getAdminContext();
  const provider = input.provider;
  const credentials = Object.fromEntries(
    Object.entries(input.credentials).map(([key, value]) => [key, value.trim()])
  );
  const settings = Object.fromEntries(
    Object.entries(input.settings ?? {}).map(([key, value]) => [key, value.trim()])
  );

  validateCredentials(provider, credentials);

  if (provider === "kintone") {
    const kintone = validateKintoneCredentials(credentials);
    settings.subdomain_label = kintone.subdomain;
    settings.app_id_label = kintone.app_id;
    resolveKintoneSettings(settings);
  }

  await sendIntegrationTest(provider, credentials, settings);

  const payload = {
    company_id,
    provider,
    credentials,
    settings,
    events: input.events?.length ? input.events : [...DEFAULT_INTEGRATION_EVENTS],
    is_active: true,
    connected_at: new Date().toISOString(),
    created_by: user_id,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("app_integrations")
    .upsert(payload, { onConflict: "company_id,provider" })
    .select("id, provider, is_active, events, connected_at, settings, credentials")
    .single();
  if (error) throw error;
  return toPublic(data as Parameters<typeof toPublic>[0]);
}

/** @deprecated Use connectAppIntegration */
export async function connectChatwork(input: {
  apiToken: string;
  roomId: string;
  roomName: string;
  events?: string[];
}) {
  return connectAppIntegration({
    provider: "chatwork",
    credentials: { api_token: input.apiToken },
    settings: { room_id: input.roomId, room_name: input.roomName },
    events: input.events,
  });
}

/** @deprecated Use connectAppIntegration */
export async function connectSlack(input: { webhookUrl: string; events?: string[] }) {
  return connectAppIntegration({
    provider: "slack",
    credentials: { webhook_url: input.webhookUrl },
    events: input.events,
  });
}

export async function updateAppIntegrationEvents(
  provider: AppIntegrationProvider,
  events: string[]
) {
  const { supabase, company_id } = await getAdminContext();
  if (!events.length) throw new Error("通知イベントを1つ以上選択してください");

  const { data, error } = await supabase
    .from("app_integrations")
    .update({ events, updated_at: new Date().toISOString() })
    .eq("company_id", company_id)
    .eq("provider", provider)
    .select("id, provider, is_active, events, connected_at, settings, credentials")
    .single();
  if (error) throw error;
  return toPublic(data as Parameters<typeof toPublic>[0]);
}

export async function disconnectAppIntegration(provider: AppIntegrationProvider) {
  const { supabase, company_id } = await getAdminContext();
  const { error } = await supabase
    .from("app_integrations")
    .delete()
    .eq("company_id", company_id)
    .eq("provider", provider);
  if (error) throw error;
}

export async function testAppIntegration(provider: AppIntegrationProvider) {
  const { supabase, company_id } = await getAdminContext();
  const { data, error } = await supabase
    .from("app_integrations")
    .select("provider, credentials, settings")
    .eq("company_id", company_id)
    .eq("provider", provider)
    .eq("is_active", true)
    .single();
  if (error || !data) throw new Error("連携が見つかりません");

  await sendIntegrationTest(
    data.provider as AppIntegrationProvider,
    (data.credentials ?? {}) as Record<string, string>,
    (data.settings ?? {}) as Record<string, string>
  );
}

export async function getProviderDefinitionsForClient() {
  await getAdminContext();
  const { PROVIDER_DEFINITIONS } = await import("@/lib/app-integrations/providers/registry");
  return PROVIDER_DEFINITIONS.map(({ provider, name, description, color, connectHint, fields, settingsFields }) => ({
    provider,
    name,
    description,
    color,
    connectHint,
    fields,
    settingsFields: settingsFields ?? [],
  }));
}
