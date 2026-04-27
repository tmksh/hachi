import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service Role キーを使う管理者専用 Supabase クライアント。
 * RLS をバイパスして全社（全テナント）データにアクセスする。
 *
 * **重要:** サーバーサイドでのみ使うこと。クライアントへ漏らさない。
 * 呼び出す前に必ず `assertSuperAdmin()` などでアクセス権を確認すること。
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY が未設定です。BRIDGE 運営側 BI を有効にするには、" +
        ".env.local に SUPABASE_SERVICE_ROLE_KEY を設定してください。" +
        "(Supabase Dashboard → Project Settings → API → service_role key)",
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
