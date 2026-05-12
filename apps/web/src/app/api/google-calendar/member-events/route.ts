import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get("userId");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!targetUserId || !start || !end) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  // 認証チェック
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 同じ企業かチェック
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  const admin = createAdminClient();
  const { data: targetProfile } = await admin
    .from("profiles")
    .select("company_id, google_access_token, google_refresh_token, google_token_expires_at")
    .eq("id", targetUserId)
    .single();

  if (!targetProfile || targetProfile.company_id !== myProfile?.company_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!targetProfile.google_access_token) {
    return NextResponse.json({ events: [] });
  }

  let token = targetProfile.google_access_token as string;
  const expiresAt = targetProfile.google_token_expires_at
    ? new Date(targetProfile.google_token_expires_at as string).getTime()
    : 0;

  // トークンリフレッシュ
  if (Date.now() >= expiresAt - 60_000 && targetProfile.google_refresh_token) {
    try {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          refresh_token: targetProfile.google_refresh_token as string,
          grant_type: "refresh_token",
        }),
      });
      if (res.ok) {
        const tokens = await res.json();
        token = tokens.access_token as string;
        const newExpiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();
        await admin.from("profiles").update({
          google_access_token: token,
          google_token_expires_at: newExpiresAt,
        }).eq("id", targetUserId);
      }
    } catch {
      // リフレッシュ失敗でも既存トークンで試みる
    }
  }

  // Google Calendar API 呼び出し
  try {
    const gcRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        new URLSearchParams({
          timeMin: start,
          timeMax: end,
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "200",
        }),
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!gcRes.ok) {
      return NextResponse.json({ events: [] });
    }

    const gcData = await gcRes.json();
    return NextResponse.json({ events: gcData.items ?? [] });
  } catch {
    return NextResponse.json({ events: [] });
  }
}
