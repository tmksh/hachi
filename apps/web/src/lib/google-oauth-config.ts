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

export function isGoogleOAuthCallbackPath(pathname: string): boolean {
  return pathname === "/api/google-calendar/callback" || pathname === "/api/gmail/callback";
}

export function isAllowedOAuthRedirectUri(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.search || u.hash) return false;
    const origin = canonicalizeOAuthOrigin(u.origin);
    const path = u.pathname.replace(/\/$/, "") || "/";
    if (path !== "/api/google-calendar/callback" && path !== "/api/gmail/callback") {
      return false;
    }
    return uri.replace(/\/$/, "") === `${origin}${path}`;
  } catch {
    return false;
  }
}

const PRODUCTION_OAUTH_ORIGIN = "https://bridge-linq.com";

function isLocalOrigin(value: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(value);
}

/** Console 登録値に揃える。www / Netlify内部ホスト / ポートなし localhost で mismatch しない */
export function canonicalizeOAuthOrigin(origin: string): string {
  const raw = origin.trim().replace(/\/$/, "");
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") {
      return `http://localhost:${u.port || "3000"}`;
    }
    if (
      host === "bridge-linq.com"
      || host === "www.bridge-linq.com"
      || host.endsWith(".bridge-linq.com")
      || host === "hachigreen.netlify.app"
      || (host.endsWith(".netlify.app") && !host.includes("--"))
    ) {
      return PRODUCTION_OAUTH_ORIGIN;
    }
    return `${u.protocol}//${u.host}`.replace(/\/$/, "");
  } catch {
    return raw;
  }
}

/**
 * OAuth の redirect_uri に使う origin。
 * ブラウザのホストを優先する。NEXT_PUBLIC_APP_URL が古い Netlify URL のままだと、
 * 本番ドメインで開いていても Console に無い URI を送ってしまう。
 */
export function resolveOAuthRedirectOrigin(requestOrigin: string): string {
  const explicit = stripQuotes(process.env.GOOGLE_OAUTH_REDIRECT_ORIGIN ?? "").replace(/\/$/, "");
  if (explicit) return canonicalizeOAuthOrigin(explicit);

  const fromRequest = canonicalizeOAuthOrigin(requestOrigin);
  if (fromRequest) return fromRequest;

  const configured = stripQuotes(process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (configured && !isLocalOrigin(configured)) {
    return canonicalizeOAuthOrigin(configured);
  }
  const domain = stripQuotes(process.env.NEXT_PUBLIC_APP_DOMAIN ?? "");
  if (domain && !isLocalOrigin(domain)) {
    return canonicalizeOAuthOrigin(`https://${domain.replace(/^https?:\/\//, "")}`);
  }

  return PRODUCTION_OAUTH_ORIGIN;
}

/** OAuth 完了後の戻り先。www / Netlify は apex、localhost は :3000 に揃える */
export function canonicalizeReturnOrigin(origin: string): string {
  const raw = origin.trim().replace(/\/$/, "");
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") {
      return `http://localhost:${u.port || "3000"}`;
    }
    if (host === "www.bridge-linq.com" || host === "hachigreen.netlify.app"
      || (host.endsWith(".netlify.app") && !host.includes("--"))) {
      return PRODUCTION_OAUTH_ORIGIN;
    }
    return `${u.protocol}//${u.host}`.replace(/\/$/, "");
  } catch {
    return raw || PRODUCTION_OAUTH_ORIGIN;
  }
}

/** 戻り先パスにクエリを足す（既存の ? を壊さない） */
export function appendQuery(path: string, params: Record<string, string>): string {
  const url = new URL(path, "http://oauth.invalid");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}`;
}

export type GmailOAuthState = {
  uid: string;
  returnOrigin: string;
  returnPath?: string;
  /** auth 開始時の redirect_uri。token 交換でも同じ値を使う */
  redirectUri?: string;
};

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
        returnPath: typeof parsed.returnPath === "string" ? parsed.returnPath : undefined,
        redirectUri: typeof parsed.redirectUri === "string" ? parsed.redirectUri : undefined,
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
