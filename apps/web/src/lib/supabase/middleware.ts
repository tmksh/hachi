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

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Skip auth check if Supabase is not configured
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public routes that don't require auth
  const publicPaths = ["/login", "/api/auth/callback", "/unauthorized"];
  const isPublicPath = publicPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Redirect root to dashboard
  if (user && request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // ── ロールベースのルート保護 ──────────────────────────────────
  if (user) {
    const { pathname } = request.nextUrl;

    // /admin は admin@example.com のみアクセス可
    if (pathname.startsWith("/admin")) {
      if (user.email !== "admin@example.com") {
        const url = request.nextUrl.clone();
        url.pathname = "/unauthorized";
        return NextResponse.redirect(url);
      }
    }

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
