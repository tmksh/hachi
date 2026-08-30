import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function withMeta(accessToken: string, includeMeta: boolean) {
  if (!includeMeta) return { access_token: accessToken, connected: true as const };
  try {
    const infoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!infoRes.ok) return { access_token: accessToken, connected: true as const, email: null as string | null };
    const info = (await infoRes.json()) as { email?: string };
    return {
      access_token: accessToken,
      connected: true as const,
      email: typeof info.email === "string" ? info.email : null,
    };
  } catch {
    return { access_token: accessToken, connected: true as const, email: null as string | null };
  }
}

export async function GET(request: Request) {
  const includeMeta = new URL(request.url).searchParams.get("meta") === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("google_access_token, google_refresh_token, google_token_expires_at")
    .eq("id", user.id)
    .single();

  // 未連携は正常系（404 にするとコンソールが赤くなり、再取得ループにも見える）
  if (!profile?.google_access_token) {
    return NextResponse.json({ access_token: null, connected: false, email: null });
  }

  const expiresAt = profile.google_token_expires_at
    ? new Date(profile.google_token_expires_at as string).getTime()
    : 0;

  // トークンが有効なら返す
  if (Date.now() < expiresAt - 60_000) {
    return NextResponse.json(await withMeta(profile.google_access_token as string, includeMeta));
  }

  // リフレッシュが必要
  if (!profile.google_refresh_token) {
    return NextResponse.json({ error: "Token expired, reconnect required" }, { status: 401 });
  }

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: profile.google_refresh_token as string,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Token refresh failed" }, { status: 401 });
    }

    const tokens = await res.json();
    const newToken = tokens.access_token as string;
    const newExpiresAt = new Date(
      Date.now() + (tokens.expires_in ?? 3600) * 1000
    ).toISOString();

    await admin
      .from("profiles")
      .update({
        google_access_token: newToken,
        google_token_expires_at: newExpiresAt,
      })
      .eq("id", user.id);

    return NextResponse.json(await withMeta(newToken, includeMeta));
  } catch {
    return NextResponse.json({ error: "Token refresh error" }, { status: 500 });
  }
}
