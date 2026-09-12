import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authCookieDomain } from "@/lib/tenant-host";

let browserClient: SupabaseClient | null = null;

function cookieOptions() {
  if (typeof window === "undefined") return undefined;
  const domain = authCookieDomain(window.location.hostname, process.env.NEXT_PUBLIC_APP_DOMAIN);
  if (!domain) return undefined;
  return { domain, path: "/", sameSite: "lax" as const };
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
    const options = cookieOptions();
    browserClient = options
      ? createBrowserClient(url, key, { cookieOptions: options })
      : createBrowserClient(url, key);
  }
  return browserClient;
}
