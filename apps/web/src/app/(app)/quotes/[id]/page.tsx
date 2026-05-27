"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Copy, FileDown } from "lucide-react";
import { getEstimate, copyEstimate } from "@/lib/actions/estimates";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EstimateDetailView, type EstimateForView } from "@/components/estimate/estimate-detail-view";

type EstimateDetail = Awaited<ReturnType<typeof getEstimate>>;

export default function QuoteDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<EstimateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (id) {
      getEstimate(id as string)
        .then(setData)
        .catch(() => { /* 失敗時は data が null のまま */ })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Link
          href="/quotes"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />戻る
        </Link>
        <p className="mt-4 text-muted-foreground">見つかりません</p>
      </div>
    );
  }

  const handleCopy = async () => {
    setCopying(true);
    try {
      const copy = await copyEstimate(id as string);
      toast.success("この見積をもとに新規見積を作成しました");
      router.push(`/quotes/${copy.id}`);
    } catch {
      toast.error("コピーに失敗");
    } finally {
      setCopying(false);
    }
  };

  const backHref = data.customer_id ? `/quotes?customer=${data.customer_id}` : "/quotes";

  return (
    <div className="p-4 md:p-8 space-y-4">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />見積一覧
      </Link>
      <div className="text-xs text-muted-foreground">
        顧客: <span className="text-foreground">{data.customer?.name ?? "-"}</span>
      </div>

      <EstimateDetailView
        estimate={data as unknown as EstimateForView}
        onEstimateChange={(est) => setData((prev) => ({ ...(prev as EstimateDetail), ...(est as unknown as EstimateDetail) }))}
        headerExtra={
          <>
            <Button variant="outline" size="sm" onClick={() => setPdfOpen(true)}>
              <FileDown className="h-4 w-4 mr-1" />PDFプレビュー
            </Button>
            <Button variant="outline" size="sm" disabled={copying} onClick={() => void handleCopy()}>
              <Copy className="h-4 w-4 mr-1" />{copying ? "作成中..." : "コピー"}
            </Button>
          </>
        }
      />

      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="max-w-[680px] p-0 gap-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-slate-100 border-b">
            <DialogTitle className="text-xs font-semibold text-slate-600">
              見積書プレビュー — {data.estimate_no}
            </DialogTitle>
            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => window.print()}>
              <FileDown className="h-3.5 w-3.5" />印刷 / PDF保存
            </Button>
          </div>

          <div className="overflow-y-auto max-h-[85vh] bg-slate-200 py-6 px-4 flex justify-center">
            <div
              id="quote-print-area"
              className="bg-white shadow-lg text-slate-900 font-sans"
              style={{ width: "595px", minHeight: "842px", padding: "48px 52px", fontSize: "11px", lineHeight: "1.5", flexShrink: 0 }}
            >
              <div className="space-y-5">
                <div className="text-center pb-2 border-b-2 border-slate-900">
                  <h1 style={{ fontSize: "20px", fontWeight: "bold", letterSpacing: "0.25em" }}>見　積　書</h1>
                </div>

                <div className="flex justify-between items-start gap-4">
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "13px", fontWeight: "bold", borderBottom: "1px solid #0f172a", paddingBottom: "4px", marginBottom: "6px" }}>
                      {data.customer?.company_name ?? data.customer?.name ?? "　"} 御中
                    </p>
                    <p style={{ color: "#475569" }}>件名: {data.title ?? "—"}</p>
                    <div className="mt-4 border border-slate-300 px-4 py-2 bg-slate-50 flex justify-between items-center">
                      <span style={{ fontWeight: 600 }}>お見積金額（税込）</span>
                      <span style={{ fontSize: "16px", fontWeight: "bold", fontVariantNumeric: "tabular-nums" }}>
                        ¥{(data.total ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", color: "#475569", minWidth: "180px" }}>
                    <p>発行日: {new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}</p>
                    <p>見積番号: {data.estimate_no}</p>
                    <p>有効期限: 発行日より30日間</p>
                    <div style={{ marginTop: "12px", textAlign: "right" }}>
                      <p style={{ fontWeight: "bold", color: "#0f172a" }}>株式会社 ○○建設</p>
                      <p>〒000-0000 東京都○○区○○1-2-3</p>
                      <p>TEL: 03-0000-0000</p>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                        {["担当", "確認", "承認"].map((label) => (
                          <div key={label} style={{ border: "1px solid #cbd5e1", width: "44px", height: "44px", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: "2px", fontSize: "9px", color: "#94a3b8" }}>{label}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={{ border: "1px solid #cbd5e1", textAlign: "left", padding: "5px 8px" }}>品名</th>
                      <th style={{ border: "1px solid #cbd5e1", textAlign: "right", padding: "5px 8px", width: "48px" }}>数量</th>
                      <th style={{ border: "1px solid #cbd5e1", textAlign: "center", padding: "5px 8px", width: "36px" }}>単位</th>
                      <th style={{ border: "1px solid #cbd5e1", textAlign: "right", padding: "5px 8px", width: "90px" }}>単価</th>
                      <th style={{ border: "1px solid #cbd5e1", textAlign: "right", padding: "5px 8px", width: "90px" }}>金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.categories ?? []).length > 0
                      ? (data.categories ?? []).flatMap((cat) => [
                          <tr key={`cat-${cat.id}`} style={{ background: "#f8fafc" }}>
                            <td colSpan={5} style={{ border: "1px solid #cbd5e1", padding: "4px 8px", fontWeight: 600, color: "#334155" }}>{cat.name}</td>
                          </tr>,
                          ...data.items.filter((i) => i.category_id === cat.id).map((item) => (
                            <tr key={item.id}>
                              <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px" }}>{item.name}</td>
                              <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{item.quantity}</td>
                              <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "center" }}>{item.unit ?? "式"}</td>
                              <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>¥{(item.selling_price ?? 0).toLocaleString()}</td>
                              <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>¥{(item.selling_amount ?? 0).toLocaleString()}</td>
                            </tr>
                          )),
                        ])
                      : data.items.map((item) => (
                          <tr key={item.id}>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px" }}>{item.name}</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{item.quantity}</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "center" }}>{item.unit ?? "式"}</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>¥{(item.selling_price ?? 0).toLocaleString()}</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>¥{(item.selling_amount ?? 0).toLocaleString()}</td>
                          </tr>
                        ))}
                    {Array.from({ length: Math.max(0, 8 - data.items.length) }).map((_, i) => (
                      <tr key={`empty-${i}`}>
                        <td colSpan={5} style={{ border: "1px solid #cbd5e1", padding: "10px" }}>&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "right" }}>小計</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>¥{(data.subtotal ?? 0).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td colSpan={4} style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "right" }}>消費税（10%）</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>¥{(data.tax ?? 0).toLocaleString()}</td>
                    </tr>
                    <tr style={{ background: "#f1f5f9", fontWeight: "bold" }}>
                      <td colSpan={4} style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "right" }}>合計（税込）</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>¥{(data.total ?? 0).toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>

                <div style={{ border: "1px solid #cbd5e1", padding: "8px 10px" }}>
                  <p style={{ fontWeight: 600, marginBottom: "4px", color: "#475569" }}>備考</p>
                  <p style={{ color: "#334155", whiteSpace: "pre-wrap" }}>{data.notes || "　"}</p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
