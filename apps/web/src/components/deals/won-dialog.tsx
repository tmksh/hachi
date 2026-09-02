"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, FileText, HardHat, ArrowRight, Loader2, FileSignature } from "lucide-react";
import { confirmDealWon } from "@/lib/actions/sales-flow";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  deal: {
    id: string;
    title: string;
    value: number | null;
    customer_id: string | null;
    customer?: { id: string; name: string; company_name?: string | null } | null;
  };
}

export function WonDialog({ open, onOpenChange, deal }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  const customerName = deal.customer?.company_name || deal.customer?.name || "";
  const params = new URLSearchParams();
  if (deal.customer_id) params.set("customer_id", deal.customer_id);
  if (deal.id) params.set("deal_id", deal.id);
  if (deal.title) params.set("title", deal.title);
  if (deal.value) {
    params.set("order_amount", String(deal.value));
    params.set("value", String(deal.value));
  }

  const handleConfirmWon = async () => {
    setConfirming(true);
    try {
      const result = await confirmDealWon(deal.id);
      toast.success(`契約 ${result.contractNo} を自動登録しました`);
      onOpenChange(false);
      router.push(result.redirectUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "受注確定に失敗しました");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            受注確定
          </DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <p className="text-sm text-muted-foreground mb-5">
            <span className="font-medium text-foreground">{deal.title}</span>
            {customerName && <span>（{customerName}）</span>}
            の受注を確定します。契約レコードを自動作成し、工事登録へ進みます。
          </p>
          <div className="space-y-2">
            <button
              onClick={handleConfirmWon}
              disabled={confirming}
              className="w-full flex items-center gap-4 rounded-xl border-2 border-primary/30 bg-primary/5 p-4 hover:bg-primary/10 transition-colors text-left"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                {confirming ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <FileSignature className="h-5 w-5 text-primary" />}
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">受注確定 → 契約登録 → 工事登録</p>
                <p className="text-xs text-muted-foreground">契約を自動作成し、見積・顧客情報を転記</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => { onOpenChange(false); router.push(`/quotes/new?${params.toString()}`); }}
              className="w-full flex items-center gap-4 rounded-xl border border-border p-4 hover:bg-accent transition-colors text-left"
            >
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">見積書を作成する</p>
                <p className="text-xs text-muted-foreground">顧客情報・金額を引き継いで見積を作成</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => { onOpenChange(false); router.push(`/constructions/new?${params.toString()}`); }}
              className="w-full flex items-center gap-4 rounded-xl border border-border p-4 hover:bg-accent transition-colors text-left"
            >
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                <HardHat className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">工事のみ登録（契約なし）</p>
                <p className="text-xs text-muted-foreground">契約自動作成をスキップ</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <Button variant="ghost" className="w-full mt-3 text-muted-foreground" onClick={() => onOpenChange(false)}>
            あとで対応する
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
