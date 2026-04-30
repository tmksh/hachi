"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Loader2, CalendarDays, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function OnboardingPage() {
  const router = useRouter();
  const [connecting, setConnecting] = useState(false);

  const handleConnectGoogle = async () => {
    setConnecting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=/dashboard`,
        scopes: "https://www.googleapis.com/auth/calendar.readonly",
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
    if (error) {
      toast.error("Google 連携に失敗しました");
      setConnecting(false);
    }
  };

  const handleSkip = () => {
    router.replace("/dashboard");
  };

  return (
    <div className="w-full max-w-md px-4">
      <Card className="border-0 shadow-xl shadow-primary/5">
        <CardHeader className="text-center space-y-4 pb-4">
          <div className="flex items-center justify-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">B</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">BRIDGE</h1>
          </div>
          <div>
            <p className="text-lg font-semibold">アカウントを作成しました</p>
            <p className="text-sm text-muted-foreground mt-1">
              最後にひとつだけ設定しましょう
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Google Calendar 連携カード */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-white border flex items-center justify-center shrink-0 shadow-sm">
                <CalendarDays className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-semibold">Google カレンダーを連携する</p>
                <p className="text-xs text-muted-foreground">
                  自分のGoogleカレンダーの予定をBRIDGEで確認できます
                </p>
              </div>
            </div>

            <ul className="text-xs text-muted-foreground space-y-1 pl-1">
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                カレンダーの読み取り権限のみ（書き込みは行いません）
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                他のメンバーにはあなたのカレンダーは見えません
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                後からカレンダーページでいつでも連携・解除できます
              </li>
            </ul>
          </div>

          <Button
            className="w-full h-11 gap-3 font-medium"
            onClick={handleConnectGoogle}
            disabled={connecting}
          >
            {connecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            {connecting ? "Googleに接続中..." : "Google カレンダーを連携する"}
          </Button>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pb-6">
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={handleSkip}
            disabled={connecting}
          >
            スキップしてダッシュボードへ
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            &copy; {new Date().getFullYear()} SHINJIDAI Inc. All rights reserved.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
