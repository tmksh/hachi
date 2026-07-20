import { NAV_ITEM_ROLES, ROUTE_ROLES, SYSTEM_PERMISSION_ROLES, type Role } from "@/lib/constants";

/** 機能キー → 許可ロール slug 配列 */
export type RolePermissions = Record<string, string[]>;

/**
 * ルート prefix → 権限マトリクスの機能キー。
 * 長い prefix を先にマッチさせる。
 */
export const ROUTE_FEATURE_KEYS: Array<{ prefix: string; featureKey: string }> = [
  { prefix: "/bi2", featureKey: "bi2" },
  { prefix: "/bi", featureKey: "bi" },
  { prefix: "/crm", featureKey: "crm" },
  { prefix: "/deals", featureKey: "deals" },
  { prefix: "/quotes", featureKey: "quotes" },
  { prefix: "/craftsmen", featureKey: "craftsmen" },
  { prefix: "/contracts", featureKey: "contracts" },
  { prefix: "/constructions", featureKey: "constructions" },
  { prefix: "/invoices", featureKey: "invoices" },
  { prefix: "/budget", featureKey: "budget" },
  { prefix: "/calendar", featureKey: "calendar" },
  { prefix: "/mail", featureKey: "mail" },
  { prefix: "/attendance", featureKey: "attendance" },
  { prefix: "/workflow", featureKey: "workflow" },
  { prefix: "/circulation", featureKey: "circulation" },
  { prefix: "/documents", featureKey: "documents" },
  { prefix: "/marketing", featureKey: "marketing-email" },
];

/** NAV_ITEM_ROLES からマトリクス初期値を生成（未設定会社のフォールバック） */
export function buildDefaultRolePermissions(): RolePermissions {
  const all: Role[] = [...SYSTEM_PERMISSION_ROLES];
  const result: RolePermissions = {};
  const allKeys = [
    "dashboard", "bi", "bi2", "crm", "deals", "quotes", "craftsmen",
    "contracts", "constructions", "invoices", "budget",
    "calendar", "mail", "attendance", "workflow", "circulation", "documents",
  ];
  allKeys.forEach((key) => {
    // bi2 は bi と同じデフォルト
    const sourceKey = key === "bi2" ? "bi" : key;
    const restricted = NAV_ITEM_ROLES[sourceKey] as Role[] | undefined;
    result[key] = restricted ? [...restricted] : [...all];
  });
  result["marketing-email"] = ["hq_admin"];
  result["marketing-sns"] = ["hq_admin"];
  result["marketing-roi"] = ["hq_admin"];
  result["marketing-creative"] = ["hq_admin"];
  result.settings_member = ["hq_admin"];
  result.settings_company = ["hq_admin"];
  result.settings_attendance = ["hq_admin"];
  result.settings_workflow = ["hq_admin"];
  result.settings_crm = ["hq_admin"];
  result.reserve_fee = ["hq_admin"];
  return result;
}

export const DEFAULT_ROLE_PERMISSIONS = buildDefaultRolePermissions();

export function mergeRolePermissions(
  saved?: RolePermissions | null,
): RolePermissions {
  if (!saved) return { ...DEFAULT_ROLE_PERMISSIONS };
  return { ...DEFAULT_ROLE_PERMISSIONS, ...saved };
}

/** 機能キーに対するアクセス可否（マトリクス正本） */
export function canAccessFeature(
  featureKey: string,
  roleSlugs: string[],
  permissions?: RolePermissions | null,
): boolean {
  const merged = mergeRolePermissions(permissions ?? null);
  const allowed = merged[featureKey];
  if (!allowed) return true;
  return roleSlugs.some((r) => allowed.includes(r));
}

export function featureKeyForPath(pathname: string): string | null {
  const matched = ROUTE_FEATURE_KEYS.find((r) => pathname.startsWith(r.prefix));
  return matched?.featureKey ?? null;
}

function matchRoutePrefix(pathname: string): string | undefined {
  // 長い prefix を優先（/bi2 が /bi に食われないようにする）
  return Object.keys(ROUTE_ROLES)
    .sort((a, b) => b.length - a.length)
    .find((p) => pathname.startsWith(p));
}

/**
 * パスへのアクセス可否。
 * 会社の role_permissions があればそれを使い、なければ従来の ROUTE_ROLES にフォールバック。
 */
export function canAccessPathWithPermissions(
  pathname: string,
  role: string,
  permissions?: RolePermissions | null,
): boolean {
  const featureKey = featureKeyForPath(pathname);

  // マトリクスに対応する機能キーがある場合はマトリクスを正本にする
  if (featureKey) {
    // 未保存時のみ従来の ROUTE_ROLES にフォールバック
    if (!permissions) {
      const matchedRoute = matchRoutePrefix(pathname);
      if (matchedRoute) {
        const allowed = ROUTE_ROLES[matchedRoute];
        if (allowed.length === 0) return false;
        return allowed.includes(role as Role);
      }
    }
    return canAccessFeature(featureKey, [role], permissions);
  }

  // 機能キー未定義のルートは従来ロジック
  const matchedRoute = matchRoutePrefix(pathname);
  if (!matchedRoute) return true;
  const allowed = ROUTE_ROLES[matchedRoute];
  if (allowed.length === 0) return false;
  return allowed.includes(role as Role);
}
