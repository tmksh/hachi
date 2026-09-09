import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  canAccessPathWithPermissions,
  featureKeyForPath,
  mergeRolePermissions,
  type RolePermissions,
} from "@/lib/role-permissions";
import { readMemberCustomRoles } from "@/lib/role-assignment";
import { decodeGmailOAuthState, isGoogleOAuthCallbackPath } from "@/lib/google-oauth-config";
import {
  AUTHZ_COOKIE,
  AUTHZ_MAX_AGE_SEC,
  LEGACY_ROLE_PERM_COOKIE,
  decodeAuthz,
  encodeAuthz,
  type AuthzCache,
} from "@/lib/authz-cookie";
import { hasSupabaseAuthCookie, jwtIsFresh, jwtUserAsUser, readSupabaseJwtUser } from "@/lib/supabase/session-jwt";

/** 権限チェック対象のルート（マトリクス未設定時のフォールバック用ハードコード） */
const LEGACY_ROUTE_PREFIXES = [
  "/bi", "/bi2", "/crm", "/deals", "/quotes", "/craftsmen",
  "/contracts", "/constructions", "/fulfillment", "/ledger", "/account-items", "/invoices", "/budget", "/marketing",
];

// ── サブドメイン予約語（これらは会社 slug として使えない） ───────────────────────
const RESERVED_SUBDOMAINS = new Set([
  "www", "app", "admin", "api", "mail", "ftp", "smtp", "pop",
  "cdn", "static", "assets", "status", "help", "support", "docs",
]);

/**
 * リクエストホストからサブドメイン（会社 slug）を抽出する。
 *
 * - NEXT_PUBLIC_APP_DOMAIN が未設定 → null を返す（サブドメイン機能オフ）
 * - localhost / IP アドレス → null（開発環境はスキップ）
 * - www.bridge.jp, bridge.jp → null（apex / www はテナントなし）
 * - acme.bridge.jp → "acme"
 */
/** Netlify デフォルト URL (*.netlify.app) → 本番ドメインへ統一 */
function redirectToCanonicalDomain(request: NextRequest): NextResponse | null {
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN;
  if (!appDomain) return null;

  const hostname = (request.headers.get("host") ?? "").split(":")[0];
  if (!hostname.endsWith(".netlify.app")) return null;

  // ブランチデプロイ / Deploy Preview（例: staging--site.netlify.app）は
  // ステージング環境として使うためリダイレクトしない
  if (hostname.includes("--")) return null;

  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.host = appDomain;
  return NextResponse.redirect(url);
}

function extractSubdomain(request: NextRequest): string | null {
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN; // 例: "bridge-linq.com"
  if (!appDomain) return null;

  const host = request.headers.get("host") ?? "";
  // ポート番号を除去
  const hostname = host.split(":")[0];

  // 素の localhost や IP はスキップ
  if (hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return null;

  // 開発環境: {slug}.localhost → slug を返す
  if (hostname.endsWith(".localhost")) {
    const slug = hostname.slice(0, -".localhost".length);
    if (!slug.includes(".") && !RESERVED_SUBDOMAINS.has(slug)) return slug;
    return null;
  }

  // apex ドメインまたは www はスキップ
  if (hostname === appDomain || hostname === `www.${appDomain}`) return null;

  // {slug}.{appDomain} の形式かチェック
  const suffix = `.${appDomain}`;
  if (!hostname.endsWith(suffix)) return null;

  const slug = hostname.slice(0, -suffix.length);
  // ネストしたサブドメイン（a.b.bridge-linq.com）や予約語はスキップ
  if (slug.includes(".") || RESERVED_SUBDOMAINS.has(slug)) return null;

  return slug;
}

function rescueGoogleOAuthFromLogin(request: NextRequest): NextResponse | null {
  if (request.nextUrl.pathname !== "/login") return null;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code || !state) return null;
  const decoded = decodeGmailOAuthState(state);
  if (!decoded?.uid || (!decoded.redirectUri && !decoded.returnPath && !decoded.returnOrigin)) {
    return null;
  }
  const dest = request.nextUrl.clone();
  dest.pathname = decoded.redirectUri?.includes("/api/gmail/callback")
    ? "/api/gmail/callback"
    : "/api/google-calendar/callback";
  return NextResponse.redirect(dest);
}

type GateUser = { id: string; email?: string };

function isSessionlessPath(pathname: string): boolean {
  if (
    pathname === "/api/health"
    || pathname === "/partner"
    || pathname.startsWith("/api/auth/callback")
    || pathname.startsWith("/api/auth/accept-invite")
    || isGoogleOAuthCallbackPath(pathname)
  ) {
    return true;
  }
  return (
    pathname.startsWith("/api/webhooks/")
    || pathname.startsWith("/api/v1/")
    || pathname.startsWith("/partner/")
  );
}

function publicPathPrefixes(): string[] {
  return [
    "/login",
    "/admin/login",
    "/api/auth/callback",
    "/api/auth/accept-invite",
    "/api/gmail/callback",
    "/api/google-calendar/callback",
    "/api/webhooks/",
    "/unauthorized",
    "/reset-password",
    "/update-password",
    "/onboarding",
    "/partner",
    ...(process.env.NODE_ENV === "development" ? ["/api/dev/"] : []),
  ];
}

function isPublicPath(pathname: string): boolean {
  return publicPathPrefixes().some((path) => pathname.startsWith(path));
}

function pass(request: NextRequest): NextResponse {
  return NextResponse.next({ request });
}

function redirectTo(request: NextRequest, pathname: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return NextResponse.redirect(url);
}

/** ログイン有無によるリダイレクト。続行なら null */
function applyAuthGate(request: NextRequest, user: GateUser | null): NextResponse | null {
  const { pathname } = request.nextUrl;
  const publicPath = isPublicPath(pathname);
  const isExternalApi = pathname.startsWith("/api/v1/");

  if (
    pathname.startsWith("/admin")
    && pathname !== "/admin/login"
    && (!user || user.email !== "super-admin@example.com")
  ) {
    return redirectTo(request, "/admin/login");
  }

  if (!user && !publicPath && !isExternalApi) {
    return redirectTo(request, "/login");
  }

  if (user && pathname === "/login") {
    return redirectTo(request, "/dashboard");
  }

  if (user && pathname === "/admin/login" && user.email === "super-admin@example.com") {
    return redirectTo(request, "/admin");
  }

  if (user && pathname === "/") {
    return redirectTo(request, "/dashboard");
  }

  return null;
}

function applyRoleCheck(
  request: NextRequest,
  role: string | undefined,
  permissions: RolePermissions | null,
  customRoleId: string | undefined,
): NextResponse | null {
  const { pathname } = request.nextUrl;
  const needsRoleCheck =
    !!featureKeyForPath(pathname)
    || LEGACY_ROUTE_PREFIXES.some((p) => pathname.startsWith(p));
  if (!needsRoleCheck) return null;
  if (!role || !canAccessPathWithPermissions(pathname, role, permissions, customRoleId)) {
    return redirectTo(request, "/unauthorized");
  }
  return null;
}

function withLegacyCookieCleared(response: NextResponse, request: NextRequest): NextResponse {
  if (request.cookies.has(LEGACY_ROLE_PERM_COOKIE)) {
    response.cookies.set(LEGACY_ROLE_PERM_COOKIE, "", { path: "/", maxAge: 0 });
  }
  return response;
}

function withTenantHeaders(response: NextResponse, slug: string, companyId: string): NextResponse {
  response.headers.set("x-tenant-slug", slug);
  response.headers.set("x-tenant-id", companyId);
  return response;
}

function setAuthzCookie(response: NextResponse, data: AuthzCache) {
  try {
    const encoded = encodeAuthz(data);
    if (encoded.length < 3500) {
      response.cookies.set(AUTHZ_COOKIE, encoded, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: AUTHZ_MAX_AGE_SEC,
      });
    }
  } catch {
    // ignore encode errors
  }
}

export async function updateSession(request: NextRequest) {
  const canonicalRedirect = redirectToCanonicalDomain(request);
  if (canonicalRedirect) return canonicalRedirect;

  const oauthRescue = rescueGoogleOAuthFromLogin(request);
  if (oauthRescue) return oauthRescue;

  const { pathname } = request.nextUrl;
  if (isSessionlessPath(pathname)) {
    return pass(request);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return pass(request);
  }

  const getCookie = (name: string) => request.cookies.get(name)?.value;
  const jwt = readSupabaseJwtUser(getCookie, supabaseUrl);
  const freshUser = jwt && jwtIsFresh(jwt.exp) ? jwtUserAsUser(jwt) : null;
  const hasAuthCookie = hasSupabaseAuthCookie(getCookie, supabaseUrl);
  const slug = extractSubdomain(request);
  const cached = decodeAuthz(request.cookies.get(AUTHZ_COOKIE)?.value ?? "");
  const authzOk = Boolean(freshUser && cached && cached.u === freshUser.id && cached.o);

  // JWT が新しく権限 cookie もある → Supabase クライアントも DB も不要
  if (freshUser && cached && authzOk) {
    if (slug) {
      const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN!;
      if (cached.s && cached.s !== slug) {
        const url = request.nextUrl.clone();
        url.host = `${cached.s}.${appDomain}`;
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
      if (cached.s === slug && cached.o) {
        if (pathname === "/login") return redirectTo(request, "/dashboard");
        return withTenantHeaders(pass(request), slug, cached.o);
      }
    } else {
      const gated = applyAuthGate(request, freshUser);
      if (gated) return gated;
      const denied = applyRoleCheck(request, cached.r, cached.p ?? null, cached.c ?? undefined);
      if (denied) return denied;
      return withLegacyCookieCleared(pass(request), request);
    }
  }

  // セッション cookie 自体がない → getUser のネットワークを省略
  if (!freshUser && !hasAuthCookie && !slug) {
    const gated = applyAuthGate(request, null);
    if (gated) return gated;
    return pass(request);
  }

  let supabaseResponse = pass(request);

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data: { user } } = freshUser
    ? { data: { user: freshUser } }
    : await supabase.auth.getUser();

  // ── サブドメイン解決（NEXT_PUBLIC_APP_DOMAIN 設定後に有効） ─────────────────
  if (slug) {
    const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN!;

    const { data: companyId } = await supabase.rpc("resolve_company_id_by_slug", {
      p_slug: slug,
    });

    if (!companyId) {
      const url = request.nextUrl.clone();
      url.host = appDomain;
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    if (
      !user
      && !pathname.startsWith("/login")
      && !pathname.startsWith("/api/auth")
      && !pathname.startsWith("/onboarding")
      && !isGoogleOAuthCallbackPath(pathname)
    ) {
      return redirectTo(request, "/login");
    }

    if (user && pathname === "/login") {
      return redirectTo(request, "/dashboard");
    }

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, company_id")
        .eq("id", user.id)
        .single();

      if (profile && profile.company_id !== companyId) {
        const { data: myCompany } = await supabase
          .from("companies")
          .select("slug")
          .eq("id", profile.company_id)
          .single();

        const url = request.nextUrl.clone();
        if (myCompany?.slug) {
          url.host = `${myCompany.slug}.${appDomain}`;
        } else {
          url.host = appDomain;
        }
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }

      if (profile && profile.company_id === companyId) {
        if (cached && cached.u === user.id && cached.o) {
          setAuthzCookie(supabaseResponse, { ...cached, s: slug });
        } else {
          const { data: company } = await supabase
            .from("companies")
            .select("settings, slug")
            .eq("id", profile.company_id)
            .maybeSingle();
          const settings = (company?.settings ?? null) as Record<string, unknown> | null;
          const customRoleId = readMemberCustomRoles(settings)[user.id];
          const permissions =
            settings?.role_permissions && typeof settings.role_permissions === "object"
              ? mergeRolePermissions(settings.role_permissions as RolePermissions)
              : null;
          const role = profile.role as string | undefined;
          if (role) {
            setAuthzCookie(supabaseResponse, {
              u: user.id,
              r: role,
              c: customRoleId ?? null,
              o: profile.company_id,
              s: slug,
              p: permissions,
            });
          }
        }
      }
    }

    return withTenantHeaders(supabaseResponse, slug, companyId);
  }

  const gated = applyAuthGate(request, user);
  if (gated) return gated;

  if (user) {
    let role: string | undefined;
    let customRoleId: string | undefined;
    let permissions: RolePermissions | null = null;
    let companySlug: string | null = null;

    if (authzOk && cached && cached.u === user.id) {
      role = cached.r;
      customRoleId = cached.c ?? undefined;
      permissions = cached.p ?? null;
      companySlug = cached.s ?? null;
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, company_id")
        .eq("id", user.id)
        .single();

      role = profile?.role as string | undefined;

      if (profile?.company_id) {
        const { data: company } = await supabase
          .from("companies")
          .select("settings, slug")
          .eq("id", profile.company_id)
          .maybeSingle();
        const settings = (company?.settings ?? null) as Record<string, unknown> | null;
        companySlug = (company?.slug as string | null) ?? null;
        customRoleId = readMemberCustomRoles(settings)[user.id];
        if (settings?.role_permissions && typeof settings.role_permissions === "object") {
          permissions = mergeRolePermissions(settings.role_permissions as RolePermissions);
        }
      }

      if (role) {
        setAuthzCookie(supabaseResponse, {
          u: user.id,
          r: role,
          c: customRoleId ?? null,
          o: profile?.company_id ?? null,
          s: companySlug,
          p: permissions,
        });
      }
    }

    const denied = applyRoleCheck(request, role, permissions, customRoleId);
    if (denied) return denied;
    return withLegacyCookieCleared(supabaseResponse, request);
  }

  return supabaseResponse;
}
