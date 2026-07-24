/**
 * Gmail / Google Calendar 共通の OAuth 資格情報チェック。
 * 「Error 401: invalid_client」はテストユーザー不足ではなく、
 * Client ID 未設定・形式不正・削除済みクライアント・種別違いが原因。
 */

export type GoogleOAuthIssue =
  | "missing"
  | "invalid_format"
  | "placeholder";

export type GoogleOAuthCredentials = {
  clientId: string;
  clientSecret: string;
};

function stripQuotes(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

export function readGoogleOAuthCredentials(): {
  clientId: string;
  clientSecret: string;
} {
  const clientId = stripQuotes(
    process.env.GOOGLE_CLIENT_ID
      ?? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
      ?? "",
  );
  const clientSecret = stripQuotes(process.env.GOOGLE_CLIENT_SECRET ?? "");
  return { clientId, clientSecret };
}

export function validateGoogleOAuthCredentials(
  creds: GoogleOAuthCredentials = readGoogleOAuthCredentials(),
): { ok: true; creds: GoogleOAuthCredentials } | { ok: false; issue: GoogleOAuthIssue } {
  const { clientId, clientSecret } = creds;
  if (!clientId || !clientSecret) {
    return { ok: false, issue: "missing" };
  }
  if (
    clientId === "..."
    || clientSecret === "..."
    || /your-|xxxx|example|changeme/i.test(clientId)
  ) {
    return { ok: false, issue: "placeholder" };
  }
  // Web / installed クライアントは *.apps.googleusercontent.com
  if (!/\.apps\.googleusercontent\.com$/i.test(clientId)) {
    return { ok: false, issue: "invalid_format" };
  }
  return { ok: true, creds: { clientId, clientSecret } };
}

export function gmailCallbackUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/gmail/callback`;
}

export function googleOAuthIssueToErrorCode(issue: GoogleOAuthIssue): string {
  switch (issue) {
    case "missing":
      return "oauth_not_configured";
    case "placeholder":
      return "oauth_placeholder";
    case "invalid_format":
      return "oauth_bad_format";
  }
}
