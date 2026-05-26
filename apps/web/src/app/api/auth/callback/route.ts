import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestOrigin } from "@/lib/request-origin";

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

      // Google provider_token/refresh_token を DB に保存（ページリロード後も使えるように）
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

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
