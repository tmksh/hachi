import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt, decrypt } from "@/lib/crypto";

interface GmailThread {
  id: string;
  snippet: string;
}

interface GmailMessage {
  id: string;
  internalDate?: string;
  payload?: {
    headers?: { name: string; value: string }[];
    body?: { data?: string };
    parts?: { mimeType: string; body?: { data?: string } }[];
  };
  snippet?: string;
}

function base64Decode(str: string): string {
  try {
    return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function extractBody(msg: GmailMessage): { text: string; html: string } {
  const payload = msg.payload;
  if (!payload) return { text: "", html: "" };

  let text = "";
  let html = "";

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        text = base64Decode(part.body.data);
      } else if (part.mimeType === "text/html" && part.body?.data) {
        html = base64Decode(part.body.data);
      }
    }
  } else if (payload.body?.data) {
    text = base64Decode(payload.body.data);
  }

  return { text, html };
}

function getHeader(msg: GmailMessage, name: string): string {
  return (
    msg.payload?.headers?.find(
      (h) => h.name.toLowerCase() === name.toLowerCase()
    )?.value ?? ""
  );
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token ?? null;
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();

  // Get email account
  const { data: account, error: accErr } = await admin
    .from("email_accounts")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", "gmail")
    .single();

  if (accErr || !account) {
    return NextResponse.json({ error: "No Gmail account connected" }, { status: 404 });
  }

  // Refresh token if expired
  let accessToken = await decrypt(account.access_token_encrypted as string);
  const expiresAt = account.token_expires_at
    ? new Date(account.token_expires_at as string).getTime()
    : 0;

  if (Date.now() >= expiresAt - 60_000) {
    const refreshToken = await decrypt(account.refresh_token_encrypted as string);
    const newToken = await refreshAccessToken(refreshToken);
    if (!newToken) {
      return NextResponse.json({ error: "Token refresh failed. Please reconnect Gmail." }, { status: 401 });
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

  // Fetch recent threads from Gmail API
  const listRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=50&labelIds=INBOX",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listRes.ok) {
    return NextResponse.json({ error: "Gmail API error" }, { status: 500 });
  }

  const listData = await listRes.json();
  const threads: GmailThread[] = listData.threads ?? [];

  let synced = 0;

  for (const t of threads) {
    // Check if already synced
    const { data: existing } = await admin
      .from("email_threads")
      .select("id")
      .eq("external_thread_id", t.id)
      .eq("account_id", account.id)
      .single();

    if (existing) continue;

    // Fetch thread detail
    const threadRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!threadRes.ok) continue;

    const threadData = await threadRes.json();
    const messages: GmailMessage[] = threadData.messages ?? [];
    if (messages.length === 0) continue;

    const lastMsg = messages[messages.length - 1];
    const firstMsg = messages[0];
    const subject = getHeader(firstMsg, "Subject") || "(件名なし)";
    const lastAt = lastMsg.internalDate
      ? new Date(parseInt(lastMsg.internalDate)).toISOString()
      : new Date().toISOString();

    // Insert thread
    const { data: newThread, error: threadInsertErr } = await admin
      .from("email_threads")
      .insert({
        company_id: account.company_id,
        account_id: account.id,
        external_thread_id: t.id,
        subject,
        snippet: threadData.snippet ?? "",
        is_read: false,
        is_starred: false,
        last_message_at: lastAt,
      })
      .select()
      .single();

    if (threadInsertErr || !newThread) continue;

    // Insert messages
    for (const msg of messages) {
      const from = getHeader(msg, "From");
      const fromMatch = from.match(/^"?([^"<]*)"?\s*<?([^>]*)>?$/);
      const fromName = fromMatch?.[1]?.trim() || from;
      const fromAddress = fromMatch?.[2]?.trim() || from;
      const toRaw = getHeader(msg, "To");
      const msgAt = msg.internalDate
        ? new Date(parseInt(msg.internalDate)).toISOString()
        : new Date().toISOString();
      const { text, html } = extractBody(msg);

      await admin.from("email_messages").insert({
        company_id: account.company_id,
        thread_id: newThread.id,
        external_message_id: msg.id,
        from_address: fromAddress,
        from_name: fromName,
        to_addresses: [{ address: toRaw }],
        subject,
        snippet: msg.snippet ?? "",
        body_text: text,
        body_html: html || null,
        received_at: msgAt,
        direction: "inbound",
      });
    }

    synced++;
  }

  // Update last_sync_at
  await admin
    .from("email_accounts")
    .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", account.id);

  return NextResponse.json({ synced, total: threads.length });
}
