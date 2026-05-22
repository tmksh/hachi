import { createHash, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type ApiAuthContext = {
  companyId: string;
  scopes: string[];
  keyId: string;
};

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function generateApiKey(): { rawKey: string; prefix: string; hash: string } {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const body = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const rawKey = `brg_${body}`;
  const prefix = rawKey.slice(0, 12);
  return { rawKey, prefix, hash: hashApiKey(rawKey) };
}

export async function authenticateApiRequest(
  authHeader: string | null
): Promise<ApiAuthContext | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const rawKey = authHeader.slice(7).trim();
  if (!rawKey.startsWith("brg_")) return null;

  const prefix = rawKey.slice(0, 12);
  const hash = hashApiKey(rawKey);
  const supabase = createAdminClient();

  const { data: keyRow } = await supabase
    .from("api_keys")
    .select("id, company_id, scopes, key_hash, is_active")
    .eq("key_prefix", prefix)
    .eq("is_active", true)
    .maybeSingle();

  if (!keyRow) return null;

  const stored = Buffer.from(keyRow.key_hash);
  const incoming = Buffer.from(hash);
  if (stored.length !== incoming.length || !timingSafeEqual(stored, incoming)) return null;

  await supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id);

  return {
    companyId: keyRow.company_id,
    scopes: keyRow.scopes ?? ["read"],
    keyId: keyRow.id,
  };
}

export function hasScope(ctx: ApiAuthContext, scope: string): boolean {
  return ctx.scopes.includes(scope) || ctx.scopes.includes("admin");
}
