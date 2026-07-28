import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  canAccessPathWithPermissions,
  featureKeyForPath,
  mergeRolePermissions,
  type RolePermissions,
} from "@/lib/role-permissions";

/** 権限チェック対象のルート（マトリクス未設定時のフォールバック用ハードコード） */
const LEGACY_ROUTE_PREFIXES = [
  "/bi", "/bi2", "/crm", "/deals", "/quotes", "/craftsmen",
  "/contracts", "/constructions", "/invoices", "/budget", "/marketing",
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

export async function updateSession(request: NextRequest) {
  const canonicalRedirect = redirectToCanonicalDomain(request);
  if (canonicalRedirect) return canonicalRedirect;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

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

  const { data: { user } } = await supabase.auth.getUser();

  // ── サブドメイン解決（NEXT_PUBLIC_APP_DOMAIN 設定後に有効） ─────────────────
  const slug = extractSubdomain(request);
  if (slug) {
    const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN!;
    const { pathname } = request.nextUrl;

    // slug が DB に存在するか確認（RLS を避け id のみ取得）
    const { data: companyId } = await supabase.rpc("resolve_company_id_by_slug", {
      p_slug: slug,
    });

    if (!companyId) {
      // 存在しない slug → apex ドメインのトップにリダイレクト
      const url = request.nextUrl.clone();
      url.host = appDomain;
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    // 未ログインで /login 以外にアクセス → サブドメインの /login へ
    if (!user && !pathname.startsWith("/login") && !pathname.startsWith("/api/auth") && !pathname.startsWith("/onboarding")) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    // ログイン済みで /login → /dashboard へ
    if (user && pathname === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // ログイン済みユーザーが別テナントのサブドメインにアクセスしようとした場合は弾く
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (profile && profile.company_id !== companyId) {
        // 自テナントのサブドメインにリダイレクト
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
    }

    // サブドメイン情報をヘッダーで Server Components に伝搬
    supabaseResponse.headers.set("x-tenant-slug", slug);
    supabaseResponse.headers.set("x-tenant-id", companyId);
    return supabaseResponse;
  }
  // ── ここから下は従来のシングルドメイン動作（現状と完全に同一） ─────────────

  const publicPaths = [
    "/login",
    "/admin/login",
    "/api/auth/callback",
    "/api/auth/accept-invite",
    "/api/webhooks/",
    "/unauthorized",
    "/reset-password",
    "/update-password",
    "/onboarding",
    "/partner",
    ...(process.env.NODE_ENV === "development" ? ["/api/dev/"] : []),
  ];
  const isPublicPath = publicPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );
  const isExternalApi = request.nextUrl.pathname.startsWith("/api/v1/");

  // /admin 配下は super-admin@example.com 以外なら /admin/login へ
  if (
    request.nextUrl.pathname.startsWith("/admin") &&
    request.nextUrl.pathname !== "/admin/login" &&
    (!user || user.email !== "super-admin@example.com")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  if (!user && !isPublicPath && !isExternalApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname === "/admin/login" && user.email === "super-admin@example.com") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (user) {
    const { pathname } = request.nextUrl;

    const needsRoleCheck =
      !!featureKeyForPath(pathname)
      || LEGACY_ROUTE_PREFIXES.some((p) => pathname.startsWith(p));

    if (needsRoleCheck) {
      // 壊れた旧 cookie（bl_rp）は毎回消す
      if (request.cookies.has(LEGACY_ROLE_PERM_COOKIE)) {
        supabaseResponse.cookies.set(LEGACY_ROLE_PERM_COOKIE, "", { path: "/", maxAge: 0 });
      }

      let role: string | undefined;
      let permissions: RolePermissions | null = null;

      const cached = decodeAuthz(request.cookies.get(AUTHZ_COOKIE)?.value ?? "");
      if (cached && cached.u === user.id) {
        role = cached.r;
        // キャッシュは merge 済み。再 merge すると _v 欠落で HEAL が権限を復元してしまう
        permissions = cached.p ?? null;
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
            .select("settings")
            .eq("id", profile.company_id)
            .maybeSingle();
          const settings = (company?.settings ?? null) as Record<string, unknown> | null;
          if (settings?.role_permissions && typeof settings.role_permissions === "object") {
            // 旧スキーマは merge で営業・経営層などを補完してから判定
            permissions = mergeRolePermissions(settings.role_permissions as RolePermissions);
          }
        }

        if (role) {
          try {
            const encoded = encodeAuthz({ u: user.id, r: role, p: permissions });
            // Cookie 上限対策（大きすぎる場合はキャッシュしない）
            if (encoded.length < 3500) {
              supabaseResponse.cookies.set(AUTHZ_COOKIE, encoded, {
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
      }

      if (!role || !canAccessPathWithPermissions(pathname, role, permissions)) {
        const url = request.nextUrl.clone();
        url.pathname = "/unauthorized";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

/** 旧実装の肥大 cookie（誤拒否の原因） */
const LEGACY_ROLE_PERM_COOKIE = "bl_rp";
/** role + 権限マトリクスの短命キャッシュ（毎リクエストの DB 2回を避ける） */
const AUTHZ_COOKIE = "bl_az";
const AUTHZ_MAX_AGE_SEC = 300;

type AuthzCache = {
  u: string;
  r: string;
  p: RolePermissions | null;
};

function encodeAuthz(data: AuthzCache): string {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeAuthz(raw: string): AuthzCache | null {
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
