"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FileDown, X } from "lucide-react";

export type EstimatePdfMode = "customer" | "cost_breakdown";

export type EstimatePdfPreviewData = {
  mode: EstimatePdfMode;
  estimate_no?: string;
  title?: string | null;
  customer_name?: string | null;
  customer_company_name?: string | null;
  notes?: string | null;
  subtotal: number;
  tax: number;
  total: number;
  cost_total: number;
  reserve_fee_1_amount: number;
  reserve_fee_2_amount: number;
  categories: Array<{ id: string; name: string }>;
  items: Array<{
    id: string;
    category_id?: string | null;
    name: string;
    quantity: number;
    unit?: string | null;
    cost_price: number;
    cost_amount: number;
    selling_price: number;
    selling_amount: number;
    is_text_row?: boolean;
  }>;
};

type EstimatePdfSource = {
  estimate_no?: string;
  title?: string | null;
  notes?: string | null;
  subtotal?: number;
  tax?: number;
  total?: number;
  cost_total?: number;
  reserve_fee_1_amount?: number | null;
  reserve_fee_2_amount?: number | null;
  categories?: Array<{ id: string; name: string }>;
  items?: Array<{
    id: string;
    category_id?: string | null;
    name: string;
    quantity?: number;
    unit?: string | null;
    cost_price?: number;
    cost_amount?: number;
    selling_price?: number;
    selling_amount?: number;
    is_text_row?: boolean;
  }>;
};

/** 顧客向け見積書用（売価0・テキスト行・予備費は出さない） */
export function toEstimatePdfPreviewData(
  estimate: EstimatePdfSource,
  customer?: { name?: string | null; company_name?: string | null } | null,
): EstimatePdfPreviewData {
  return toEstimatePdfData(estimate, customer, "customer");
}

/** 社内向け原価内訳書用（売価0行・テキスト行・予備費を含む） */
export function toCostBreakdownPdfPreviewData(
  estimate: EstimatePdfSource,
  customer?: { name?: string | null; company_name?: string | null } | null,
): EstimatePdfPreviewData {
  return toEstimatePdfData(estimate, customer, "cost_breakdown");
}

function toEstimatePdfData(
  estimate: EstimatePdfSource,
  customer: { name?: string | null; company_name?: string | null } | null | undefined,
  mode: EstimatePdfMode,
): EstimatePdfPreviewData {
  const items = (estimate.items ?? [])
    .filter((item) => {
      if (mode === "customer") {
        const sell = Number(item.selling_amount) || 0;
        const isText = Boolean(item.is_text_row);
        return !isText && sell > 0;
      }
      // 原価内訳: テキスト行も出し、売価0の計算行も含める
      return true;
    })
    .map((item) => ({
      id: item.id,
      category_id: item.category_id,
      name: item.name,
      quantity: Number(item.quantity) || 0,
      unit: item.unit,
      cost_price: Number(item.cost_price) || 0,
      cost_amount: Number(item.cost_amount) || 0,
      selling_price: Number(item.selling_price) || 0,
      selling_amount: Number(item.selling_amount) || 0,
      is_text_row: Boolean(item.is_text_row),
    }));

  const lineCost = items
    .filter((i) => !i.is_text_row)
    .reduce((s, i) => s + i.cost_amount, 0);
  const reserve1 = Number(estimate.reserve_fee_1_amount) || 0;
  const reserve2 = Number(estimate.reserve_fee_2_amount) || 0;

  return {
    mode,
    estimate_no: estimate.estimate_no,
    title: estimate.title,
    customer_name: customer?.name ?? null,
    customer_company_name: customer?.company_name ?? null,
    notes: estimate.notes,
    subtotal: estimate.subtotal ?? 0,
    tax: estimate.tax ?? 0,
    total: estimate.total ?? 0,
    cost_total: estimate.cost_total ?? lineCost + reserve1 + reserve2,
    reserve_fee_1_amount: reserve1,
    reserve_fee_2_amount: reserve2,
    categories: (estimate.categories ?? []).map((cat) => ({ id: cat.id, name: cat.name })),
    items,
  };
}

type EstimatePdfPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: EstimatePdfPreviewData;
};

export function EstimatePdfPreviewDialog({ open, onOpenChange, data }: EstimatePdfPreviewDialogProps) {
  const isCost = data.mode === "cost_breakdown";
  const title = isCost ? "原価内訳書" : "見　積　書";
  const previewLabel = isCost ? "原価内訳書プレビュー" : "見積書プレビュー";
  const itemCount = data.items.length + (isCost ? 2 : 0);

  // 画面プレビューは横幅を広めに。印刷時は mode に応じて幅を調整
  const dialogMaxW = "sm:max-w-[960px]";
  const paperMaxW = "max-w-[900px]";
  const paperFontSize = isCost ? "13px" : "12px";
  const paperPadding = "40px 44px";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`w-full max-w-[97vw] ${dialogMaxW} p-0 gap-0 overflow-hidden`}
        showCloseButton={false}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3 bg-slate-100 border-b">
          <DialogTitle className="text-xs font-semibold text-slate-600 min-w-0 truncate">
            {previewLabel} — {data.estimate_no ?? "下書き"}
          </DialogTitle>
          <div className="flex items-center gap-2 shrink-0">
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

        <div className="overflow-y-auto max-h-[90vh] bg-slate-200 py-6 px-4 flex justify-center w-full">
          <div
            id="quote-print-area"
            data-pdf-mode={data.mode}
            className={`bg-white shadow-lg text-slate-900 font-sans w-full ${paperMaxW} min-h-[842px] box-border`}
            style={{ padding: paperPadding, fontSize: paperFontSize, lineHeight: "1.55" }}
          >
            <div className="space-y-5">
              <div className="text-center pb-2 border-b-2 border-slate-900">
                <h1 style={{ fontSize: "20px", fontWeight: "bold", letterSpacing: "0.25em" }}>{title}</h1>
                {isCost && (
                  <p style={{ fontSize: "10px", color: "#64748b", marginTop: "4px" }}>社内用（顧客提出不可）</p>
                )}
              </div>

              <div className="flex justify-between items-start gap-4">
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "13px", fontWeight: "bold", borderBottom: "1px solid #0f172a", paddingBottom: "4px", marginBottom: "6px" }}>
                    {data.customer_company_name ?? data.customer_name ?? "　"} 御中
                  </p>
                  <p style={{ color: "#475569" }}>件名: {data.title ?? "—"}</p>
                  <div className="mt-4 border border-slate-300 px-4 py-2 bg-slate-50 flex justify-between items-center">
                    <span style={{ fontWeight: 600 }}>
                      {isCost ? "原価合計" : "お見積金額（税込）"}
                    </span>
                    <span style={{ fontSize: "16px", fontWeight: "bold", fontVariantNumeric: "tabular-nums" }}>
                      ¥{(isCost ? data.cost_total : data.total).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: "right", color: "#475569", minWidth: "180px" }}>
                  <p>発行日: {new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}</p>
                  <p>見積番号: {data.estimate_no ?? "—"}</p>
                  {!isCost && <p>有効期限: 発行日より30日間</p>}
                </div>
              </div>

              {isCost ? (
                <CostBreakdownTable data={data} itemCount={itemCount} />
              ) : (
                <CustomerEstimateTable data={data} itemCount={itemCount} />
              )}

              <div style={{ border: "1px solid #cbd5e1", padding: "8px 10px" }}>
                <p style={{ fontWeight: 600, marginBottom: "4px", color: "#475569" }}>備考</p>
                <p style={{ color: "#334155", whiteSpace: "pre-wrap" }}>{data.notes || "　"}</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
      <style jsx global>{`
        @media print {
          #quote-print-area {
            width: 900px !important;
            max-width: none !important;
            min-height: 842px !important;
          }
        }
      `}</style>
    </Dialog>
  );
}

function CustomerEstimateTable({ data, itemCount }: { data: EstimatePdfPreviewData; itemCount: number }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
      <thead>
        <tr style={{ background: "#f1f5f9" }}>
          <th style={{ border: "1px solid #cbd5e1", textAlign: "left", padding: "8px 10px" }}>品名</th>
          <th style={{ border: "1px solid #cbd5e1", textAlign: "right", padding: "8px 10px", width: "64px" }}>数量</th>
          <th style={{ border: "1px solid #cbd5e1", textAlign: "center", padding: "8px 10px", width: "52px" }}>単位</th>
          <th style={{ border: "1px solid #cbd5e1", textAlign: "right", padding: "8px 10px", width: "120px" }}>単価</th>
          <th style={{ border: "1px solid #cbd5e1", textAlign: "right", padding: "8px 10px", width: "120px" }}>金額</th>
        </tr>
      </thead>
      <tbody>
        {data.categories.length > 0
          ? data.categories.flatMap((cat) => [
              <tr key={`cat-${cat.id}`} style={{ background: "#f8fafc" }}>
                <td colSpan={5} style={{ border: "1px solid #cbd5e1", padding: "7px 10px", fontWeight: 600, color: "#334155" }}>{cat.name}</td>
              </tr>,
              ...data.items.filter((i) => i.category_id === cat.id).map((item) => (
                <tr key={item.id}>
                  <td style={{ border: "1px solid #cbd5e1", padding: "7px 10px" }}>{item.name || "—"}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: "7px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{item.quantity}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: "7px 10px", textAlign: "center" }}>{item.unit ?? "式"}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: "7px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>¥{item.selling_price.toLocaleString()}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: "7px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>¥{item.selling_amount.toLocaleString()}</td>
                </tr>
              )),
            ])
          : data.items.map((item) => (
              <tr key={item.id}>
                <td style={{ border: "1px solid #cbd5e1", padding: "7px 10px" }}>{item.name || "—"}</td>
                <td style={{ border: "1px solid #cbd5e1", padding: "7px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{item.quantity}</td>
                <td style={{ border: "1px solid #cbd5e1", padding: "7px 10px", textAlign: "center" }}>{item.unit ?? "式"}</td>
                <td style={{ border: "1px solid #cbd5e1", padding: "7px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>¥{item.selling_price.toLocaleString()}</td>
                <td style={{ border: "1px solid #cbd5e1", padding: "7px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>¥{item.selling_amount.toLocaleString()}</td>
              </tr>
            ))}
        {Array.from({ length: Math.max(0, 8 - itemCount) }).map((_, i) => (
          <tr key={`empty-${i}`}>
            <td colSpan={5} style={{ border: "1px solid #cbd5e1", padding: "12px" }}>&nbsp;</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={4} style={{ border: "1px solid #cbd5e1", padding: "7px 10px", textAlign: "right" }}>小計</td>
          <td style={{ border: "1px solid #cbd5e1", padding: "7px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>¥{data.subtotal.toLocaleString()}</td>
        </tr>
        <tr>
          <td colSpan={4} style={{ border: "1px solid #cbd5e1", padding: "7px 10px", textAlign: "right" }}>消費税（10%）</td>
          <td style={{ border: "1px solid #cbd5e1", padding: "7px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>¥{data.tax.toLocaleString()}</td>
        </tr>
        <tr style={{ background: "#f1f5f9", fontWeight: "bold" }}>
          <td colSpan={4} style={{ border: "1px solid #cbd5e1", padding: "8px 10px", textAlign: "right" }}>合計（税込）</td>
          <td style={{ border: "1px solid #cbd5e1", padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>¥{data.total.toLocaleString()}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function CostBreakdownTable({ data, itemCount }: { data: EstimatePdfPreviewData; itemCount: number }) {
  const renderItemRow = (item: EstimatePdfPreviewData["items"][number]) => {
    if (item.is_text_row) {
      return (
        <tr key={item.id} style={{ background: "#fffbeb" }}>
          <td colSpan={5} style={{ border: "1px solid #cbd5e1", padding: "7px 10px", color: "#78716c", fontStyle: "italic" }}>
            {item.name || "—"}
          </td>
        </tr>
      );
    }
    return (
      <tr key={item.id}>
        <td style={{ border: "1px solid #cbd5e1", padding: "7px 10px" }}>{item.name || "—"}</td>
        <td style={{ border: "1px solid #cbd5e1", padding: "7px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{item.quantity || "—"}</td>
        <td style={{ border: "1px solid #cbd5e1", padding: "7px 10px", textAlign: "center" }}>
          {item.selling_amount === 0 && item.cost_amount > 0 ? "小計" : (item.unit ?? "式")}
        </td>
        <td style={{ border: "1px solid #cbd5e1", padding: "7px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
          {item.selling_amount === 0 && item.cost_amount > 0 ? "—" : `¥${item.cost_price.toLocaleString()}`}
        </td>
        <td style={{ border: "1px solid #cbd5e1", padding: "7px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
          ¥{item.cost_amount.toLocaleString()}
        </td>
      </tr>
    );
  };

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
      <thead>
        <tr style={{ background: "#f1f5f9" }}>
          <th style={{ border: "1px solid #cbd5e1", textAlign: "left", padding: "8px 10px" }}>品名</th>
          <th style={{ border: "1px solid #cbd5e1", textAlign: "right", padding: "8px 10px", width: "64px" }}>数量</th>
          <th style={{ border: "1px solid #cbd5e1", textAlign: "center", padding: "8px 10px", width: "52px" }}>単位</th>
          <th style={{ border: "1px solid #cbd5e1", textAlign: "right", padding: "8px 10px", width: "120px" }}>原単価</th>
          <th style={{ border: "1px solid #cbd5e1", textAlign: "right", padding: "8px 10px", width: "120px" }}>原価</th>
        </tr>
      </thead>
      <tbody>
        {data.categories.length > 0
          ? data.categories.flatMap((cat) => [
              <tr key={`cat-${cat.id}`} style={{ background: "#f8fafc" }}>
                <td colSpan={5} style={{ border: "1px solid #cbd5e1", padding: "7px 10px", fontWeight: 600, color: "#334155" }}>{cat.name}</td>
              </tr>,
              ...data.items.filter((i) => i.category_id === cat.id).map(renderItemRow),
            ])
          : data.items.map(renderItemRow)}
        {/* 明細外予備費（原価内訳書にのみ出力） */}
        <tr style={{ background: "#fff7ed" }}>
          <td style={{ border: "1px solid #cbd5e1", padding: "7px 10px" }}>予備費（会社確保分）</td>
          <td style={{ border: "1px solid #cbd5e1", padding: "7px 10px", textAlign: "right" }}>—</td>
          <td style={{ border: "1px solid #cbd5e1", padding: "7px 10px", textAlign: "center" }}>小計</td>
          <td style={{ border: "1px solid #cbd5e1", padding: "7px 10px", textAlign: "right" }}>—</td>
          <td style={{ border: "1px solid #cbd5e1", padding: "7px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
            ¥{data.reserve_fee_1_amount.toLocaleString()}
          </td>
        </tr>
        <tr style={{ background: "#fffbeb" }}>
          <td style={{ border: "1px solid #cbd5e1", padding: "7px 10px" }}>予備予備費（現場対応分）</td>
          <td style={{ border: "1px solid #cbd5e1", padding: "7px 10px", textAlign: "right" }}>—</td>
          <td style={{ border: "1px solid #cbd5e1", padding: "7px 10px", textAlign: "center" }}>小計</td>
          <td style={{ border: "1px solid #cbd5e1", padding: "7px 10px", textAlign: "right" }}>—</td>
          <td style={{ border: "1px solid #cbd5e1", padding: "7px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
            ¥{data.reserve_fee_2_amount.toLocaleString()}
          </td>
        </tr>
        {Array.from({ length: Math.max(0, 6 - itemCount) }).map((_, i) => (
          <tr key={`empty-${i}`}>
            <td colSpan={5} style={{ border: "1px solid #cbd5e1", padding: "10px" }}>&nbsp;</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr style={{ background: "#f1f5f9", fontWeight: "bold" }}>
          <td colSpan={4} style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "right" }}>原価合計</td>
          <td style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
            ¥{data.cost_total.toLocaleString()}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
