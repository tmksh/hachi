import type { User } from "@supabase/supabase-js";

/** 残り5分を切ったら getUser() でトークンを更新する */
export const AUTH_JWT_REFRESH_MARGIN_SEC = 5 * 60;

type JwtUser = { id: string; email?: string; exp: number };

function supabaseStorageKey(supabaseUrl: string): string | null {
  try {
    const host = new URL(supabaseUrl).hostname.split(".")[0];
    return host ? `sb-${host}-auth-token` : null;
  } catch {
    return null;
  }
}

function decodeJwtPayload(token: string): { sub?: string; email?: string; exp?: number } | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const bin = atob(b64 + pad);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as {
      sub?: string;
      email?: string;
      exp?: number;
    };
  } catch {
    return null;
  }
}

function utf8FromBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function tryParseSessionJson(raw: string): { access_token?: string } | null {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (typeof value.access_token === "string") return { access_token: value.access_token };
    const current = value.currentSession as { access_token?: string } | undefined;
    if (current?.access_token) return current;
    if (Array.isArray(value) && typeof value[0]?.access_token === "string") {
      return { access_token: value[0].access_token };
    }
    return null;
  } catch {
    return null;
  }
}

function parseCookieSession(raw: string): { access_token?: string } | null {
  const direct = tryParseSessionJson(raw);
  if (direct) return direct;

  try {
    const decoded = tryParseSessionJson(decodeURIComponent(raw));
    if (decoded) return decoded;
  } catch {
    /* ignore */
  }

  if (raw.startsWith("base64-")) {
    try {
      return tryParseSessionJson(utf8FromBase64(raw.slice(7)));
    } catch {
      /* ignore */
    }
  }

  try {
    const pad = raw.length % 4 === 0 ? "" : "=".repeat(4 - (raw.length % 4));
    return tryParseSessionJson(utf8FromBase64(raw.replace(/-/g, "+").replace(/_/g, "/") + pad));
  } catch {
    return null;
  }
}

export function readSupabaseJwtUser(
  getCookie: (name: string) => string | undefined,
  supabaseUrl: string,
): JwtUser | null {
  const storageKey = supabaseStorageKey(supabaseUrl);
  if (!storageKey) return null;

  let raw = getCookie(storageKey);
  if (!raw) {
    const chunks: string[] = [];
    for (let i = 0; i < 8; i++) {
      const part = getCookie(`${storageKey}.${i}`);
      if (!part) break;
      chunks.push(part);
    }
    if (chunks.length) raw = chunks.join("");
  }
  if (!raw) return null;

  const token = parseCookieSession(raw)?.access_token;
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload?.sub || !payload.exp) return null;
  if (payload.exp * 1000 <= Date.now()) return null;
  return { id: payload.sub, email: payload.email, exp: payload.exp };
}

export function jwtIsFresh(exp: number): boolean {
  return exp - Date.now() / 1000 > AUTH_JWT_REFRESH_MARGIN_SEC;
}

export function jwtUserAsUser(jwt: JwtUser): User {
  return {
    id: jwt.id,
    email: jwt.email ?? "",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "",
  } as User;
}
