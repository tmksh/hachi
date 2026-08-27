import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestOrigin } from "@/lib/request-origin";
import {
  appendQuery,
  calendarCallbackUri,
  canonicalizeReturnOrigin,
  decodeGmailOAuthState,
  isAllowedOAuthRedirectUri,
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
  const returnOrigin = canonicalizeReturnOrigin(decoded?.returnOrigin || requestOrigin);
  const tokenRedirectUri =
    decoded?.redirectUri && isAllowedOAuthRedirectUri(decoded.redirectUri)
      ? decoded.redirectUri
      : calendarCallbackUri(oauthOrigin);
  const userId = decoded?.uid;
  const rawReturn = decoded?.returnPath ?? "";
  const returnPath =
    rawReturn.startsWith("/") && !rawReturn.startsWith("//")
      ? rawReturn
      : "/settings?tab=external_integrations";

  const back = (params: Record<string, string>) =>
    NextResponse.redirect(`${returnOrigin}${appendQuery(returnPath, params)}`);

  if (error || !code || !userId) {
    return back({ gcal_error: "access_denied" });
  }

  try {
    const validated = validateGoogleOAuthCredentials();
    if (!validated.ok) {
      return back({ gcal_error: "oauth_not_configured" });
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: validated.creds.clientId,
        client_secret: validated.creds.clientSecret,
        redirect_uri: tokenRedirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("[google-calendar/callback] token exchange failed:", err);
      if (/invalid_client/i.test(err)) {
        return back({ gcal_error: "invalid_client" });
      }
      if (/redirect_uri_mismatch/i.test(err)) {
        return back({ gcal_error: "redirect_uri_mismatch" });
      }
      return back({ gcal_error: "token_exchange" });
    }

    const tokens = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };

    if (!tokens.access_token) {
      return back({ gcal_error: "token_exchange" });
    }

    const hasCalendarWrite =
      !tokens.scope ||
      /calendar(\.events)?/.test(tokens.scope);
    if (!hasCalendarWrite) {
      return back({ gcal_error: "missing_calendar_scope" });
    }

    const admin = createAdminClient();
    const tokenExpiresAt = new Date(
      Date.now() + (tokens.expires_in ?? 3600) * 1000,
    ).toISOString();

    const updatePayload: Record<string, string> = {
      google_access_token: tokens.access_token,
      google_token_expires_at: tokenExpiresAt,
    };
    if (tokens.refresh_token) {
      updatePayload.google_refresh_token = tokens.refresh_token;
    }

    const { error: updateError } = await admin
      .from("profiles")
      .update(updatePayload)
      .eq("id", userId);

    if (updateError) {
      console.error("[google-calendar/callback] profile update failed:", updateError);
      return back({ gcal_error: "db_error" });
    }

    return back({ gcal_connected: "1" });
  } catch (e) {
    console.error("[google-calendar/callback] error:", e);
    return back({ gcal_error: "unknown" });
  }
}
