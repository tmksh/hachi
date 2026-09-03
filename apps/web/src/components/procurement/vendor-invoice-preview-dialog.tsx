"use client";

import { useEffect, useState } from "react";
import { FileDown, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VendorInvoiceSheet } from "@/components/procurement/vendor-invoice-sheet";
import {
  getStaffVendorInvoicePreview,
  resendInvoiceUrl,
  type ProcurementOrder,
  type VendorInvoiceView,
} from "@/lib/actions/procurement";

export function VendorInvoicePreviewDialog({
  order,
  onClose,
  showResend,
}: {
  order: ProcurementOrder | null;
  onClose: () => void;
  showResend?: boolean;
}) {
  const [invoice, setInvoice] = useState<VendorInvoiceView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!order) {
      setInvoice(null);
      setError("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    setInvoice(null);
    void getStaffVendorInvoicePreview(order.id).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setInvoice(res.invoice);
    });
    return () => { cancelled = true; };
  }, [order?.id]);

  if (!order) return null;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="flex flex-col gap-0 p-0 overflow-hidden max-h-[92vh] w-[min(calc(100%-1.5rem),calc(210mm+4rem))] max-w-[min(calc(100%-1.5rem),calc(210mm+4rem))] sm:max-w-[min(calc(100%-1.5rem),calc(210mm+4rem))]"
        showCloseButton={false}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3 bg-slate-100 border-b shrink-0">
          <DialogTitle className="text-xs font-semibold text-slate-600 min-w-0 truncate">
            請求書プレビュー（当社フォーマット）
          </DialogTitle>
          <div className="flex items-center gap-2 shrink-0">
            {showResend && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={resending}
                onClick={async () => {
                  setResending(true);
                  const res = await resendInvoiceUrl(order.id);
                  setResending(false);
                  if (!res.ok) { toast.error(res.error); return; }
                  const path = res.url;
                  const url = path ? `${window.location.origin}${path}` : "";
                  if (url) {
                    try { void navigator.clipboard.writeText(url); } catch { /* ignore */ }
                  }
                  if (res.emailSent) {
                    toast.success("業者へ請求書URLをメール送信しました", { description: res.emailTo ?? url });
                  } else {
                    toast.error(res.emailError || "メールを送れませんでした", { description: url || undefined });
                  }
                }}
              >
                URLを再送
              </Button>
            )}
            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => window.print()}>
              <FileDown className="h-3.5 w-3.5" />印刷 / PDF保存
            </Button>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-slate-700">
                <X className="h-4 w-4" />
                <span className="sr-only">閉じる</span>
              </Button>
            </DialogClose>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-slate-200 py-6 px-4">
          {loading && <p className="text-sm text-center text-muted-foreground py-16">読み込み中…</p>}
          {error && <p className="text-sm text-center text-red-600 py-16">{error}</p>}
          {invoice && (
            <div
              id="vendor-invoice-print-area"
              className="bg-white shadow-lg mx-auto w-full max-w-[210mm] min-h-[297mm] box-border p-10"
            >
              <p className="text-[11px] text-muted-foreground mb-4 print:hidden">
                業者がURLで見る帳票です。金額・品目・取引日は発注と納品から入っています。請求日・請求番号・登録番号は業者が入力します。
              </p>
              <VendorInvoiceSheet invoice={invoice} />
            </div>
          )}
        </div>
        <style>{`
          @page { size: A4; margin: 12mm; }
          @media print {
            body * { visibility: hidden; }
            #vendor-invoice-print-area,
            #vendor-invoice-print-area * { visibility: visible; }
            #vendor-invoice-print-area {
              position: absolute;
              inset: 0;
              width: auto !important;
              max-width: none !important;
              min-height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
            }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
