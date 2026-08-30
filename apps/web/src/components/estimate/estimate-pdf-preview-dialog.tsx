"use client";

import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FileDown, X } from "lucide-react";
import { effectiveCategoryAmounts } from "@/lib/estimate-category-totals";

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
  /** 経営調整費（会社確保分・旧予備費） */
  reserve_fee_1_amount: number;
  /** 予備費（現場対応分・旧予備予備費） */
  reserve_fee_2_amount: number;
  categories: Array<{
    id: string;
    name: string;
    /** 大項目直接入力の数量・単位・単価（詳細行が無いときに印字） */
    quantity: number;
    unit?: string | null;
    cost_price: number;
    selling_price: number;
    /** 有効金額（詳細行があれば詳細合計、無ければ直接入力） */
    cost_amount: number;
    selling_amount: number;
    /** 直接入力値を印字に使うか（詳細行なし） */
    use_direct: boolean;
  }>;
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
    is_reserve_row?: boolean;
    /** 発注業者表示名（予備費／経営調整費ラベル用） */
    vendor_name?: string | null;
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
  categories?: Array<{
    id: string;
    name: string;
    quantity?: number | null;
    unit?: string | null;
    cost_price?: number | null;
    selling_price?: number | null;
  }>;
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
    is_reserve_row?: boolean;
    vendor_name?: string | null;
  }>;
};

/** 顧客向け見積書用（売価0行・予備費行は出さない。テキスト行は印字する・No.62） */
export function toEstimatePdfPreviewData(
  estimate: EstimatePdfSource,
  customer?: { name?: string | null; company_name?: string | null } | null,
): EstimatePdfPreviewData {
  return toEstimatePdfData(estimate, customer, "customer");
}

/** 社内向け原価内訳書用（売価0行・テキスト行・経営調整費・予備費を含む） */
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
  const sourceItems = estimate.items ?? [];
  const items = sourceItems
    .filter((item) => {
      if (mode === "customer") {
        // 予備費行は顧客向けに出さない（No.61/65）
        if (item.is_reserve_row) return false;
        // テキスト行は顧客向けにも印字（No.62）
        if (item.is_text_row) return true;
        const sell = Number(item.selling_amount) || 0;
        return sell > 0;
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
      is_reserve_row: Boolean(item.is_reserve_row),
      vendor_name: item.vendor_name ?? null,
    }));

  // 大項目の有効金額（詳細行優先・No.68/70）はフィルタ前の全明細から算出する
  const categories = (estimate.categories ?? []).map((cat) => {
    const catItems = sourceItems.filter((i) => i.category_id === cat.id);
    const eff = effectiveCategoryAmounts(cat, catItems);
    const hasDetailAmounts = catItems.some(
      (i) => !i.is_text_row && ((Number(i.cost_amount) || 0) > 0 || (Number(i.selling_amount) || 0) > 0),
    );
    return {
      id: cat.id,
      name: cat.name,
      quantity: Number(cat.quantity ?? 0) || 0,
      unit: cat.unit,
      cost_price: Number(cat.cost_price ?? 0) || 0,
      selling_price: Number(cat.selling_price ?? 0) || 0,
      cost_amount: eff.cost_amount,
      selling_amount: eff.selling_amount,
      use_direct: !hasDetailAmounts,
    };
  });

  const lineCost = categories.reduce((s, c) => s + c.cost_amount, 0)
    + items
      .filter((i) => !i.is_text_row && !i.category_id)
      .reduce((s, i) => s + i.cost_amount, 0);

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
    // No.106: 経営調整費・予備費は明細原価に含まれる
    cost_total: estimate.cost_total ?? lineCost,
    reserve_fee_1_amount: Number(estimate.reserve_fee_1_amount) || 0,
    reserve_fee_2_amount: Number(estimate.reserve_fee_2_amount) || 0,
    categories,
    items,
  };
}

type EstimatePdfPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: EstimatePdfPreviewData;
};

const nameCell: CSSProperties = {
  border: "1px solid #cbd5e1",
  padding: "7px 10px",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};
const numCell: CSSProperties = {
  border: "1px solid #cbd5e1",
  padding: "7px 10px",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};
const unitCell: CSSProperties = {
  border: "1px solid #cbd5e1",
  padding: "7px 10px",
  textAlign: "center",
  whiteSpace: "nowrap",
};

export function EstimatePdfPreviewDialog({ open, onOpenChange, data }: EstimatePdfPreviewDialogProps) {
  const isCost = data.mode === "cost_breakdown";
  const title = isCost ? "原価内訳書" : "見　積　書";
  const previewLabel = isCost ? "原価内訳書プレビュー" : "見積書プレビュー";
  const itemCount = data.items.length + (isCost ? 2 : 0);
  const paperFontSize = isCost ? "13px" : "12px";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col gap-0 p-0 overflow-hidden max-h-[92vh] w-[min(calc(100%-1.5rem),calc(210mm+4rem))] max-w-[min(calc(100%-1.5rem),calc(210mm+4rem))] sm:max-w-[min(calc(100%-1.5rem),calc(210mm+4rem))]"
        showCloseButton={false}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3 bg-slate-100 border-b shrink-0">
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

        <div className="min-h-0 flex-1 overflow-auto bg-slate-200 py-6 px-4">
          <div
            id="quote-print-area"
            data-pdf-mode={data.mode}
            className="bg-white shadow-lg text-slate-900 font-sans mx-auto w-full max-w-[210mm] min-h-[297mm] box-border"
            style={{ padding: "16mm 18mm", fontSize: paperFontSize, lineHeight: "1.55" }}
          >
            <div className="space-y-5">
              <div className="text-center pb-2 border-b-2 border-slate-900">
                <h1 style={{ fontSize: "20px", fontWeight: "bold", letterSpacing: "0.25em" }}>{title}</h1>
                {isCost && (
                  <p style={{ fontSize: "10px", color: "#64748b", marginTop: "4px" }}>社内用（顧客提出不可）</p>
                )}
              </div>

              <div className="flex justify-between items-start gap-4 min-w-0">
                <div className="min-w-0" style={{ flex: 1 }}>
                  <p style={{ fontSize: "13px", fontWeight: "bold", borderBottom: "1px solid #0f172a", paddingBottom: "4px", marginBottom: "6px", overflowWrap: "anywhere" }}>
                    {data.customer_company_name ?? data.customer_name ?? "　"} 御中
                  </p>
                  <p style={{ color: "#475569", overflowWrap: "anywhere" }}>件名: {data.title ?? "—"}</p>
                  <div className="mt-4 border border-slate-300 px-4 py-2 bg-slate-50 flex justify-between items-center gap-3 min-w-0">
                    <span style={{ fontWeight: 600 }}>
                      {isCost ? "原価合計" : "お見積金額（税込）"}
                    </span>
                    <span style={{ fontSize: "16px", fontWeight: "bold", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      ¥{(isCost ? data.cost_total : data.total).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="shrink-0" style={{ textAlign: "right", color: "#475569" }}>
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
                <p style={{ color: "#334155", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{data.notes || "　"}</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
      <style jsx global>{`
        @page {
          size: A4;
          margin: 12mm;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          #quote-print-area,
          #quote-print-area * {
            visibility: visible;
          }
          #quote-print-area {
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
    </Dialog>
  );
}

function CustomerEstimateTable({ data, itemCount }: { data: EstimatePdfPreviewData; itemCount: number }) {
  // テキスト行は注釈として全幅で印字（No.62）
  const renderItemRow = (item: EstimatePdfPreviewData["items"][number]) => {
    if (item.is_text_row) {
      return (
        <tr key={item.id}>
          <td colSpan={5} style={{ ...nameCell, color: "#64748b", fontStyle: "italic" }}>
            {item.name || "—"}
          </td>
        </tr>
      );
    }
    return (
      <tr key={item.id}>
        <td style={nameCell}>{item.name || "—"}</td>
        <td style={numCell}>{item.quantity}</td>
        <td style={unitCell}>{item.unit ?? "式"}</td>
        <td style={numCell}>¥{item.selling_price.toLocaleString()}</td>
        <td style={numCell}>¥{item.selling_amount.toLocaleString()}</td>
      </tr>
    );
  };

  // 大項目直接入力（詳細行が無い場合）の金額を大項目行に印字（No.70）
  const renderCategoryRow = (cat: EstimatePdfPreviewData["categories"][number]) => {
    if (cat.use_direct && cat.selling_amount > 0) {
      return (
        <tr key={`cat-${cat.id}`} style={{ background: "#f8fafc" }}>
          <td style={{ ...nameCell, fontWeight: 600, color: "#334155" }}>{cat.name}</td>
          <td style={numCell}>{cat.quantity}</td>
          <td style={unitCell}>{cat.unit ?? "式"}</td>
          <td style={numCell}>¥{cat.selling_price.toLocaleString()}</td>
          <td style={numCell}>¥{cat.selling_amount.toLocaleString()}</td>
        </tr>
      );
    }
    return (
      <tr key={`cat-${cat.id}`} style={{ background: "#f8fafc" }}>
        <td colSpan={5} style={{ ...nameCell, fontWeight: 600, color: "#334155" }}>{cat.name}</td>
      </tr>
    );
  };

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: "12px" }}>
      <colgroup>
        <col />
        <col style={{ width: "64px" }} />
        <col style={{ width: "52px" }} />
        <col style={{ width: "22%" }} />
        <col style={{ width: "22%" }} />
      </colgroup>
      <thead>
        <tr style={{ background: "#f1f5f9" }}>
          <th style={{ border: "1px solid #cbd5e1", textAlign: "left", padding: "8px 10px" }}>品名</th>
          <th style={{ border: "1px solid #cbd5e1", textAlign: "right", padding: "8px 10px" }}>数量</th>
          <th style={{ border: "1px solid #cbd5e1", textAlign: "center", padding: "8px 10px" }}>単位</th>
          <th style={{ border: "1px solid #cbd5e1", textAlign: "right", padding: "8px 10px" }}>単価</th>
          <th style={{ border: "1px solid #cbd5e1", textAlign: "right", padding: "8px 10px" }}>金額</th>
        </tr>
      </thead>
      <tbody>
        {data.categories.length > 0
          ? [
              ...data.categories.flatMap((cat) => [
                renderCategoryRow(cat),
                ...data.items.filter((i) => i.category_id === cat.id).map(renderItemRow),
              ]),
              // 独立テキスト行など未分類の行
              ...data.items.filter((i) => !i.category_id).map(renderItemRow),
            ]
          : data.items.map(renderItemRow)}
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
          <td colSpan={5} style={{ ...nameCell, color: "#78716c", fontStyle: "italic" }}>
            {item.name || "—"}
          </td>
        </tr>
      );
    }
    return (
      <tr key={item.id} style={item.is_reserve_row ? { background: "#fffbeb" } : undefined}>
        <td style={nameCell}>
          {item.is_reserve_row && (
            <span
              style={{
                display: "inline-block",
                marginRight: "6px",
                padding: "0 5px",
                fontSize: "10px",
                fontWeight: 600,
                color: "#b45309",
                background: "#fef3c7",
                border: "1px solid #fcd34d",
                borderRadius: "3px",
                verticalAlign: "middle",
              }}
            >
              {item.vendor_name === "経営調整費" ? "経営調整費" : "予備費"}
            </span>
          )}
          {item.name || "—"}
        </td>
        <td style={numCell}>{item.quantity || "—"}</td>
        <td style={unitCell}>
          {item.selling_amount === 0 && item.cost_amount > 0 ? "小計" : (item.unit ?? "式")}
        </td>
        <td style={numCell}>
          {item.selling_amount === 0 && item.cost_amount > 0 ? "—" : `¥${item.cost_price.toLocaleString()}`}
        </td>
        <td style={numCell}>
          ¥{item.cost_amount.toLocaleString()}
        </td>
      </tr>
    );
  };

  // 大項目直接入力（詳細行が無い場合）の原価を大項目行に印字（No.70）
  const renderCategoryRow = (cat: EstimatePdfPreviewData["categories"][number]) => {
    if (cat.use_direct && cat.cost_amount > 0) {
      return (
        <tr key={`cat-${cat.id}`} style={{ background: "#f8fafc" }}>
          <td style={{ ...nameCell, fontWeight: 600, color: "#334155" }}>{cat.name}</td>
          <td style={numCell}>{cat.quantity || "—"}</td>
          <td style={unitCell}>{cat.unit ?? "式"}</td>
          <td style={numCell}>¥{cat.cost_price.toLocaleString()}</td>
          <td style={numCell}>¥{cat.cost_amount.toLocaleString()}</td>
        </tr>
      );
    }
    return (
      <tr key={`cat-${cat.id}`} style={{ background: "#f8fafc" }}>
        <td colSpan={5} style={{ ...nameCell, fontWeight: 600, color: "#334155" }}>{cat.name}</td>
      </tr>
    );
  };

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: "12px" }}>
      <colgroup>
        <col />
        <col style={{ width: "64px" }} />
        <col style={{ width: "52px" }} />
        <col style={{ width: "22%" }} />
        <col style={{ width: "22%" }} />
      </colgroup>
      <thead>
        <tr style={{ background: "#f1f5f9" }}>
          <th style={{ border: "1px solid #cbd5e1", textAlign: "left", padding: "8px 10px" }}>品名</th>
          <th style={{ border: "1px solid #cbd5e1", textAlign: "right", padding: "8px 10px" }}>数量</th>
          <th style={{ border: "1px solid #cbd5e1", textAlign: "center", padding: "8px 10px" }}>単位</th>
          <th style={{ border: "1px solid #cbd5e1", textAlign: "right", padding: "8px 10px" }}>原単価</th>
          <th style={{ border: "1px solid #cbd5e1", textAlign: "right", padding: "8px 10px" }}>原価</th>
        </tr>
      </thead>
      <tbody>
        {data.categories.length > 0
          ? [
              ...data.categories.flatMap((cat) => [
                renderCategoryRow(cat),
                ...data.items.filter((i) => i.category_id === cat.id).map(renderItemRow),
              ]),
              ...data.items.filter((i) => !i.category_id).map(renderItemRow),
            ]
          : data.items.map(renderItemRow)}
        {/* No.106: 経営調整費・予備費は明細行側に一本化（表下サマリー行は廃止） */}
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
