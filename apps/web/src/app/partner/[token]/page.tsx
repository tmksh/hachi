"use client";

import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HardHat, CheckCircle2, Download } from "lucide-react";
import { toast } from "sonner";

/** 外部協力業者向け URL アクセス（CSV No.43）— ログイン不要 */
export default function PartnerPortalPage() {
  const { token } = useParams();

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8 flex items-center justify-center">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <HardHat className="h-5 w-5" />発注書確認（外部協力業者）
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            トークン: <code className="text-xs bg-muted px-1 rounded">{String(token).slice(0, 12)}…</code>
          </p>
          <div className="rounded-lg border p-4 space-y-2 text-sm">
            <p className="font-medium">サンプル発注書</p>
            <p className="text-muted-foreground">工事名: ○○邸 リノベーション</p>
            <p className="text-muted-foreground">工期: 2026/06/01 〜 2026/08/31</p>
            <p className="font-semibold tabular-nums">発注金額: ¥1,200,000</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-1.5" onClick={() => toast.success("受領しました。請書を自動送信しました")}>
              <CheckCircle2 className="h-4 w-4" />受領する
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => toast.info("PDFをダウンロードしました")}>
              <Download className="h-4 w-4" />PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
