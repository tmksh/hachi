"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const supabase = createClient();
      // Netlify デフォルトホストや旧 URL に飛ばないよう、本番ドメインを優先
      const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN?.replace(/^https?:\/\//, "");
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
      const host = window.location.hostname;
      const base =
        appUrl
        || (appDomain ? `https://${appDomain}` : null)
        || (host.endsWith("netlify.app") && appDomain ? `https://${appDomain}` : null)
        || window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${base}/api/auth/callback?next=/update-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err: unknown) {
      toast.error("送信に失敗しました", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md px-4">
      <Card className="border-0 shadow-xl shadow-primary/5">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="flex items-center justify-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">B</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">BRIDGE</h1>
          </div>
          <p className="text-sm text-muted-foreground">パスワードのリセット</p>
        </CardHeader>

        <CardContent>
          {sent ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <div>
                <p className="font-semibold">メールを送信しました</p>
                <p className="text-sm text-muted-foreground mt-1">
                  <span className="font-medium">{email}</span> に<br />
                  パスワードリセット用のリンクを送信しました。
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  メールが届かない場合はスパムフォルダをご確認ください。
                </p>
              </div>
              <Link href="/login">
                <Button variant="outline" size="sm" className="gap-1.5 mt-2">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  ログインに戻る
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground pb-2">
                登録済みのメールアドレスを入力してください。パスワードリセット用のリンクを送信します。
              </p>
              <div className="space-y-2">
                <Label htmlFor="email">メールアドレス</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.co.jp"
                    className="pl-9 h-11"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full h-11 font-medium" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                リセットメールを送信
              </Button>
              <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mt-2">
                <ArrowLeft className="h-3.5 w-3.5" />
                ログインに戻る
              </Link>
            </form>
          )}
        </CardContent>

        <CardFooter className="justify-center pb-6">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} SHINJIDAI Inc. All rights reserved.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
