import type { ReactNode } from "react";
import { formatDateSlash, inclOf, taxOf, yen } from "@/lib/procurement";

export type VendorInvoiceSheetData = {
  companyName: string;
  companyAddress: string;
  companyInvoiceNo: string;
  constructionTitle: string;
  orderTitle: string;
  poNo: string;
  amount: number;
  deliveryDate: string | null;
  workContent: string | null;
  vendorName: string;
  vendorAddress: string;
  vendorPhone: string;
  paymentDate: string | null;
  bankName: string;
  bankBranch: string;
  bankAccountType: string;
  bankAccountNumber: string;
  bankAccountKana: string;
  bankInfo: string;
  invoiceDate?: string | null;
  invoiceNo?: string | null;
  registrationNumber?: string | null;
  remarks?: string | null;
};

const autoBox = "rounded-md border border-[#E8E0D0] bg-[#FAF6EE] px-3 py-2 text-sm leading-snug";

function Placeholder({ text }: { text: string }) {
  return <span className="text-muted-foreground">{text}</span>;
}

function SlotOrText({
  slot,
  value,
  placeholder,
}: {
  slot?: ReactNode;
  value?: string | null;
  placeholder: string;
}) {
  if (slot) return slot;
  return <p className="text-sm min-h-8 flex items-center">{value || <Placeholder text={placeholder} />}</p>;
}

export function VendorInvoiceSheet({
  invoice,
  invoiceDateSlot,
  invoiceNoSlot,
  registrationSlot,
  remarksSlot,
  extra,
}: {
  invoice: VendorInvoiceSheetData;
  invoiceDateSlot?: ReactNode;
  invoiceNoSlot?: ReactNode;
  registrationSlot?: ReactNode;
  remarksSlot?: ReactNode;
  extra?: ReactNode;
}) {
  const excl = invoice.amount;
  const tax = taxOf(excl);
  const incl = inclOf(excl);
  const subject = `${invoice.constructionTitle || invoice.orderTitle}（発注番号 ${invoice.poNo || "—"}）`;
  const itemName = invoice.workContent || invoice.orderTitle;
  const bankLine = [invoice.bankName, invoice.bankBranch, invoice.bankAccountType, invoice.bankAccountNumber]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-6 text-slate-900">
      <div className="flex justify-between gap-8 flex-wrap">
        <div className="min-w-[240px]">
          <h1 className="text-[28px] font-bold tracking-wide">請求書</h1>
          <p className="mt-4 text-base font-semibold">{invoice.companyName} 御中</p>
          {invoice.companyAddress && (
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{invoice.companyAddress}</p>
          )}
          {invoice.companyInvoiceNo && (
            <p className="text-xs text-muted-foreground">登録番号 {invoice.companyInvoiceNo}</p>
          )}
        </div>

        <div className="w-[280px] space-y-3 text-xs">
          <div className="grid grid-cols-[72px_1fr] items-center gap-2">
            <span className="text-muted-foreground">請求日</span>
            <SlotOrText slot={invoiceDateSlot} value={invoice.invoiceDate} placeholder="（貴社で入力）" />
          </div>
          <div className="grid grid-cols-[72px_1fr] items-center gap-2">
            <span className="text-muted-foreground">請求番号</span>
            <SlotOrText slot={invoiceNoSlot} value={invoice.invoiceNo} placeholder="（任意・貴社で入力）" />
          </div>
          <div className="pt-1">
            <p className="text-muted-foreground mb-1">請求元</p>
            <p className="text-sm font-semibold text-foreground">{invoice.vendorName}</p>
            {invoice.vendorAddress && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">{invoice.vendorAddress}</p>
            )}
            {invoice.vendorPhone && (
              <p className="text-[11px] text-muted-foreground">TEL {invoice.vendorPhone}</p>
            )}
            <div className="mt-2 grid grid-cols-[72px_1fr] items-center gap-2">
              <span className="text-muted-foreground">登録番号</span>
              <SlotOrText slot={registrationSlot} value={invoice.registrationNumber} placeholder="（貴社で入力）" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px_180px] gap-3 items-end">
        <div>
          <p className="text-[11px] text-muted-foreground mb-1">件名</p>
          <div className={autoBox}>{subject}</div>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground mb-1">取引日</p>
          <div className={autoBox}>{formatDateSlash(invoice.deliveryDate)}</div>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-muted-foreground mb-1">ご請求金額（税込）</p>
          <p className="text-[28px] leading-none font-bold text-[#1D4ED8]">{yen(incl)}</p>
        </div>
      </div>

      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-[#F3F4F6] text-muted-foreground">
            <th className="border border-slate-200 px-2 py-2 text-left font-medium">取引日</th>
            <th className="border border-slate-200 px-2 py-2 text-left font-medium">品目・内容</th>
            <th className="border border-slate-200 px-2 py-2 text-right font-medium w-16">数量</th>
            <th className="border border-slate-200 px-2 py-2 text-right font-medium w-28">単価</th>
            <th className="border border-slate-200 px-2 py-2 text-right font-medium w-28">金額（税抜）</th>
            <th className="border border-slate-200 px-2 py-2 text-right font-medium w-16">税率</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-slate-200 px-2 py-2">{formatDateSlash(invoice.deliveryDate)}</td>
            <td className="border border-slate-200 px-2 py-2">{itemName}</td>
            <td className="border border-slate-200 px-2 py-2 text-right">1式</td>
            <td className="border border-slate-200 px-2 py-2 text-right tabular-nums">{yen(excl)}</td>
            <td className="border border-slate-200 px-2 py-2 text-right tabular-nums">{yen(excl)}</td>
            <td className="border border-slate-200 px-2 py-2 text-right">10%</td>
          </tr>
          <tr className="h-9">
            <td className="border border-slate-200 bg-[#FAFBFC]" />
            <td className="border border-slate-200 bg-[#FAFBFC]" />
            <td className="border border-slate-200 bg-[#FAFBFC]" />
            <td className="border border-slate-200 bg-[#FAFBFC]" />
            <td className="border border-slate-200 bg-[#FAFBFC]" />
            <td className="border border-slate-200 bg-[#FAFBFC]" />
          </tr>
        </tbody>
      </table>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="text-xs space-y-2">
          <p className="font-semibold text-sm">お振込先</p>
          <p className="leading-relaxed">{bankLine || invoice.bankInfo}</p>
          {invoice.bankAccountKana && <p>口座名義 {invoice.bankAccountKana}</p>}
          <p className="text-muted-foreground">振込手数料は発注条件に従います。</p>
          <p>
            <span className="text-muted-foreground">お支払予定日</span>
            <span className="ml-2 font-medium">{formatDateSlash(invoice.paymentDate)}</span>
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 p-4 text-sm space-y-2">
          <div className="flex justify-between">
            <span>小計（税抜）</span>
            <span className="tabular-nums">{yen(excl)}</span>
          </div>
          <div className="flex justify-between">
            <span>消費税（10%）</span>
            <span className="tabular-nums">{yen(tax)}</span>
          </div>
          <div className="flex justify-between font-bold text-[#1D4ED8] pt-2 border-t">
            <span>合計（税込）</span>
            <span className="tabular-nums">{yen(incl)}</span>
          </div>
        </div>
      </div>

      <div className={extra ? "grid md:grid-cols-2 gap-6" : "space-y-1"}>
        <div className="space-y-1">
          <p className="text-xs font-semibold">備考</p>
          {remarksSlot ?? (
            <p className="text-sm min-h-20 rounded-md border px-3 py-2">
              {invoice.remarks || <Placeholder text="（任意・貴社で入力）" />}
            </p>
          )}
        </div>
        {extra}
      </div>
    </div>
  );
}
