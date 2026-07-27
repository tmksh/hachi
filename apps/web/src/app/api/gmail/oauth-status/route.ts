import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/request-origin";
import {
  gmailCallbackUri,
  readGoogleOAuthCredentials,
  resolveOAuthRedirectOrigin,
  validateGoogleOAuthCredentials,
} from "@/lib/google-oauth-config";

/**
 * Gmail OAuth 設定の診断（秘密は返さない）。
 * GCP の Authorized redirect URIs に redirectUri をそのまま登録する。
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = getRequestOrigin(request);
  const redirectUri = gmailCallbackUri(resolveOAuthRedirectOrigin(origin));
  const raw = readGoogleOAuthCredentials();
  const validated = validateGoogleOAuthCredentials(raw);

  return NextResponse.json({
    configured: validated.ok,
    issue: validated.ok ? null : validated.issue,
    clientIdSuffix: raw.clientId
      ? raw.clientId.slice(Math.max(0, raw.clientId.length - 36))
      : null,
    redirectUri,
    checklist: [
      "Google Cloud Console → APIとサービス → 認証情報",
      "OAuth 2.0 クライアント ID の種類は「ウェブアプリケーション」",
      `承認済みのリダイレクト URI に次を追加: ${redirectUri}`,
      "Gmail API を有効化",
      "OAuth同意画面が「テスト」の場合はテストユーザーに自分の Google アカウントを追加（※ invalid_client の原因にはならない）",
      "ホスティング環境にも GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET を設定し再デプロイ",
    ],
  });
}
