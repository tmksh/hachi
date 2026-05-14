import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomBytes } from "crypto";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "プロフィールが見つかりません" }, { status: 404 });
  }

  // 既存の forward アカウントを確認
  const { data: existing } = await admin
    .from("email_accounts")
    .select("id, forward_address, email_address")
    .eq("user_id", user.id)
    .eq("provider", "forward")
    .single();

  if (existing) {
    return NextResponse.json({ forward_address: existing.forward_address });
  }

  // ユニークな転送先アドレスを生成
  const token = randomBytes(8).toString("hex");
  const domain = process.env.FORWARD_MAIL_DOMAIN ?? "inbound.bridge-crm.app";
  const forwardAddress = `fwd-${token}@${domain}`;

  // ダミーのメールアドレスは後で設定してもらう
  const { error: insertError } = await admin.from("email_accounts").insert({
    company_id: profile.company_id,
    user_id: user.id,
    provider: "forward",
    email_address: `forward-${token}@placeholder`,
    forward_address: forwardAddress,
    updated_at: new Date().toISOString(),
  });

  if (insertError) {
    console.error("Forward setup error:", insertError);
    return NextResponse.json({ error: "セットアップに失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ forward_address: forwardAddress });
}
