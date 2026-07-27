import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt, decrypt } from "@/lib/crypto";

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.access_token as string | undefined) ?? null;
}

function toBase64Url(raw: string): string {
  return Buffer.from(raw, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function formatAddress(addr: { name?: string; address: string }): string {
  const email = addr.address.trim();
  const name = addr.name?.trim();
  if (!name) return email;
  return `${name} <${email}>`;
}

/**
 * 連携済み Gmail アカウント経由でメール送信する。
 * 未連携・トークン失効時は Error を throw（偽の「送信しました」を防ぐ）。
 */
export async function sendViaGmailAccount(input: {
  userId: string;
  to: Array<{ name?: string; address: string }>;
  cc?: Array<{ name?: string; address: string }>;
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
}): Promise<{ accountId: string; emailAddress: string; gmailMessageId: string | null }> {
  const admin = createAdminClient();
  const { data: account, error: accErr } = await admin
    .from("email_accounts")
    .select("id, email_address, access_token_encrypted, refresh_token_encrypted, token_expires_at")
    .eq("user_id", input.userId)
    .eq("provider", "gmail")
    .maybeSingle();

  if (accErr) {
    throw new Error(`Gmailアカウントの取得に失敗しました: ${accErr.message}`);
  }
  if (!account) {
    throw new Error("Gmailが連携されていません。メール設定からGmail連携を完了してください");
  }

  let accessToken = await decrypt(account.access_token_encrypted as string);
  const expiresAt = account.token_expires_at
    ? new Date(account.token_expires_at as string).getTime()
    : 0;

  if (!accessToken || Date.now() >= expiresAt - 60_000) {
    const refreshToken = await decrypt(account.refresh_token_encrypted as string);
    if (!refreshToken) {
      throw new Error("Gmailトークンが無効です。メール設定からGmailを再連携してください");
    }
    const newToken = await refreshAccessToken(refreshToken);
    if (!newToken) {
      throw new Error("Gmailトークンの更新に失敗しました。メール設定からGmailを再連携してください");
    }
    accessToken = newToken;
    const encNewToken = await encrypt(newToken);
    await admin
      .from("email_accounts")
      .update({
        access_token_encrypted: encNewToken,
        token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id);
  }

  const from = account.email_address as string;
  const toLine = input.to.map(formatAddress).join(", ");
  const ccLine = (input.cc ?? []).map(formatAddress).join(", ");
  const boundary = `bridge_${Date.now().toString(36)}`;
  const textBody = input.bodyText;
  const htmlBody =
    input.bodyHtml?.trim() ||
    textBody
      .split("\n")
      .map((line) => `<p style="margin:0 0 8px;white-space:pre-wrap;">${line.replace(/</g, "&lt;").replace(/>/g, "&gt;") || "&nbsp;"}</p>`)
      .join("");

  const mime = [
    `From: ${from}`,
    `To: ${toLine}`,
    ...(ccLine ? [`Cc: ${ccLine}`] : []),
    `Subject: =?UTF-8?B?${Buffer.from(input.subject, "utf8").toString("base64")}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    textBody,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;">${htmlBody}</div>`,
    "",
    `--${boundary}--`,
  ].join("\r\n");

  const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: toBase64Url(mime) }),
  });

  if (!sendRes.ok) {
    const errText = await sendRes.text().catch(() => "");
    console.error("[sendViaGmailAccount] Gmail API error", sendRes.status, errText);
    if (sendRes.status === 401 || sendRes.status === 403) {
      throw new Error("Gmail送信権限がありません。Gmail APIを有効化し、メール設定から再連携してください");
    }
    throw new Error("Gmail APIでの送信に失敗しました");
  }

  const sent = (await sendRes.json()) as { id?: string };
  return {
    accountId: account.id as string,
    emailAddress: from,
    gmailMessageId: sent.id ?? null,
  };
}
