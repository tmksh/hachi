import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ルートプレフィックス → 許可ロール（ここで完結させて Edge Runtime の import を最小化）
const ROUTE_ROLES: Record<string, string[]> = {
  "/bi":        ["owner", "hq_admin", "contractor_admin"],
  "/crm":       ["owner", "hq_admin", "contractor_admin"],
  "/deals":     ["owner", "hq_admin", "contractor_admin"],
  "/quotes":    ["owner", "hq_admin", "contractor_admin"],
  "/craftsmen": ["owner", "hq_admin", "contractor_admin"],
  "/contracts": ["owner", "hq_admin", "contractor_admin"],
  "/invoices":  ["owner", "hq_admin", "contractor_admin"],
  "/budget":    ["owner", "hq_admin"],
  "/marketing": ["owner", "hq_admin"],
};

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
function extractSubdomain(request: NextRequest): string | null {
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN; // 例: "bridge.jp"
  if (!appDomain) return null;

  const host = request.headers.get("host") ?? "";
  // ポート番号を除去
  const hostname = host.split(":")[0];

  // localhost や IP は開発環境なのでスキップ
  if (hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return null;

  // apex ドメインまたは www はスキップ
  if (hostname === appDomain || hostname === `www.${appDomain}`) return null;

  // {slug}.{appDomain} の形式かチェック
  const suffix = `.${appDomain}`;
  if (!hostname.endsWith(suffix)) return null;

  const slug = hostname.slice(0, -suffix.length);
  // ネストしたサブドメイン（a.b.bridge.jp）や予約語はスキップ
  if (slug.includes(".") || RESERVED_SUBDOMAINS.has(slug)) return null;

  return slug;
}

export async function updateSession(request: NextRequest) {
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

    // slug が DB に存在するか確認
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("slug", slug)
      .single();

    if (!company) {
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

      if (profile && profile.company_id !== company.id) {
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
    supabaseResponse.headers.set("x-tenant-id", company.id);
    return supabaseResponse;
  }
  // ── ここから下は従来のシングルドメイン動作（現状と完全に同一） ─────────────

  const publicPaths = ["/login", "/admin/login", "/api/auth/callback", "/api/auth/accept-invite", "/unauthorized", "/reset-password", "/update-password", "/onboarding"];
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

    const matchedPath = Object.keys(ROUTE_ROLES).find((p) =>
      pathname.startsWith(p),
    );

    if (matchedPath) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      const role = profile?.role as string | undefined;
      const allowed = ROUTE_ROLES[matchedPath];

      if (!role || !allowed.includes(role)) {
        const url = request.nextUrl.clone();
        url.pathname = "/unauthorized";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
