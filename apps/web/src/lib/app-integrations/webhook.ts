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

export function validateSlackWebhookUrl(url: string): void {
  const trimmed = url.trim();
  if (!trimmed) throw new Error("Webhook URL を入力してください");
  if (!matchHost(trimmed, ["hooks.slack.com"])) {
    throw new Error("Slack 用の Webhook URL 形式ではありません");
  }
}

export async function postSlackWebhookMessage(
  webhookUrl: string,
  title: string,
  body: string
): Promise<void> {
  validateSlackWebhookUrl(webhookUrl);

  const res = await fetch(webhookUrl.trim(), {
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
