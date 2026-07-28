import { createAdminClient } from "@/lib/supabase/admin";

export type GoogleAccessTokenResult =
  | { ok: true; accessToken: string }
  | {
      ok: false;
      reason: "not_connected" | "refresh_failed" | "config_missing" | "admin_unavailable";
      message: string;
    };

/**
 * ユーザーの Google Calendar 用アクセストークンを取得（必要なら refresh）。
 * profiles の OAuth トークンは admin 経由で読む（Server Action / RLS 差異を避ける）。
 */
export async function getValidGoogleAccessToken(
  userId: string,
): Promise<GoogleAccessTokenResult> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      ok: false,
      reason: "admin_unavailable",
      message: "Google連携の内部設定が不足しています",
    };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("google_access_token, google_refresh_token, google_token_expires_at")
    .eq("id", userId)
    .single();

  if (!profile?.google_access_token) {
    return {
      ok: false,
      reason: "not_connected",
      message: "Googleカレンダーが連携されていません",
    };
  }

  let accessToken = profile.google_access_token as string;
  const expiresAt = profile.google_token_expires_at
    ? new Date(profile.google_token_expires_at as string).getTime()
    : 0;

  if (expiresAt && Date.now() < expiresAt - 60_000) {
    return { ok: true, accessToken };
  }

  if (!profile.google_refresh_token) {
    return {
      ok: false,
      reason: "refresh_failed",
      message: "Googleトークンの有効期限が切れています。カレンダー画面から再連携してください",
    };
  }

  const clientId = process.env.GOOGLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return {
      ok: false,
      reason: "config_missing",
      message: "Google OAuth 設定（CLIENT_SECRET）が未設定です",
    };
  }

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: profile.google_refresh_token as string,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn("[getValidGoogleAccessToken] refresh failed", res.status, errText);
      return {
        ok: false,
        reason: "refresh_failed",
        message: "Googleトークンの更新に失敗しました。カレンダー画面から再連携してください",
      };
    }

    const tokens = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!tokens.access_token) {
      return {
        ok: false,
        reason: "refresh_failed",
        message: "Googleトークンの更新に失敗しました",
      };
    }

    accessToken = tokens.access_token;
    await admin
      .from("profiles")
      .update({
        google_access_token: accessToken,
        google_token_expires_at: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : null,
      })
      .eq("id", userId);

    return { ok: true, accessToken };
  } catch (e) {
    console.warn("[getValidGoogleAccessToken] error", e);
    return {
      ok: false,
      reason: "refresh_failed",
      message: "Googleトークンの更新中にエラーが発生しました",
    };
  }
}
