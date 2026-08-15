import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto";
import { syncImapInbox, testImapConnection } from "@/lib/imap";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const email_address = String(body.email_address ?? "").trim();
  const display_name = String(body.display_name ?? "").trim();
  const imap_host = String(body.imap_host ?? "").trim();
  const imap_port = Number(body.imap_port);
  const imap_username = String(body.imap_username ?? "").trim();
  const imap_password = String(body.imap_password ?? "");
  const smtp_host = String(body.smtp_host ?? "").trim();
  const smtp_port = body.smtp_port ? Number(body.smtp_port) : null;
  const smtp_username = String(body.smtp_username ?? "").trim();
  const smtp_password = String(body.smtp_password ?? "");

  if (!email_address || !imap_host || !imap_port || !imap_username || !imap_password) {
    return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
  }
  if (imap_host.includes("%%") || smtp_host.includes("%%")) {
    return NextResponse.json(
      { error: "ホスト名の sv%% を実際のサーバー番号に変更してください" },
      { status: 400 },
    );
  }

  try {
    await testImapConnection({
      host: imap_host,
      port: imap_port,
      user: imap_username,
      pass: imap_password,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "IMAP接続に失敗しました" },
      { status: 400 },
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

  const { data: account, error: upsertError } = await admin
    .from("email_accounts")
    .upsert(
      {
        company_id: profile.company_id,
        user_id: user.id,
        provider: "imap",
        email_address,
        display_name: display_name || email_address,
        imap_host,
        imap_port,
        imap_username,
        imap_password_encrypted: encImapPass,
        smtp_host: smtp_host || null,
        smtp_port,
        smtp_username: smtp_username || null,
        smtp_password_encrypted: encSmtpPass,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider", ignoreDuplicates: false },
    )
    .select("id, company_id, imap_host, imap_port, imap_username")
    .single();

  if (upsertError || !account) {
    console.error("IMAP account upsert error:", upsertError);
    return NextResponse.json({ error: "アカウント情報の保存に失敗しました" }, { status: 500 });
  }

  try {
    const result = await syncImapInbox(admin, account, imap_password);
    return NextResponse.json({ ok: true, synced: result.synced, total: result.total });
  } catch (e) {
    console.error("IMAP initial sync error:", e);
    return NextResponse.json({
      ok: true,
      synced: 0,
      total: 0,
      sync_error: e instanceof Error ? e.message : "同期に失敗しました",
    });
  }
}
