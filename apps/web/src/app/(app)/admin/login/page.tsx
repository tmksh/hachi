"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function AdminLoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsSubmitting(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error || !data.user) {
      toast.error("ログインに失敗しました", {
        description: "メールアドレスまたはパスワードが正しくありません",
      });
      setIsSubmitting(false);
      return;
    }

    if (data.user.email !== "super-admin@example.com") {
      await supabase.auth.signOut();
      toast.error("アクセス権限がありません", {
        description: "運営管理者アカウントでログインしてください",
      });
      setIsSubmitting(false);
      return;
    }

    window.location.href = "/admin";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/20 p-4">
      <div className="w-full max-w-md">
        <Card className="border-0 shadow-xl shadow-primary/5">
          <CardHeader className="text-center space-y-4 pb-2">
            <div className="flex items-center justify-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center shadow-md">
                <ShieldCheck className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="text-left">
                <h1 className="text-xl font-bold tracking-tight">BRIDGE 運営管理</h1>
                <p className="text-[11px] text-primary">Super Admin Console</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              運営管理者専用のログイン画面です
            </p>
          </CardHeader>

          <CardContent className="space-y-5 pt-6">
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide">
                  メールアドレス
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="super-admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide">
                  パスワード
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || !email || !password}
                className="w-full h-11"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ログイン中…
                  </>
                ) : (
                  "管理コンソールにログイン"
                )}
              </Button>
            </form>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                通常ログインに戻る
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
