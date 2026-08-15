import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ImapAccountRow = {
  id: string;
  company_id: string;
  imap_host: string;
  imap_port: number;
  imap_username: string;
};

export function createImapClient(input: {
  host: string;
  port: number;
  user: string;
  pass: string;
}) {
  return new ImapFlow({
    host: input.host.trim(),
    port: input.port,
    secure: input.port === 993,
    auth: { user: input.user, pass: input.pass },
    logger: false,
  });
}

export async function testImapConnection(input: {
  host: string;
  port: number;
  user: string;
  pass: string;
}): Promise<void> {
  if (input.host.includes("%%")) {
    throw new Error("IMAPホストの sv%% を実際のサーバー番号に変更してください");
  }
  const client = createImapClient(input);
  try {
    await client.connect();
    await client.logout();
  } catch (e) {
    throw new Error(`IMAP接続に失敗しました: ${(e as Error).message}`);
  }
}

export async function syncImapInbox(
  admin: SupabaseClient,
  account: ImapAccountRow,
  password: string,
): Promise<{ synced: number; total: number }> {
  const client = createImapClient({
    host: account.imap_host,
    port: account.imap_port,
    user: account.imap_username,
    pass: password,
  });

  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  let synced = 0;
  let total = 0;

  try {
    const status = await client.status("INBOX", { messages: true });
    total = status.messages ?? 0;
    if (total === 0) {
      return { synced: 0, total: 0 };
    }

    const from = Math.max(1, total - 49);
    for await (const msg of client.fetch(`${from}:*`, {
      uid: true,
      source: true,
      flags: true,
    })) {
      const uid = String(msg.uid);
      const { data: existing } = await admin
        .from("email_threads")
        .select("id")
        .eq("external_thread_id", uid)
        .eq("account_id", account.id)
        .maybeSingle();
      if (existing || !msg.source) continue;

      const parsed = (await simpleParser(msg.source)) as unknown as {
        subject?: string;
        from?: { value?: Array<{ address?: string; name?: string }> };
        to?: { value?: Array<{ address?: string; name?: string }> };
        date?: Date;
        text?: string;
        html?: string | false;
      };
      const subject = parsed.subject ?? "(件名なし)";
      const fromAddr = Array.isArray(parsed.from?.value)
        ? (parsed.from?.value[0]?.address ?? "")
        : "";
      const fromName = Array.isArray(parsed.from?.value)
        ? (parsed.from?.value[0]?.name ?? "")
        : "";
      const receivedAt = (parsed.date ?? new Date()).toISOString();
      const isRead = msg.flags?.has("\\Seen") ?? false;
      const snippet = (parsed.text ?? "").substring(0, 200);
      const toAddresses = Array.isArray(parsed.to?.value) ? parsed.to.value : [];

      const { data: newThread, error: threadErr } = await admin
        .from("email_threads")
        .insert({
          company_id: account.company_id,
          account_id: account.id,
          external_thread_id: uid,
          subject,
          snippet,
          is_read: isRead,
          is_starred: false,
          last_message_at: receivedAt,
        })
        .select("id")
        .single();
      if (threadErr || !newThread) {
        console.error("IMAP thread insert failed:", threadErr?.message);
        continue;
      }

      const { error: msgErr } = await admin.from("email_messages").insert({
        company_id: account.company_id,
        thread_id: newThread.id,
        external_message_id: uid,
        from_address: fromAddr,
        from_name: fromName,
        to_addresses: toAddresses,
        subject,
        snippet,
        body_text: parsed.text ?? "",
        body_html: parsed.html || null,
        received_at: receivedAt,
        direction: "inbound",
      });
      if (msgErr) {
        console.error("IMAP message insert failed:", msgErr.message);
        continue;
      }
      synced++;
    }
  } finally {
    lock.release();
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }

  await admin
    .from("email_accounts")
    .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", account.id);

  return { synced, total };
}
