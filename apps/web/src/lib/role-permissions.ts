import { NAV_ITEM_ROLES, ROUTE_ROLES, SYSTEM_PERMISSION_ROLES, type Role } from "@/lib/constants";

/** 機能キー → 許可ロール slug 配列 */
export type RolePermissions = Record<string, string[]>;

/**
 * 保存マトリクスのスキーマ版。
 * 上げると、旧保存データに対してデフォルト権限の欠落ロールを一度だけ補完する。
 * （明示的に外した設定は、保存時に _v が最新になっていれば尊重される）
 */
export const ROLE_PERMISSIONS_SCHEMA_VERSION = 2;

const SCHEMA_KEY = "_v";

/** 旧データ補完の対象キー（営業・経営層のリード系アクセス） */
const HEAL_FEATURE_KEYS = [
  "crm",
  "deals",
  "quotes",
  "craftsmen",
  "contracts",
  "bi",
  "bi2",
  "budget",
] as const;

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

function readSchemaVersion(saved: RolePermissions): number {
  const raw = (saved as Record<string, unknown>)[SCHEMA_KEY];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

/** 保存用にスキーマ版を付与（UI のロール配列とは分離） */
export function withPermissionsSchema(perms: RolePermissions): RolePermissions {
  const cleaned: RolePermissions = {};
  for (const [key, roles] of Object.entries(perms)) {
    if (key === SCHEMA_KEY) continue;
    if (Array.isArray(roles)) cleaned[key] = [...roles];
  }
  (cleaned as Record<string, unknown>)[SCHEMA_KEY] = ROLE_PERMISSIONS_SCHEMA_VERSION;
  return cleaned;
}

/**
 * 保存済みマトリクスとデフォルトをマージ。
 * 旧スキーマの保存データはリード系キーについてデフォルト権限をユニオン補完する。
 */
export function mergeRolePermissions(
  saved?: RolePermissions | null,
): RolePermissions {
  if (!saved) return { ...DEFAULT_ROLE_PERMISSIONS };

  const version = readSchemaVersion(saved);
  const result: RolePermissions = { ...DEFAULT_ROLE_PERMISSIONS };
  for (const [key, roles] of Object.entries(saved)) {
    if (key === SCHEMA_KEY) continue;
    if (Array.isArray(roles)) result[key] = roles;
  }

  // キー自体が欠落している場合の安全弁
  const salesFlowKeys = ["crm", "deals", "quotes", "contracts", "workflow"] as const;
  for (const key of salesFlowKeys) {
    if (!(key in saved) && DEFAULT_ROLE_PERMISSIONS[key]?.includes("sales")) {
      result[key] = [...DEFAULT_ROLE_PERMISSIONS[key]];
    }
  }

  // 旧保存（_v 未設定 or 古い）は営業・経営層などのデフォルト追加分を補完
  if (version < ROLE_PERMISSIONS_SCHEMA_VERSION) {
    for (const key of HEAL_FEATURE_KEYS) {
      const def = DEFAULT_ROLE_PERMISSIONS[key];
      if (!def) continue;
      const cur = result[key] ?? [];
      result[key] = Array.from(new Set([...cur, ...def]));
    }
  }

  // マージ結果を再マージしたとき HEAL が再発しないようスキーマ版を引き継ぐ
  if (version >= ROLE_PERMISSIONS_SCHEMA_VERSION) {
    (result as Record<string, unknown>)[SCHEMA_KEY] = ROLE_PERMISSIONS_SCHEMA_VERSION;
  }

  return result;
}

/** 機能キーに対するアクセス可否（マトリクス正本） */
export function canAccessFeature(
  featureKey: string,
  roleSlugs: string[],
  permissions?: RolePermissions | null,
): boolean {
  // permissions が渡されている場合は merge 済みとみなす（再 merge すると _v 欠落で HEAL が走る）
  const perms =
    permissions == null ? mergeRolePermissions(null) : permissions;
  const allowed = perms[featureKey];
  if (!Array.isArray(allowed)) return true;
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

  // 完全に未保存（null/undefined）のときのみ ROUTE_ROLES にフォールバック
  const hasSavedMatrix =
    !!permissions
    && Object.keys(permissions).some((k) => k !== SCHEMA_KEY && Array.isArray(permissions[k]));

  if (featureKey) {
    if (!hasSavedMatrix) {
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
