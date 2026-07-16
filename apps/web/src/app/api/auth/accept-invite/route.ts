import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 招待メールのリンク先ハンドラー。
 *
 * 招待メールには ?token_hash=xxx&type=invite を付与する。
 * ここで:
 *   1. OTP を検証してセッションを確立（Cookie に保存）
 *   2. user_metadata から company_id / role / display_name を取得
 *   3. profiles をまだ持っていなければ作成
 *   4. /update-password?from=invite へリダイレクト（パスワード設定）
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  // 不正なアクセスはログインへ（invite / recovery を許可）
  if (!token_hash || (type !== "invite" && type !== "recovery")) {
    return NextResponse.redirect(`${origin}/login?error=invalid_invite`);
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash,
    type: type as "invite" | "recovery",
  });

  if (error || !data.user) {
    console.error("[accept-invite] verifyOtp failed", error?.message);
    return NextResponse.redirect(`${origin}/login?error=invite_expired`);
  }

  const user = data.user;
  const meta = (user.user_metadata ?? {}) as {
    company_id?: string;
    role?: string;
    display_name?: string;
  };

  // profiles がまだなければ Service Role で作成
  if (meta.company_id && meta.role && meta.display_name) {
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!existing) {
      await admin.from("profiles").insert({
        id: user.id,
        company_id: meta.company_id,
        display_name: meta.display_name,
        email: user.email ?? "",
        role: meta.role,
      });
    }
  }

  // パスワード設定ページへ（Google 連携は任意なので onboarding はその後）
  return NextResponse.redirect(`${origin}/update-password?from=invite`);
}
