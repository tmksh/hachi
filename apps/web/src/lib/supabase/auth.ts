import { cache } from "react";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { jwtIsFresh, jwtUserAsUser, readSupabaseJwtUser } from "@/lib/supabase/session-jwt";

/** Server Actions / RSC 用: 同一リクエスト内の getUser を1回にまとめる */
export const getAuthUser = cache(async (): Promise<User | null> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    const jar = await cookies();
    const jwt = readSupabaseJwtUser((name) => jar.get(name)?.value, supabaseUrl);
    if (jwt && jwtIsFresh(jwt.exp)) {
      return jwtUserAsUser(jwt);
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
});
