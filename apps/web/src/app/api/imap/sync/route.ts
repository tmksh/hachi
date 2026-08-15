import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { syncImapInbox } from "@/lib/imap";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data: account, error: accErr } = await admin
    .from("email_accounts")
    .select("id, company_id, imap_host, imap_port, imap_username, imap_password_encrypted")
    .eq("user_id", user.id)
    .eq("provider", "imap")
    .maybeSingle();

  if (accErr || !account) {
    return NextResponse.json({ error: "IMAPアカウントが連携されていません" }, { status: 404 });
  }
  if (!account.imap_host || !account.imap_username || !account.imap_password_encrypted) {
    return NextResponse.json({ error: "IMAP接続情報が不足しています" }, { status: 400 });
  }

  try {
    const imapPass = await decrypt(account.imap_password_encrypted as string);
    const result = await syncImapInbox(
      admin,
      {
        id: account.id,
        company_id: account.company_id,
        imap_host: account.imap_host,
        imap_port: Number(account.imap_port ?? 993),
        imap_username: account.imap_username,
      },
      imapPass,
    );
    return NextResponse.json(result);
  } catch (e) {
    console.error("IMAP sync error:", e);
    return NextResponse.json(
      { error: `IMAP同期エラー: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
