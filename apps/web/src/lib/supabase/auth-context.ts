import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { AUTHZ_COOKIE, decodeAuthz } from "@/lib/authz-cookie";
import {
  CACHE_TTL,
  cachedCompanyRead,
  invalidateCompanyCache,
} from "@/lib/server-cache";

export type AuthContext = {
  user: { id: string; email?: string } | null;
  companyId: string | null;
  role: string | null;
};

export const getAuthContext = cache(async (): Promise<AuthContext> => {
  const user = await getAuthUser();
  if (!user) return { user: null, companyId: null, role: null };

  const jar = await cookies();
  const cached = decodeAuthz(jar.get(AUTHZ_COOKIE)?.value ?? "");
  if (cached?.u === user.id && cached.o) {
    return { user, companyId: cached.o, role: cached.r };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .maybeSingle();

  return {
    user,
    companyId: profile?.company_id ?? null,
    role: (profile?.role as string | null) ?? null,
  };
});

export async function cachedByCompany<T>(
  part: string,
  ttlMs: number,
  fn: () => Promise<T>,
  userScoped = false,
): Promise<T> {
  const ctx = await getAuthContext();
  if (!ctx.companyId) return fn();
  const key = userScoped && ctx.user ? `${part}:u:${ctx.user.id}` : part;
  return cachedCompanyRead(ctx.companyId, key, ttlMs, fn);
}

export async function invalidateMyCompanyCache() {
  const ctx = await getAuthContext();
  if (ctx.companyId) invalidateCompanyCache(ctx.companyId);
}

export { CACHE_TTL };
