import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Server Actions 用: Cookie からセッションを読む（getUser より高速） */
export async function getAuthUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user ?? null;
}
