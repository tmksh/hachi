import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { authCookieDomain } from "@/lib/tenant-host";

export const createClient = cache(async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const cookieStore = await cookies();

  if (!url || !key) {
    return createServerClient(
      "https://placeholder.supabase.co",
      "placeholder-key",
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      },
    );
  }

  const host = (await headers()).get("host") ?? "";
  const cookieDomain = authCookieDomain(host, process.env.NEXT_PUBLIC_APP_DOMAIN);

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, {
              ...options,
              ...(cookieDomain ? { domain: cookieDomain } : {}),
            }),
          );
        } catch {
          // The `setAll` method was called from a Server Component.
        }
      },
    },
  });
});
