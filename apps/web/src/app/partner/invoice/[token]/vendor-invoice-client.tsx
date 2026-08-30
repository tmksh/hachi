"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Loader2, Upload } from "lucide-react";
import {
  getVendorInvoiceByToken,
  sendVendorInvoiceAuthCode,
  submitVendorInvoice,
  uploadVendorInvoicePdf,
  verifyVendorInvoiceAuthCode,
  type VendorInvoiceView,
} from "@/lib/actions/procurement";
import { formatDateSlash, inclOf, taxOf, todayIso, yen } from "@/lib/procurement";

const vendorInput =
  "h-8 !bg-[#FFF8E7] !border-[#E8D48A] text-sm shadow-none focus-visible:border-amber-400 focus-visible:ring-amber-200/70";
const autoBox = "rounded-md border border-[#E8E0D0] bg-[#FAF6EE] px-3 py-2 text-sm leading-snug";

export function VendorInvoiceClient({
  token,
  initial,
}: {
  token: string;
  initial: VendorInvoiceView | null;
}) {
  const [invoice, setInvoice] = useState(initial);
  const [invoiceDate, setInvoiceDate] = useState(initial?.invoiceDate || todayIso());
  const [invoiceNo, setInvoiceNo] = useState(initial?.invoiceNo ?? "");
  const [regNo, setRegNo] = useState(initial?.registrationNumber ?? "");
  const [remarks, setRemarks] = useState(initial?.remarks ?? "");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfName, setPdfName] = useState(initial?.vendorPdfName ?? "");
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verified, setVerified] = useState(Boolean(initial?.emailVerified || initial?.submitted));
  const [authCode, setAuthCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!invoice) {
    return (
      <div className="min-h-screen bg-muted/40 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="font-semibold">このリンクは無効か、期限切れです。</p>
          <p className="text-sm text-muted-foreground mt-2">発注元に新しいURLの再送を依頼してください。</p>
        </div>
      </div>
    );
  }

  const excl = invoice.amount;
  const tax = taxOf(excl);
  const incl = inclOf(excl);
  const expires = invoice.expiresAt ? formatDateSlash(invoice.expiresAt) : "—";
  const locked = invoice.submitted || invoice.expired;
  const needsAuth = !verified && !invoice.submitted && !invoice.expired;
  const subject = `${invoice.constructionTitle || invoice.orderTitle}（発注番号 ${invoice.poNo || "—"}）`;
  const itemName = invoice.workContent || invoice.orderTitle;
  const bankLine = [invoice.bankName, invoice.bankBranch, invoice.bankAccountType, invoice.bankAccountNumber]
    .filter(Boolean)
    .join(" ");

  const pickFile = (file: File | null) => {
    if (!file) return;
    setPdfFile(file);
    setPdfName(file.name);
  };

  const send = async () => {
    const registration = regNo.trim().toUpperCase();
    if (!invoiceDate || !registration) {
      toast.error("請求日と登録番号を入力してください");
      return;
    }
    if (!/^T\d{13}$/.test(registration)) {
      toast.error("登録番号は T + 13桁で入力してください");
      return;
    }
    setSaving(true);
    let pdfPath: string | null = null;
    if (pdfFile) {
      const fd = new FormData();
      fd.append("file", pdfFile);
      const up = await uploadVendorInvoicePdf(token, fd);
      if (!up.ok) {
        setSaving(false);
        toast.error(up.error);
        return;
      }
      pdfPath = up.path;
    }
    const res = await submitVendorInvoice({
      token,
      invoiceDate,
      invoiceNo,
      registrationNumber: registration,
      remarks,
      pdfPath,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setInvoice({ ...invoice, submitted: true });
    toast.success("請求書を送信しました");
  };

  return (
    <div className="min-h-screen bg-[#F4F6F5] py-6 px-4">
      <div className="max-w-[880px] mx-auto space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-semibold text-emerald-800 text-sm">BRIDGE Linq</span>
          <span>{invoice.companyName} からの請求書ご依頼</span>
          <span className="rounded bg-amber-100 text-amber-800 px-2 py-0.5">有効期限 {expires}</span>
        </div>

        {needsAuth && (
          <div className="rounded-2xl bg-white shadow-sm border p-7 space-y-4">
            <h1 className="text-xl font-semibold">メールで本人確認</h1>
            {invoice.hasEmail ? (
              <>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  ログインは不要です。登録メール（{invoice.maskedEmail}）に確認コードを送ります。コードを入力すると請求書を送れます。
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="bg-emerald-700 hover:bg-emerald-800"
                    disabled={sendingCode}
                    onClick={async () => {
                      setSendingCode(true);
                      const res = await sendVendorInvoiceAuthCode(token);
                      setSendingCode(false);
                      if (!res.ok) {
                        toast.error(res.error);
                        return;
                      }
                      setCodeSent(true);
                      if (res.emailSent) toast.success(`確認コードを ${res.maskedEmail} に送りました`);
                      else toast.error(res.emailError || "メールを送れませんでした。発注元へ連絡してください");
                    }}
                  >
                    {sendingCode ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    {codeSent ? "確認コードを再送" : "確認コードを送る"}
                  </Button>
                </div>
                {codeSent && (
                  <div className="space-y-2 max-w-xs">
                    <p className="text-xs text-muted-foreground">確認コード（6桁）</p>
                    <Input
                      inputMode="numeric"
                      maxLength={6}
                      value={authCode}
                      onChange={(e) => setAuthCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="123456"
                      className={vendorInput}
                    />
                    <Button
                      disabled={authCode.length !== 6}
                      onClick={async () => {
                        const res = await verifyVendorInvoiceAuthCode(token, authCode);
                        if (!res.ok) {
                          toast.error(res.error);
                          return;
                        }
                        const fresh = await getVendorInvoiceByToken(token);
                        if (fresh) {
                          setInvoice(fresh);
                          setInvoiceDate(fresh.invoiceDate || todayIso());
                          setInvoiceNo(fresh.invoiceNo ?? "");
                          setRegNo(fresh.registrationNumber ?? "");
                          setRemarks(fresh.remarks ?? "");
                          setPdfName(fresh.vendorPdfName ?? "");
                        }
                        setVerified(true);
                        toast.success("確認できました");
                      }}
                    >
                      確認する
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">
                業者マスタにメールがないため、メール認証できません。届いた請求書は発注元の検収完了一覧からPDF添付してください。
              </p>
            )}
          </div>
        )}

        {!needsAuth && <div className="rounded-2xl bg-white shadow-sm border overflow-hidden">
          <div className="bg-emerald-50 text-emerald-900 px-5 py-3 text-sm flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            {invoice.submitted
              ? "請求書を受領しました。発注元での確認をお待ちください。"
              : "検収が完了しています。内容を確認し、請求日・請求番号・登録番号を入力して「請求書を送る」を押してください。"}
          </div>

          <div className="p-7 space-y-6">
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
                  <div>
                    <Input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      disabled={locked}
                      className={vendorInput}
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5 text-right">貴社で入力</p>
                  </div>
                </div>
                <div className="grid grid-cols-[72px_1fr] items-center gap-2">
                  <span className="text-muted-foreground">請求番号</span>
                  <div>
                    <Input
                      value={invoiceNo}
                      onChange={(e) => setInvoiceNo(e.target.value)}
                      placeholder="任意"
                      disabled={locked}
                      className={vendorInput}
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5 text-right">貴社で入力（任意）</p>
                  </div>
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
                    <div>
                      <Input
                        value={regNo}
                        onChange={(e) => setRegNo(e.target.value)}
                        placeholder="T1234567890123"
                        disabled={locked}
                        className={vendorInput}
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5 text-right">貴社で入力</p>
                    </div>
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
                <p className="text-[10px] text-muted-foreground mt-0.5">納品記録から自動。変更不可</p>
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
                {invoice.bankAccountKana && (
                  <p>口座名義 {invoice.bankAccountKana}</p>
                )}
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

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-xs font-semibold">備考</p>
                <Textarea
                  rows={4}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="担当者への連絡事項があればご記入ください"
                  disabled={locked}
                  className="bg-white"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold">貴社書式の請求書PDF</p>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); if (!locked) setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (!locked) pickFile(e.dataTransfer.files?.[0] ?? null);
                  }}
                  className={`w-full min-h-[120px] rounded-lg border border-dashed px-4 py-6 text-center transition-colors ${
                    dragOver ? "border-emerald-500 bg-emerald-50" : "border-slate-300 bg-[#FAFBFC]"
                  } ${locked ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-slate-50"}`}
                >
                  <Upload className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm">{pdfName || "ここにドロップ、またはクリックして選択"}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">PDFまたは画像 / 10MBまで</p>
                </button>
                <p className="text-[11px] text-muted-foreground">
                  アップロードしたファイルを正式な請求書として扱います。
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  disabled={locked}
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
          </div>

          <div className="px-7 py-4 border-t flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-red-600">金額や内容に相違がある場合は、発注元の担当者へご連絡ください。</p>
            <Button
              className="bg-emerald-700 hover:bg-emerald-800 min-w-40"
              disabled={saving || locked}
              onClick={send}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {invoice.submitted ? "送信済み" : "請求書を送る"}
            </Button>
          </div>
        </div>}
      </div>
    </div>
  );
}
