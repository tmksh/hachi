type LineWorksCredentials = {
  client_id: string;
  client_secret: string;
  bot_id: string;
  channel_id: string;
};

async function getLineWorksAccessToken(credentials: LineWorksCredentials): Promise<string> {
  const basic = Buffer.from(
    `${credentials.client_id.trim()}:${credentials.client_secret.trim()}`
  ).toString("base64");

  const res = await fetch("https://auth.worksmobile.com/oauth2/v2.0/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "bot",
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LINE WORKS 認証失敗 (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("LINE WORKS アクセストークンを取得できませんでした");
  return data.access_token;
}

export async function postLineWorksMessage(
  credentials: LineWorksCredentials,
  text: string
): Promise<void> {
  const accessToken = await getLineWorksAccessToken(credentials);
  const botId = credentials.bot_id.trim();
  const channelId = credentials.channel_id.trim();
  if (!botId || !channelId) throw new Error("Bot ID と Channel ID を入力してください");

  const res = await fetch(
    `https://www.worksapis.com/v1.0/bots/${botId}/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: { type: "text", text },
      }),
      signal: AbortSignal.timeout(10000),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LINE WORKS 送信失敗 (${res.status}): ${body.slice(0, 200)}`);
  }
}

export function validateLineWorksCredentials(credentials: Record<string, string>): LineWorksCredentials {
  const parsed = {
    client_id: credentials.client_id?.trim() ?? "",
    client_secret: credentials.client_secret?.trim() ?? "",
    bot_id: credentials.bot_id?.trim() ?? "",
    channel_id: credentials.channel_id?.trim() ?? "",
  };
  if (!parsed.client_id || !parsed.client_secret || !parsed.bot_id || !parsed.channel_id) {
    throw new Error("LINE WORKS の Client ID / Secret / Bot ID / Channel ID をすべて入力してください");
  }
  return parsed;
}
