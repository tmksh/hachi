import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { decrypt } from "@/lib/crypto";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();

  const { data: account, error: accErr } = await admin
    .from("email_accounts")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", "imap")
    .single();

  if (accErr || !account) {
    return NextResponse.json({ error: "No IMAP account connected" }, { status: 404 });
  }

  const imapPass = await decrypt(account.imap_password_encrypted as string);

  const client = new ImapFlow({
    host: account.imap_host as string,
    port: account.imap_port as number,
    secure: (account.imap_port as number) === 993,
    auth: {
      user: account.imap_username as string,
      pass: imapPass,
    },
    logger: false,
  });

  try {
    await client.connect();

    const lock = await client.getMailboxLock("INBOX");
    let synced = 0;
    let total = 0;

    try {
      // Fetch last 50 messages
      const status = await client.status("INBOX", { messages: true });
      total = status.messages ?? 0;
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
          .single();

        if (existing) continue;

        if (!msg.source) continue;
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

        const { data: newThread, error: threadErr } = await admin
          .from("email_threads")
          .insert({
            company_id: account.company_id,
            account_id: account.id,
            external_thread_id: uid,
            subject,
            snippet: (parsed.text ?? "").substring(0, 200),
            is_read: isRead,
            is_starred: false,
            last_message_at: receivedAt,
          })
          .select()
          .single();

        if (threadErr || !newThread) continue;

        await admin.from("email_messages").insert({
          company_id: account.company_id,
          thread_id: newThread.id,
          external_message_id: uid,
          from_address: fromAddr,
          from_name: fromName,
          to_addresses: parsed.to?.value ?? [],
          subject,
          snippet: (parsed.text ?? "").substring(0, 200),
          body_text: parsed.text ?? "",
          body_html: parsed.html || null,
          received_at: receivedAt,
          direction: "inbound",
        });

        synced++;
      }
    } finally {
      lock.release();
    }

    await client.logout();

    await admin
      .from("email_accounts")
      .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", account.id);

    return NextResponse.json({ synced, total });
  } catch (e) {
    console.error("IMAP sync error:", e);
    return NextResponse.json({ error: `IMAP同期エラー: ${(e as Error).message}` }, { status: 500 });
  }
}
