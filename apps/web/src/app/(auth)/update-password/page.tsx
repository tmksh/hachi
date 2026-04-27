"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("パスワードは6文字以上で入力してください");
      return;
    }
    if (password !== confirm) {
      toast.error("パスワードが一致しません");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("パスワードを変更しました");
      router.replace("/dashboard");
    } catch (err: unknown) {
      toast.error("パスワードの変更に失敗しました", {
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
          <p className="text-sm text-muted-foreground">新しいパスワードを設定</p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">新しいパスワード</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="6文字以上"
                  className="pr-10 h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">パスワード（確認）</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="もう一度入力"
                className="h-11"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              {password && confirm && password !== confirm && (
                <p className="text-xs text-destructive">パスワードが一致しません</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-11 font-medium"
              disabled={loading || !password || password !== confirm}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              パスワードを変更する
            </Button>
          </form>
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
