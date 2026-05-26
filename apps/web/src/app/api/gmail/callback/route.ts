import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestOrigin } from "@/lib/request-origin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = getRequestOrigin(request);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // user_id
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(`${origin}/mail?gmail_error=access_denied`);
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${origin}/api/gmail/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Gmail token exchange failed:", err);
      return NextResponse.redirect(`${origin}/mail?gmail_error=token_exchange`);
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
      .eq("id", state)
      .single();

    if (!profile) {
      return NextResponse.redirect(`${origin}/mail?gmail_error=profile_not_found`);
    }

    const tokenExpiresAt = new Date(
      Date.now() + (expires_in ?? 3600) * 1000
    ).toISOString();

    // Upsert email_account
    const { error: upsertError } = await supabase
      .from("email_accounts")
      .upsert(
        {
          company_id: profile.company_id,
          user_id: state,
          provider: "gmail",
          email_address: emailAddress,
          oauth_subject: userInfo.id,
          access_token_encrypted: access_token,
          refresh_token_encrypted: refresh_token ?? null,
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
      return NextResponse.redirect(`${origin}/mail?gmail_error=db_error`);
    }

    return NextResponse.redirect(`${origin}/mail?gmail_connected=1`);
  } catch (e) {
    console.error("Gmail callback error:", e);
    return NextResponse.redirect(`${origin}/mail?gmail_error=unknown`);
  }
}
