"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, LogOut, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { disconnectGoogleCalendar } from "@/lib/actions/calendar";
import { createClient } from "@/lib/supabase/client";

const SETTINGS_RETURN = "/settings?tab=external_integrations";

const GCAL_ERRORS: Record<string, string> = {
  access_denied: "Googleカレンダー連携がキャンセルされました",
  missing_calendar_scope: "カレンダーへの書き込み権限が付与されませんでした。再度「再連携」してください",
  oauth_not_configured: "Google OAuth 設定が未完了です（管理者に連絡してください）",
  invalid_client: "Google OAuth クライアント設定が不正です",
  redirect_uri_mismatch: "Google OAuth の redirect URI 設定が一致しません",
  token_exchange: "Google トークンの取得に失敗しました",
  db_error: "連携情報の保存に失敗しました",
};

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export function GoogleCalendarSettingsCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [calendarRedirectUri, setCalendarRedirectUri] = useState<string | null>(null);
  const [gmailRedirectUri, setGmailRedirectUri] = useState<string | null>(null);
  const [requestOrigin, setRequestOrigin] = useState<string | null>(null);
  const [clientIdSuffix, setClientIdSuffix] = useState<string | null>(null);
  const [appUrlHost, setAppUrlHost] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const supabase = createClient();
    const [{ data: { user } }, tokenRes, oauthRes] = await Promise.all([
      supabase.auth.getUser(),
      fetch("/api/google-token"),
      fetch("/api/google-oauth-status"),
    ]);
    if (oauthRes.ok) {
      const oauth = await oauthRes.json() as {
        calendarRedirectUri?: string;
        gmailRedirectUri?: string;
        requestOrigin?: string;
        clientIdSuffix?: string | null;
        appUrlHost?: string | null;
      };
      setCalendarRedirectUri(oauth.calendarRedirectUri ?? null);
      setGmailRedirectUri(oauth.gmailRedirectUri ?? null);
      setRequestOrigin(oauth.requestOrigin ?? null);
      setClientIdSuffix(oauth.clientIdSuffix ?? null);
      setAppUrlHost(oauth.appUrlHost ?? null);
    }
    const googleIdentity = user?.identities?.find((i) => i.provider === "google");
    setEmail(
      (googleIdentity?.identity_data?.email as string | undefined)
        ?? (user?.user_metadata?.email as string | undefined)
        ?? user?.email
        ?? null,
    );
    if (tokenRes.ok) {
      const data = await tokenRes.json() as { access_token?: string | null; connected?: boolean };
      setConnected(Boolean(data.access_token) || data.connected === true);
    } else {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    loadStatus().catch(() => setConnected(false)).finally(() => setLoading(false));
  }, [loadStatus]);

  useEffect(() => {
    const ok = searchParams.get("gcal_connected");
    const error = searchParams.get("gcal_error");
    if (!ok && !error) return;
    if (ok) {
      toast.success("Googleカレンダーと連携しました（書き込み権限を含む）");
      void loadStatus();
    } else if (error) {
      toast.error(GCAL_ERRORS[error] ?? "Googleカレンダー連携に失敗しました");
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("gcal_connected");
    url.searchParams.delete("gcal_error");
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }, [searchParams, router, loadStatus]);

  const connect = () => {
    setConnecting(true);
    window.location.href = `/api/google-calendar/auth?return=${encodeURIComponent(SETTINGS_RETURN)}`;
  };

  const disconnect = async () => {
    if (!confirm("Google カレンダーの連携を解除しますか？")) return;
    setDisconnecting(true);
    try {
      await disconnectGoogleCalendar();
      setConnected(false);
      toast.success("Google カレンダーの連携を解除しました");
    } catch {
      toast.error("解除に失敗しました");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">外部連携</CardTitle>
        <p className="text-sm text-muted-foreground">
          ここで連携すると、カレンダー画面に Google の予定が表示されます。
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3">
          <GoogleLogo className="h-6 w-6 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Googleカレンダー</p>
            <p className="text-xs text-muted-foreground truncate">
              {loading ? "確認中..." : connected ? (email ?? "連携中") : "未連携"}
            </p>
          </div>
          {connected ? (
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200" variant="outline">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              連携中
            </Badge>
          ) : (
            <Badge variant="secondary">未連携</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={connect} disabled={connecting || disconnecting}>
            {connecting ? <Loader2 className="size-4 mr-1 animate-spin" /> : <RefreshCw className="size-4 mr-1" />}
            {connected ? "再連携（トークン更新）" : "Googleカレンダーを連携"}
          </Button>
          {connected && (
            <Button variant="outline" onClick={() => void disconnect()} disabled={disconnecting}>
              {disconnecting ? <Loader2 className="size-4 mr-1 animate-spin" /> : <LogOut className="size-4 mr-1" />}
              連携を解除
            </Button>
          )}
        </div>
        {calendarRedirectUri && (
          <div className="rounded-xl border bg-muted/40 px-4 py-3 space-y-2 text-xs">
            <p className="font-medium text-foreground">Google Cloud Console に入れる URI</p>
            <p className="text-muted-foreground">
              このセッションが Google に送る URI です。Console の「承認済みのリダイレクト URI」と一字一句同じか、同じウェブクライアントか確認してください。
            </p>
            <p className="font-mono break-all">カレンダー: {calendarRedirectUri}</p>
            {gmailRedirectUri && (
              <p className="font-mono break-all">メール: {gmailRedirectUri}</p>
            )}
            {requestOrigin && (
              <p className="font-mono break-all text-muted-foreground">アクセス元: {requestOrigin}</p>
            )}
            {appUrlHost && (
              <p className="font-mono break-all text-muted-foreground">APP_URL: {appUrlHost}</p>
            )}
            {clientIdSuffix && (
              <p className="font-mono break-all text-muted-foreground">Client ID 末尾: …{clientIdSuffix}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
