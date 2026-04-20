"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, FileText } from "lucide-react";
import { completeConstruction } from "@/lib/actions/constructions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  construction: {
    id: string;
    title: string;
    order_amount: number | null;
    actual_cost: number | null;
    customer?: { name: string; company_name?: string | null } | null;
  };
  onCompleted: () => void;
}

export function CompletionDialog({ open, onOpenChange, construction, onCompleted }: Props) {
  const router = useRouter();
  const today = format(new Date(), "yyyy-MM-dd");
  const due = format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");

  const [actualCost, setActualCost]       = useState(String(construction.actual_cost ?? ""));
  const [createInv, setCreateInv]         = useState(true);
  const [recipient, setRecipient]         = useState(construction.customer?.company_name || construction.customer?.name || "");
  const [invoiceDate, setInvoiceDate]     = useState(today);
  const [dueDate, setDueDate]             = useState(due);
  const [amount, setAmount]               = useState(String(construction.order_amount ?? ""));
  const [paymentTerms, setPaymentTerms]   = useState("銀行振込");
  const [saving, setSaving]               = useState(false);
  const [done, setDone]                   = useState<{ invoiceId: string | null } | null>(null);

  async function handleSubmit() {
    setSaving(true);
    try {
      const result = await completeConstruction(construction.id, {
        actual_cost: Number(actualCost) || 0,
        createInvoice: createInv,
        invoice: createInv ? {
          recipient,
          invoice_date: invoiceDate,
          due_date: dueDate,
          amount: Number(amount) || 0,
          payment_terms: paymentTerms,
        } : undefined,
      });
      setDone({ invoiceId: result.invoiceId });
      onCompleted();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-lg">工事が完了しました</p>
              <p className="text-sm text-muted-foreground mt-1">{construction.title}</p>
            </div>
            {done.invoiceId && (
              <div className="w-full rounded-xl border border-border bg-muted/40 px-4 py-3 flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">最終精算請求書を作成しました</p>
                  <p className="text-xs text-muted-foreground">請求管理から確認・送付できます</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => { onOpenChange(false); router.push(`/invoices/${done.invoiceId}`); }}>
                  確認する
                </Button>
              </div>
            )}
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>閉じる</Button>
              <Button className="flex-1" onClick={() => { onOpenChange(false); router.push("/invoices"); }}>請求管理へ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            工事を完了にする
          </DialogTitle>
          <DialogDescription>{construction.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* 実績原価 */}
          <div className="space-y-1.5">
            <Label htmlFor="actual-cost">実績原価（税抜）</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">¥</span>
              <Input
                id="actual-cost"
                className="pl-7"
                value={actualCost}
                onChange={e => setActualCost(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="例: 14800000"
              />
            </div>
            {actualCost && construction.order_amount && (
              <p className="text-xs text-muted-foreground">
                粗利: ¥{(construction.order_amount - Number(actualCost)).toLocaleString()}
                　（{((construction.order_amount - Number(actualCost)) / construction.order_amount * 100).toFixed(1)}%）
              </p>
            )}
          </div>

          <Separator />

          {/* 請求書生成 */}
          <div className="flex items-center gap-3">
            <Checkbox id="create-inv" checked={createInv} onCheckedChange={v => setCreateInv(v as boolean)} />
            <Label htmlFor="create-inv" className="font-medium cursor-pointer">最終精算請求書を自動作成する</Label>
          </div>

          {createInv && (
            <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="recipient">請求先（宛名）</Label>
                <Input id="recipient" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="田中 健太郎 様" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="inv-date">請求日</Label>
                  <Input id="inv-date" type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="due-date">支払期限</Label>
                  <Input id="due-date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-amount">請求金額（税抜）</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">¥</span>
                  <Input
                    id="inv-amount"
                    className="pl-7"
                    value={amount}
                    onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder={String(construction.order_amount ?? "")}
                  />
                </div>
                {amount && (
                  <p className="text-xs text-muted-foreground">
                    税込: ¥{Math.floor(Number(amount) * 1.1).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="payment-terms">支払方法</Label>
                <Input id="payment-terms" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} placeholder="銀行振込" />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>キャンセル</Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">
            {saving ? "処理中..." : "完了にする"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
