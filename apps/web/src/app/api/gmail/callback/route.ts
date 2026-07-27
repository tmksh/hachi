import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestOrigin } from "@/lib/request-origin";
import { encrypt } from "@/lib/crypto";
import {
  decodeGmailOAuthState,
  gmailCallbackUri,
  resolveOAuthRedirectOrigin,
  validateGoogleOAuthCredentials,
} from "@/lib/google-oauth-config";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestOrigin = getRequestOrigin(request);
  const oauthOrigin = resolveOAuthRedirectOrigin(requestOrigin);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const decoded = state ? decodeGmailOAuthState(state) : null;
  const returnOrigin = (decoded?.returnOrigin || requestOrigin).replace(/\/$/, "");
  const userId = decoded?.uid;

  if (error || !code || !userId) {
    return NextResponse.redirect(`${returnOrigin}/mail?gmail_error=access_denied`);
  }

  try {
    const validated = validateGoogleOAuthCredentials();
    if (!validated.ok) {
      return NextResponse.redirect(`${returnOrigin}/mail?gmail_error=oauth_not_configured`);
    }

    // Exchange code for tokens（auth 時と同じ固定 redirect_uri を使う）
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: validated.creds.clientId,
        client_secret: validated.creds.clientSecret,
        redirect_uri: gmailCallbackUri(oauthOrigin),
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Gmail token exchange failed:", err);
      // client_id / secret 不一致は Google が invalid_client を返す
      if (/invalid_client/i.test(err)) {
        return NextResponse.redirect(`${returnOrigin}/mail?gmail_error=invalid_client`);
      }
      if (/redirect_uri_mismatch/i.test(err)) {
        return NextResponse.redirect(`${returnOrigin}/mail?gmail_error=redirect_uri_mismatch`);
      }
      return NextResponse.redirect(`${returnOrigin}/mail?gmail_error=token_exchange`);
    }

    const tokens = await tokenRes.json();
    const { access_token, refresh_token, expires_in } = tokens;

    // Fetch Gmail user info
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const userInfo = await userInfoRes.json();
    const emailAddress: string = userInfo.email;

    // Get user's company_id
    const supabase = createAdminClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .single();

    if (!profile) {
      return NextResponse.redirect(`${returnOrigin}/mail?gmail_error=profile_not_found`);
    }

    const tokenExpiresAt = new Date(
      Date.now() + (expires_in ?? 3600) * 1000
    ).toISOString();

    const [encAccessToken, encRefreshToken] = await Promise.all([
      encrypt(access_token),
      refresh_token ? encrypt(refresh_token) : Promise.resolve(null),
    ]);

    // Upsert email_account
    const { error: upsertError } = await supabase
      .from("email_accounts")
      .upsert(
        {
          company_id: profile.company_id,
          user_id: userId,
          provider: "gmail",
          email_address: emailAddress,
          oauth_subject: userInfo.id,
          access_token_encrypted: encAccessToken,
          refresh_token_encrypted: encRefreshToken,
          token_expires_at: tokenExpiresAt,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,provider",
          ignoreDuplicates: false,
        }
      );

    if (upsertError) {
      console.error("Email account upsert error:", upsertError);
      return NextResponse.redirect(`${returnOrigin}/mail?gmail_error=db_error`);
    }

    return NextResponse.redirect(`${returnOrigin}/mail?gmail_connected=1`);
  } catch (e) {
    console.error("Gmail callback error:", e);
    return NextResponse.redirect(`${returnOrigin}/mail?gmail_error=unknown`);
  }
}
