import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Server Actions 用: Supabase Auth サーバーで検証済みのユーザーを取得 */
export async function getAuthUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}
