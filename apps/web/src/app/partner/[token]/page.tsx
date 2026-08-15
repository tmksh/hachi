"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HardHat, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  acceptPartnerOrder,
  getPartnerPortalOrder,
  type PartnerPortalOrder,
} from "@/lib/actions/partner-portal";

/** 外部協力業者向け URL アクセス（⑥ No.10）— ログイン不要 */
export default function PartnerPortalPage() {
  const { token } = useParams();
  const tokenStr = String(token ?? "");
  const [order, setOrder] = useState<PartnerPortalOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!tokenStr) {
      setLoading(false);
      return;
    }
    getPartnerPortalOrder(tokenStr)
      .then(setOrder)
      .finally(() => setLoading(false));
  }, [tokenStr]);

  const handleAccept = async () => {
    if (!tokenStr) return;
    setAccepting(true);
    const res = await acceptPartnerOrder(tokenStr);
    setAccepting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setOrder((prev) => (prev ? { ...prev, accepted: true } : prev));
    toast.success("受領しました");
  };

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8 flex items-center justify-center">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <HardHat className="h-5 w-5" />発注書確認（外部協力業者）
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : !order ? (
            <p className="text-sm text-muted-foreground">
              このリンクは無効か、期限切れです。発注元に新しいURLを発行してもらってください。
            </p>
          ) : (
            <>
              <div className="rounded-lg border p-4 space-y-2 text-sm">
                <p className="font-medium">{order.orderTitle}</p>
                <p className="text-muted-foreground">工事名: {order.constructionTitle}</p>
                {(order.startDate || order.endDate) && (
                  <p className="text-muted-foreground">
                    工期: {order.startDate ?? "—"} 〜 {order.endDate ?? "—"}
                  </p>
                )}
                {order.craftsmanName && (
                  <p className="text-muted-foreground">発注先: {order.craftsmanName}</p>
                )}
                {order.workContent && (
                  <p className="text-muted-foreground">工事内容: {order.workContent}</p>
                )}
                <p className="font-semibold tabular-nums">
                  発注金額: ¥{order.amount.toLocaleString()}
                </p>
              </div>
              {order.accepted ? (
                <p className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />受領済み
                </p>
              ) : (
                <Button size="sm" className="gap-1.5" disabled={accepting} onClick={() => void handleAccept()}>
                  {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  受領する
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
