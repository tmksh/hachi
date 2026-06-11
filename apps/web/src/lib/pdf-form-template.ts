/**
 * 契約書PDFフォームテンプレート
 *
 * 管理者が PDF 雛形をインポートし、その上に「項目パレット」を配置して作る
 * 入力フォーム付きテンプレート。工事名・金額・工期などはデータソースと連携して自動流し込みする。
 *
 * テンプレ定義は company.settings.pdf_form_templates に配列で保存し、
 * PDF 本体は Supabase Storage（documents バケット / pdf-form-templates/ プレフィックス）に置く。
 */

/** 配置できる項目タイプ */
export type PdfFieldType =
  | "text"      // テキスト入力（1行）
  | "textarea"  // テキストエリア（複数行）
  | "date"      // 日付
  | "number"    // 数値（金額など）
  | "checkbox"  // チェックボックス
  | "signature" // 署名
  | "fixed";    // 固定テキスト（差し込み不要の定型文）

/** 自動流し込みのデータソース */
export type PdfFieldBinding =
  | "manual"               // 手入力（差し込み時に入力）
  | "construction_title"   // 工事名
  | "construction_no"      // 工事番号
  | "order_amount"         // 受注金額（見積連動）
  | "order_amount_tax"     // 受注金額（税込）
  | "start_date"           // 工期開始（工程表連動）
  | "end_date"             // 工期終了（工程表連動）
  | "customer_name"        // 顧客名
  | "customer_address"     // 顧客住所
  | "today";               // 本日日付

export const FIELD_TYPE_LABELS: Record<PdfFieldType, string> = {
  text: "テキスト入力",
  textarea: "テキストエリア",
  date: "日付",
  number: "数値",
  checkbox: "チェックボックス",
  signature: "署名",
  fixed: "固定テキスト",
};

export const BINDING_LABELS: Record<PdfFieldBinding, string> = {
  manual: "手入力",
  construction_title: "工事名",
  construction_no: "工事番号",
  order_amount: "受注金額（税抜）",
  order_amount_tax: "受注金額（税込）",
  start_date: "工期開始",
  end_date: "工期終了",
  customer_name: "顧客名",
  customer_address: "顧客住所",
  today: "本日日付",
};

/** 各項目タイプで選べる binding */
export const BINDINGS_FOR_TYPE: Record<PdfFieldType, PdfFieldBinding[]> = {
  text: ["manual", "construction_title", "construction_no", "customer_name", "customer_address"],
  textarea: ["manual", "customer_address"],
  date: ["manual", "start_date", "end_date", "today"],
  number: ["manual", "order_amount", "order_amount_tax"],
  checkbox: ["manual"],
  signature: ["manual", "customer_name"],
  fixed: ["manual"],
};

/**
 * 配置された項目。座標はページに対する比率(0-1)で保持し、
 * 表示解像度に依存しないようにする。
 */
export type PdfFormField = {
  id: string;
  page: number;        // 0-based ページ番号
  type: PdfFieldType;
  label: string;
  binding: PdfFieldBinding;
  /** fixed / 既定値 用のテキスト */
  text?: string;
  /** 位置・サイズ（ページ幅・高さに対する比率 0-1） */
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  /** 文字サイズ(px, ページ実寸基準) */
  fontSize: number;
  /** 文字色 */
  color: string;
  /** 中央寄せ */
  align: "left" | "center" | "right";
};

export type PdfFormDocType = "contract" | "estimate" | "invoice";

export const PDF_FORM_DOC_TYPE_LABELS: Record<PdfFormDocType, string> = {
  contract: "契約書",
  estimate: "見積書",
  invoice: "請求書",
};

export const PDF_FORM_DOC_TYPES: PdfFormDocType[] = ["contract", "estimate", "invoice"];

export type PdfFormTemplate = {
  id: string;
  name: string;
  /** 書類種別 */
  docType: PdfFormDocType;
  /** この種別で採用中か */
  isActive: boolean;
  /** Storage 上の PDF パス */
  storagePath: string;
  fileName: string;
  pageCount: number;
  /** 各ページの実寸（pt）。プレビュー・配置の縦横比に使用 */
  pageSizes: { width: number; height: number }[];
  fields: PdfFormField[];
  createdAt: string;
  updatedAt: string;
};

export const PDF_FORM_TEMPLATES_KEY = "pdf_form_templates";

export function newFieldDefaults(type: PdfFieldType, page: number): Omit<PdfFormField, "id"> {
  return {
    page,
    type,
    label: FIELD_TYPE_LABELS[type],
    binding: "manual",
    text: type === "fixed" ? "テキスト" : "",
    xPct: 0.1,
    yPct: 0.1,
    wPct: type === "textarea" ? 0.4 : 0.25,
    hPct: type === "textarea" ? 0.08 : 0.03,
    fontSize: 12,
    color: "#111111",
    align: "left",
  };
}

/** company.settings から安全に取り出す */
export function resolvePdfFormTemplates(raw: unknown): PdfFormTemplate[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is PdfFormTemplate => !!t && typeof t === "object" && typeof (t as PdfFormTemplate).id === "string")
    .map((t) => ({
      ...t,
      docType: (t as PdfFormTemplate).docType ?? "contract",
      isActive: (t as PdfFormTemplate).isActive ?? false,
    }));
}

/** 差し込みコンテキスト */
export type FillContext = {
  constructionTitle?: string | null;
  constructionNo?: string | null;
  orderAmount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  customerName?: string | null;
  customerAddress?: string | null;
};

function fmtYen(n: number) {
  return `¥${Math.round(n).toLocaleString()}`;
}

/** binding に応じて自動流し込み値を解決する。manual / 未解決は空文字 */
export function resolveFieldValue(field: PdfFormField, ctx: FillContext): string {
  switch (field.binding) {
    case "construction_title": return ctx.constructionTitle ?? "";
    case "construction_no":    return ctx.constructionNo ?? "";
    case "order_amount":       return ctx.orderAmount != null ? fmtYen(ctx.orderAmount) : "";
    case "order_amount_tax":   return ctx.orderAmount != null ? fmtYen(Math.round(ctx.orderAmount * 1.1)) : "";
    case "start_date":         return ctx.startDate ?? "";
    case "end_date":           return ctx.endDate ?? "";
    case "customer_name":      return ctx.customerName ?? "";
    case "customer_address":   return ctx.customerAddress ?? "";
    case "today":              return new Date().toLocaleDateString("ja-JP");
    case "manual":             return field.text ?? "";
    default:                   return field.text ?? "";
  }
}
