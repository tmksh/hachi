import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

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
    browserClient = createBrowserClient(url, key);
  }
  return browserClient;
}
