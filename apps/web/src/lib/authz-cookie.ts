import {
  mergeRolePermissions,
  type RolePermissions,
} from "@/lib/role-permissions";

/** 旧実装の肥大 cookie（誤拒否の原因） */
export const LEGACY_ROLE_PERM_COOKIE = "bl_rp";
/** role + 権限マトリクスの短命キャッシュ（毎リクエストの DB 2回を避ける） */
export const AUTHZ_COOKIE = "bl_az";
/** 10分。権限変更時は updateCompany が cookie を消す */
export const AUTHZ_MAX_AGE_SEC = 10 * 60;

export type AuthzCache = {
  u: string;
  r: string;
  c?: string | null;
  /** company_id */
  o?: string | null;
  p: RolePermissions | null;
};

export function encodeAuthz(data: AuthzCache): string {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeAuthz(raw: string): AuthzCache | null {
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const bin = atob(b64 + pad);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const data = JSON.parse(new TextDecoder().decode(bytes)) as AuthzCache;
    if (!data?.u || typeof data.r !== "string") return null;
    return data;
  } catch {
    return null;
  }
}

export function readAuthzFromCookieValue(raw: string | undefined, userId: string): AuthzCache | null {
  if (!raw) return null;
  const cached = decodeAuthz(raw);
  if (!cached || cached.u !== userId) return null;
  if (cached.p) cached.p = mergeRolePermissions(cached.p);
  return cached;
}
