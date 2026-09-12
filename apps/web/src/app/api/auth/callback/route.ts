import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestHostname, getRequestOrigin } from "@/lib/request-origin";
import { decideLoginHost, isSuperAdminEmail } from "@/lib/tenant-host";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = getRequestOrigin(request);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      const { session } = data;

      if (session.provider_token) {
        try {
          const admin = createAdminClient();
          const expiresAt = session.expires_at
            ? new Date(session.expires_at * 1000).toISOString()
            : new Date(Date.now() + 3600 * 1000).toISOString();

          await admin
            .from("profiles")
            .update({
              google_access_token: session.provider_token,
              ...(session.provider_refresh_token
                ? { google_refresh_token: session.provider_refresh_token }
                : {}),
              google_token_expires_at: expiresAt,
            })
            .eq("id", session.user.id);
        } catch (e) {
          console.error("Failed to save Google tokens:", e);
        }
      }

      const hostname = getRequestHostname(request);
      const superAdmin = isSuperAdminEmail(session.user.email);
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", session.user.id)
        .maybeSingle();

      let companySlug: string | null = null;
      if (profile?.company_id) {
        const { data: company } = await supabase
          .from("companies")
          .select("slug")
          .eq("id", profile.company_id)
          .maybeSingle();
        companySlug = company?.slug ?? null;
      }

      const gate = decideLoginHost(
        hostname,
        companySlug,
        process.env.NEXT_PUBLIC_APP_DOMAIN,
        superAdmin,
      );
      if (!gate.ok) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=wrong_tenant`);
      }

      if (superAdmin) {
        return NextResponse.redirect(`${origin}/admin`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
