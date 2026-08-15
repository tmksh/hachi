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

export function calendarCallbackUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/google-calendar/callback`;
}

export function gmailCallbackUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/gmail/callback`;
}

const PRODUCTION_OAUTH_ORIGIN = "https://bridge-linq.com";

function isLocalOrigin(value: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(value);
}

/**
 * OAuth の redirect_uri に使う origin。
 * サブドメイン / www ごとに URI が変わると Google Console と不一致になるため、
 * 本番ドメイン配下は apex（https://bridge-linq.com）に固定する。
 */
export function resolveOAuthRedirectOrigin(requestOrigin: string): string {
  const explicit = stripQuotes(process.env.GOOGLE_OAUTH_REDIRECT_ORIGIN ?? "").replace(/\/$/, "");
  if (explicit) return explicit.replace(/\/$/, "");

  const configured = stripQuotes(process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (configured && !isLocalOrigin(configured)) {
    return configured;
  }
  const domain = stripQuotes(process.env.NEXT_PUBLIC_APP_DOMAIN ?? "");
  if (domain && !isLocalOrigin(domain)) {
    return `https://${domain.replace(/^https?:\/\//, "").replace(/^www\./, "")}`;
  }

  try {
    const host = new URL(requestOrigin).hostname.toLowerCase();
    if (host === "bridge-linq.com" || host === "www.bridge-linq.com" || host.endsWith(".bridge-linq.com")) {
      return PRODUCTION_OAUTH_ORIGIN;
    }
  } catch {
    /* ignore */
  }
  return requestOrigin.replace(/\/$/, "");
}

export type GmailOAuthState = { uid: string; returnOrigin: string };

export function encodeGmailOAuthState(state: GmailOAuthState): string {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

export function decodeGmailOAuthState(raw: string): GmailOAuthState | null {
  try {
    // 旧形式: 生の user_id
    if (/^[0-9a-f-]{36}$/i.test(raw)) {
      return { uid: raw, returnOrigin: "" };
    }
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as GmailOAuthState;
    if (parsed?.uid && typeof parsed.uid === "string") {
      return {
        uid: parsed.uid,
        returnOrigin: typeof parsed.returnOrigin === "string" ? parsed.returnOrigin : "",
      };
    }
  } catch {
    // ignore
  }
  return null;
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
