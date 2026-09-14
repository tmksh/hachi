import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { AsyncReadCache } from "@/lib/async-read-cache";
import type { Profile } from "@/lib/database.types";

const reads = new AsyncReadCache();
// Only coalesce concurrent requests. Never persist an authentication decision in a TTL cache.
function readOnce<T>(key: string, fn: () => Promise<T>): Promise<T> {
  return typeof window === "undefined" ? fn() : reads.read(key, 0, fn);
}

export function invalidateBrowserAuthReads() { reads.invalidatePrefix(""); }

export function fetchBrowserUser(): Promise<User | null> {
  return readOnce("user", async () => {
    const { data: { user }, error } = await createClient().auth.getUser();
    if (error && error.name !== "AuthSessionMissingError") throw error;
    return user ?? null;
  });
}

export function fetchBrowserProfile(userId: string): Promise<Profile | null> {
  return readOnce(`profile:${userId}`, async () => {
    const { data, error } = await createClient().from("profiles")
      .select("id, company_id, display_name, email, role, avatar_url, department, position, phone")
      .eq("id", userId).maybeSingle();
    if (error) throw error;
    return data as Profile | null;
  });
}

export async function browserAuthContext() {
  const supabase = createClient();
  const user = await fetchBrowserUser();
  const profile = user ? await fetchBrowserProfile(user.id) : null;
  return { supabase, user, profile };
}
