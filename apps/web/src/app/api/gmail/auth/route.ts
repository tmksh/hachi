import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/request-origin";
import {
  encodeGmailOAuthState,
  gmailCallbackUri,
  googleOAuthIssueToErrorCode,
  resolveOAuthRedirectOrigin,
  validateGoogleOAuthCredentials,
} from "@/lib/google-oauth-config";

export async function GET(request: Request) {
  const requestOrigin = getRequestOrigin(request);
  const oauthOrigin = resolveOAuthRedirectOrigin(requestOrigin);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", requestOrigin));
  }

  // 未設定・不正な Client ID のまま Google へ飛ぶと「401: invalid_client」になる
  const validated = validateGoogleOAuthCredentials();
  if (!validated.ok) {
    const code = googleOAuthIssueToErrorCode(validated.issue);
    return NextResponse.redirect(new URL(`/mail?gmail_error=${code}`, requestOrigin));
  }

  const scopes = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: validated.creds.clientId,
    // サブドメイン横断で固定の redirect_uri（Google Console 登録と一致させる）
    redirect_uri: gmailCallbackUri(oauthOrigin),
    response_type: "code",
    scope: scopes,
    access_type: "offline",
    prompt: "consent",
    // 完了後はテナント側 origin へ戻す
    state: encodeGmailOAuthState({ uid: user.id, returnOrigin: requestOrigin }),
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
