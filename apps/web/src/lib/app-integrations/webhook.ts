import type { AppIntegrationProvider } from "./types";

function matchHost(url: string, hosts: string[]): boolean {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:") return false;
    return hosts.some(
      (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
    );
  } catch {
    return false;
  }
}

export function validateWebhookUrl(provider: AppIntegrationProvider, url: string): void {
  const trimmed = url.trim();
  if (!trimmed) throw new Error("Webhook URL を入力してください");

  const rules: Partial<Record<AppIntegrationProvider, string[]>> = {
    slack: ["hooks.slack.com"],
    teams: ["webhook.office.com", "outlook.office.com"],
    google_chat: ["chat.googleapis.com"],
    discord: ["discord.com"],
  };

  const hosts = rules[provider];
  if (!hosts) throw new Error("Webhook URL 形式が不正です");
  if (!matchHost(trimmed, hosts)) {
    throw new Error(`${provider} 用の Webhook URL 形式ではありません`);
  }
}

export async function postWebhookMessage(
  provider: Extract<AppIntegrationProvider, "slack" | "teams" | "google_chat" | "discord">,
  webhookUrl: string,
  title: string,
  body: string
): Promise<void> {
  validateWebhookUrl(provider, webhookUrl);

  let payload: Record<string, unknown>;
  switch (provider) {
    case "slack":
      payload = { text: `*${title}*\n${body}` };
      break;
    case "teams":
      payload = {
        "@type": "MessageCard",
        "@context": "https://schema.org/extensions",
        summary: title,
        themeColor: "6BC9B3",
        title,
        text: body.replace(/\n/g, "<br>"),
      };
      break;
    case "google_chat":
      payload = { text: `*${title}*\n${body}` };
      break;
    case "discord":
      payload = { content: `**${title}**\n${body}` };
      break;
  }

  const res = await fetch(webhookUrl.trim(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Webhook 送信失敗 (${res.status}): ${text.slice(0, 200)}`);
  }
}
