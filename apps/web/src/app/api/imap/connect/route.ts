import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ImapFlow } from "imapflow";
import { encrypt } from "@/lib/crypto";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const {
    email_address,
    display_name,
    imap_host,
    imap_port,
    imap_username,
    imap_password,
    smtp_host,
    smtp_port,
    smtp_username,
    smtp_password,
  } = body as {
    email_address: string;
    display_name?: string;
    imap_host: string;
    imap_port: number;
    imap_username: string;
    imap_password: string;
    smtp_host: string;
    smtp_port: number;
    smtp_username: string;
    smtp_password: string;
  };

  if (!email_address || !imap_host || !imap_port || !imap_username || !imap_password) {
    return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
  }

  // IMAP接続テスト
  const client = new ImapFlow({
    host: imap_host,
    port: imap_port,
    secure: imap_port === 993,
    auth: { user: imap_username, pass: imap_password },
    logger: false,
  });

  try {
    await client.connect();
    await client.logout();
  } catch (e) {
    return NextResponse.json(
      { error: `IMAP接続に失敗しました: ${(e as Error).message}` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "プロフィールが見つかりません" }, { status: 404 });
  }

  const [encImapPass, encSmtpPass] = await Promise.all([
    encrypt(imap_password),
    smtp_password ? encrypt(smtp_password) : Promise.resolve(null),
  ]);

  const { error: upsertError } = await admin
    .from("email_accounts")
    .upsert(
      {
        company_id: profile.company_id,
        user_id: user.id,
        provider: "imap",
        email_address,
        display_name: display_name ?? "",
        imap_host,
        imap_port,
        imap_username,
        imap_password_encrypted: encImapPass,
        smtp_host: smtp_host ?? null,
        smtp_port: smtp_port ?? null,
        smtp_username: smtp_username ?? null,
        smtp_password_encrypted: encSmtpPass,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider", ignoreDuplicates: false }
    );

  if (upsertError) {
    console.error("IMAP account upsert error:", upsertError);
    return NextResponse.json({ error: "アカウント情報の保存に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
