function normalizeWebhookUrl(url: string): string {
  return url.trim().replace(/^[\s"'<>]+|[\s"'<>]+$/g, "");
}

function isSlackWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(normalizeWebhookUrl(url));
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    const slackHost =
      host === "hooks.slack.com"
      || host.endsWith(".hooks.slack.com")
      || host === "slack.com"
      || host.endsWith(".slack.com");
    if (!slackHost) return false;
    return (
      path.includes("/services/")
      || path.includes("/triggers/")
      || path.includes("/workflows/")
      || host === "hooks.slack.com"
      || host.endsWith(".hooks.slack.com")
    );
  } catch {
    return false;
  }
}

export function validateSlackWebhookUrl(url: string): void {
  const trimmed = normalizeWebhookUrl(url);
  if (!trimmed) throw new Error("Webhook URL を入力してください");
  if (!isSlackWebhookUrl(trimmed)) {
    throw new Error("Slack 用の Webhook URL 形式ではありません");
  }
}

export async function postSlackWebhookMessage(
  webhookUrl: string,
  title: string,
  body: string
): Promise<void> {
  validateSlackWebhookUrl(webhookUrl);

  const res = await fetch(normalizeWebhookUrl(webhookUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: `*${title}*\n${body}` }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Webhook 送信失敗 (${res.status}): ${text.slice(0, 200)}`);
  }
}
