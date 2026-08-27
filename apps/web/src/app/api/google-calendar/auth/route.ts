import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/request-origin";
import {
  calendarCallbackUri,
  canonicalizeReturnOrigin,
  encodeGmailOAuthState,
  googleOAuthIssueToErrorCode,
  resolveOAuthRedirectOrigin,
  validateGoogleOAuthCredentials,
} from "@/lib/google-oauth-config";
import { GOOGLE_CALENDAR_SCOPES } from "@/lib/google-oauth-scopes";

export async function GET(request: NextRequest) {
  const requestOrigin = getRequestOrigin(request);
  const oauthOrigin = resolveOAuthRedirectOrigin(requestOrigin);
  const returnPath = request.nextUrl.searchParams.get("return") ?? "/settings?tab=external_integrations";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", requestOrigin));
  }

  const validated = validateGoogleOAuthCredentials();
  if (!validated.ok) {
    const code = googleOAuthIssueToErrorCode(validated.issue);
    return NextResponse.redirect(
      new URL(`${returnPath}${returnPath.includes("?") ? "&" : "?"}gcal_error=${code}`, requestOrigin),
    );
  }

  const redirectUri = calendarCallbackUri(oauthOrigin);
  const params = new URLSearchParams({
    client_id: validated.creds.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: encodeGmailOAuthState({
      uid: user.id,
      returnOrigin: canonicalizeReturnOrigin(requestOrigin),
      returnPath: returnPath.startsWith("/") && !returnPath.startsWith("//") ? returnPath : "/settings?tab=external_integrations",
      redirectUri,
    }),
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
}
