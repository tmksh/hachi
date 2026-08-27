import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/request-origin";
import {
  calendarCallbackUri,
  gmailCallbackUri,
  readGoogleOAuthCredentials,
  resolveOAuthRedirectOrigin,
  validateGoogleOAuthCredentials,
} from "@/lib/google-oauth-config";

/** GCP に登録すべき redirect_uri をそのまま返す（秘密は出さない） */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestOrigin = getRequestOrigin(request);
  const oauthOrigin = resolveOAuthRedirectOrigin(requestOrigin);
  const raw = readGoogleOAuthCredentials();
  const validated = validateGoogleOAuthCredentials(raw);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
  let appUrlHost: string | null = null;
  try {
    if (appUrl) appUrlHost = new URL(appUrl).host;
  } catch {
    appUrlHost = appUrl || null;
  }

  return NextResponse.json({
    configured: validated.ok,
    issue: validated.ok ? null : validated.issue,
    requestOrigin,
    oauthOrigin,
    calendarRedirectUri: calendarCallbackUri(oauthOrigin),
    gmailRedirectUri: gmailCallbackUri(oauthOrigin),
    appUrlHost,
    clientIdSuffix: raw.clientId
      ? raw.clientId.slice(Math.max(0, raw.clientId.length - 36))
      : null,
  });
}
