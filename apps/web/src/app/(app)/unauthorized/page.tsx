"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="neumorph-icon h-20 w-20 mx-auto">
        <ShieldAlert className="h-9 w-9 text-destructive" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">アクセス権限がありません</h1>
        <p className="text-muted-foreground text-sm max-w-sm">
          このページを表示する権限がありません。<br />
          必要な場合は管理者にお問い合わせください。
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard">ダッシュボードへ戻る</Link>
      </Button>
    </div>
  );
}
