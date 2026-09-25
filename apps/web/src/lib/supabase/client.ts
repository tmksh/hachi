import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authCookieDomain } from "@/lib/tenant-host";
import { createBrowserAuthGuard } from "@/lib/supabase/refresh-guard";

let browserClient: SupabaseClient | null = null;

function cookieOptions() {
  if (typeof window === "undefined") return undefined;
  const domain = authCookieDomain(window.location.hostname, process.env.NEXT_PUBLIC_APP_DOMAIN);
  if (!domain) return undefined;
  return { domain, path: "/", sameSite: "lax" as const };
}

function readDocumentCookies(): { name: string; value: string }[] {
  if (!document.cookie) return [];
  return document.cookie.split(";").flatMap((part) => {
    const idx = part.indexOf("=");
    if (idx < 0) return [];
    const name = part.slice(0, idx).trim();
    if (!name) return [];
    return [{ name, value: decodeURIComponent(part.slice(idx + 1).trim()) }];
  });
}

function writeDocumentCookie(
  name: string,
  value: string,
  options?: { domain?: string; path?: string; maxAge?: number; sameSite?: string | boolean; secure?: boolean },
) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options?.path) parts.push(`Path=${options.path}`);
  if (options?.domain) parts.push(`Domain=${options.domain}`);
  if (typeof options?.maxAge === "number") parts.push(`Max-Age=${options.maxAge}`);
  if (options?.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options?.secure) parts.push("Secure");
  document.cookie = parts.join("; ");
}

function clearAuthCookie(name: string) {
  const domain = authCookieDomain(window.location.hostname, process.env.NEXT_PUBLIC_APP_DOMAIN);
  const expire = `${name}=; Max-Age=0; Path=/`;
  document.cookie = expire;
  if (domain) document.cookie = `${expire}; Domain=${domain}`;
}

function browserAuthOptions() {
  const guard = createBrowserAuthGuard({
    fetchImpl: window.fetch.bind(window),
    readCookies: readDocumentCookies,
    writeCookie: writeDocumentCookie,
    clearAuthCookie,
  });
  const options = cookieOptions();
  return {
    cookies: {
      getAll: () => guard.getAll(),
      setAll: (cookies: { name: string; value: string; options?: Parameters<typeof writeDocumentCookie>[2] }[]) => {
        guard.setAll(cookies);
      },
    },
    cookieOptions: options,
    global: { fetch: guard.fetch },
  };
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Return a mock client for build time / when Supabase is not configured
    return createBrowserClient(
      "https://placeholder.supabase.co",
      "placeholder-key",
    );
  }

  // SSR 中にシングルトンにするとリクエスト間でセッションが混ざる
  if (typeof window === "undefined") {
    return createBrowserClient(url, key);
  }

  if (!browserClient) {
    browserClient = createBrowserClient(url, key, browserAuthOptions());
  }
  return browserClient;
}
