const RESERVED_SUBDOMAINS = new Set([
  "www", "app", "admin", "api", "mail", "ftp", "smtp", "pop",
  "cdn", "static", "assets", "status", "help", "support", "docs",
]);

export const SUPER_ADMIN_EMAIL = "super-admin@example.com";
export const PRODUCTION_APP_DOMAIN = "bridge-linq.com";

export function hostnameWithoutPort(hostname: string): string {
  return hostname.split(":")[0] ?? "";
}

function stripDomainInput(value: string | undefined | null): string {
  return (value ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .replace(/^www\./, "");
}

/**
 * テナント判定用ドメイン。
 * 環境変数が空でも、本番ホスト（*.bridge-linq.com）なら bridge-linq.com を使う。
 */
export function resolveAppDomain(hostname: string, envDomain?: string | null): string | null {
  const fromEnv = stripDomainInput(envDomain);
  if (fromEnv) return fromEnv;
  const host = hostnameWithoutPort(hostname);
  if (
    host === PRODUCTION_APP_DOMAIN
    || host === `www.${PRODUCTION_APP_DOMAIN}`
    || host.endsWith(`.${PRODUCTION_APP_DOMAIN}`)
  ) {
    return PRODUCTION_APP_DOMAIN;
  }
  return null;
}

export function parseTenantSlug(hostname: string, appDomain: string | undefined | null): string | null {
  if (!appDomain) return null;
  const host = hostnameWithoutPort(hostname);
  if (!host || host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
  if (host.endsWith(".localhost")) {
    const slug = host.slice(0, -".localhost".length);
    if (!slug.includes(".") && !RESERVED_SUBDOMAINS.has(slug)) return slug;
    return null;
  }
  if (host === appDomain || host === `www.${appDomain}`) return null;
  if (!host.endsWith(`.${appDomain}`)) return null;
  const slug = host.slice(0, -(appDomain.length + 1));
  if (!slug || slug.includes(".") || RESERVED_SUBDOMAINS.has(slug)) return null;
  return slug;
}

/** apex / www。加盟店アプリはここではなく {slug}.{APP_DOMAIN} で使う */
export function isApexHost(hostname: string, appDomain: string | undefined | null): boolean {
  if (!appDomain) return false;
  const host = hostnameWithoutPort(hostname);
  return host === appDomain || host === `www.${appDomain}`;
}

export function isSuperAdminEmail(email: string | undefined | null): boolean {
  return email === SUPER_ADMIN_EMAIL;
}

/** apex でも運営・API・公開ページはテナントへ送らない */
export function isApexExemptPath(pathname: string): boolean {
  return (
    pathname.startsWith("/admin")
    || pathname.startsWith("/api/")
    || pathname.startsWith("/partner")
    || pathname.startsWith("/unauthorized")
    || pathname.startsWith("/reset-password")
    || pathname.startsWith("/update-password")
    || pathname.startsWith("/onboarding")
  );
}

/** 本番ホスト上のセッションを全サブドメインで共有する */
export function authCookieDomain(hostname: string, appDomain: string | undefined | null): string | undefined {
  const domain = resolveAppDomain(hostname, appDomain);
  if (!domain) return undefined;
  const host = hostnameWithoutPort(hostname);
  if (host === domain || host === `www.${domain}` || host.endsWith(`.${domain}`)) {
    return `.${domain}`;
  }
  return undefined;
}

export function companyAppUrl(slug: string, appDomain: string, pathname = "/dashboard"): string {
  const path = !pathname || pathname === "/" || pathname === "/login" ? "/dashboard" : pathname;
  return `https://${slug}.${appDomain}${path.startsWith("/") ? path : `/${path}`}`;
}

export type LoginHostDecision =
  | { ok: true }
  | { ok: false; reason: "wrong_tenant" | "use_own_url"; ownUrl?: string };

/** ログイン時: 他社slug・apex では加盟店を入れない */
export function decideLoginHost(
  hostname: string,
  companySlug: string | null | undefined,
  envDomain: string | undefined | null,
  isSuperAdmin: boolean,
): LoginHostDecision {
  const appDomain = resolveAppDomain(hostname, envDomain);
  if (isSuperAdmin) {
    if (parseTenantSlug(hostname, appDomain)) {
      return { ok: false, reason: "wrong_tenant" };
    }
    return { ok: true };
  }
  const hostSlug = parseTenantSlug(hostname, appDomain);
  if (hostSlug) {
    if (!companySlug || hostSlug !== companySlug) {
      return { ok: false, reason: "wrong_tenant" };
    }
    return { ok: true };
  }
  if (appDomain && isApexHost(hostname, appDomain)) {
    return {
      ok: false,
      reason: "use_own_url",
      ownUrl: companySlug ? `https://${companySlug}.${appDomain}` : undefined,
    };
  }
  return { ok: true };
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

export const STANDALONE_WORKFLOW_KEYS = new Set(["expense", "leave", "purchase", "custom"]);
