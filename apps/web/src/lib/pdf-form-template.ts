/**
 * 契約書PDFフォームテンプレート
 *
 * 管理者が PDF 雛形をインポートし、その上に「項目パレット」を配置して作る
 * 入力フォーム付きテンプレート。名称・金額・工期などはデータソースと連携して自動流し込みする。
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
  | "manual"
  | "construction_title"
  | "construction_no"
  | "order_amount"
  | "order_amount_tax"
  | "start_date"
  | "end_date"
  | "today"
  | "customer_name"
  | "customer_company_name"
  | "customer_type"
  | "customer_phone"
  | "customer_email"
  | "customer_eight_id"
  | "customer_department"
  | "customer_age"
  | "customer_address"
  | "customer_source"
  | "customer_inquiry_category"
  | "customer_inquiry_date"
  | "customer_inquiry_content"
  | "customer_assignee"
  | "customer_budget_min"
  | "customer_budget_max"
  | "customer_prospect_grade"
  | "customer_special_demand"
  | "customer_special_probability"
  | "customer_status"
  | "customer_tags"
  | "customer_notes"
  | "customer_line_id"
  | "customer_slack_id"
  | "customer_custom";

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
  construction_title: "名称",
  construction_no: "工事番号",
  order_amount: "受注金額（税抜）",
  order_amount_tax: "受注金額（税込）",
  start_date: "工期開始",
  end_date: "工期終了",
  today: "本日日付",
  customer_name: "契約者氏名",
  customer_company_name: "会社名",
  customer_type: "法人/個人",
  customer_phone: "電話番号",
  customer_email: "メールアドレス",
  customer_eight_id: "EIGHT-ID",
  customer_department: "部門",
  customer_age: "年齢",
  customer_address: "住所",
  customer_source: "知ったきっかけ",
  customer_inquiry_category: "問い合わせ分類",
  customer_inquiry_date: "問い合わせ日",
  customer_inquiry_content: "問い合わせ内容",
  customer_assignee: "担当者",
  customer_budget_min: "予算感（下限）",
  customer_budget_max: "予算感（上限）",
  customer_prospect_grade: "見込度",
  customer_special_demand: "特需",
  customer_special_probability: "特需の確度%",
  customer_status: "ステータス",
  customer_tags: "タグ",
  customer_notes: "備考",
  customer_line_id: "LINEユーザーID",
  customer_slack_id: "SlackチャンネルID",
  customer_custom: "顧客のその他項目",
};

const PROJECT_BINDINGS: PdfFieldBinding[] = [
  "construction_title", "construction_no", "order_amount", "order_amount_tax",
  "start_date", "end_date", "today",
];

export const CUSTOMER_BINDINGS: PdfFieldBinding[] = [
  "customer_name", "customer_company_name", "customer_type", "customer_phone",
  "customer_email", "customer_eight_id", "customer_department", "customer_age",
  "customer_address", "customer_source", "customer_inquiry_category",
  "customer_inquiry_date", "customer_inquiry_content", "customer_assignee",
  "customer_budget_min", "customer_budget_max", "customer_prospect_grade",
  "customer_special_demand", "customer_special_probability", "customer_status",
  "customer_tags", "customer_notes", "customer_line_id", "customer_slack_id",
  "customer_custom",
];

/** 各項目タイプで選べる binding */
export const BINDINGS_FOR_TYPE: Record<PdfFieldType, PdfFieldBinding[]> = {
  text: [
    "manual",
    ...PROJECT_BINDINGS.filter((b) => !["order_amount", "order_amount_tax", "start_date", "end_date", "today"].includes(b)),
    ...CUSTOMER_BINDINGS.filter((b) => b !== "customer_special_demand"),
  ],
  textarea: ["manual", "customer_address", "customer_inquiry_content", "customer_notes", "customer_custom"],
  date: ["manual", "start_date", "end_date", "today", "customer_inquiry_date"],
  number: [
    "manual", "order_amount", "order_amount_tax",
    "customer_age", "customer_budget_min", "customer_budget_max", "customer_special_probability",
  ],
  checkbox: ["manual", "customer_special_demand"],
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
  /** customer_custom の項目名 */
  bindingKey?: string;
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
export function bindingDisplayLabel(field: { binding: PdfFieldBinding; bindingKey?: string }): string {
  if (field.binding === "customer_custom" && field.bindingKey?.trim()) {
    return `その他：${field.bindingKey.trim()}`;
  }
  return BINDING_LABELS[field.binding] ?? field.binding;
}

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
  customer?: {
    name?: string | null;
    company_name?: string | null;
    customer_type?: string | null;
    phone?: string | null;
    email?: string | null;
    eight_id?: string | null;
    department?: string | null;
    age?: number | null;
    address?: string | null;
    source?: string | null;
    inquiry_category?: string | null;
    inquiry_date?: string | null;
    inquiry_content?: string | null;
    assigned_to?: string | null;
    budget_min?: number | null;
    budget_max?: number | null;
    prospect_grade?: string | null;
    is_special_demand?: boolean | null;
    special_probability?: number | null;
    status?: string | null;
    tags?: string[] | null;
    notes?: string | null;
    line_user_id?: string | null;
    slack_channel_id?: string | null;
    custom_fields?: Record<string, string> | null;
  } | null;
  customerAssigneeName?: string | null;
};

export function buildFillContext(input: {
  constructionTitle?: string | null;
  constructionNo?: string | null;
  orderAmount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  customer?: FillContext["customer"];
  customerAssigneeName?: string | null;
}): FillContext {
  return {
    constructionTitle: input.constructionTitle ?? null,
    constructionNo: input.constructionNo ?? null,
    orderAmount: input.orderAmount ?? null,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    customerName: input.customer?.name ?? null,
    customerAddress: input.customer?.address ?? null,
    customer: input.customer ?? null,
    customerAssigneeName: input.customerAssigneeName ?? null,
  };
}

function fmtYen(n: number) {
  return `¥${Math.round(n).toLocaleString()}`;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "";
  return iso.slice(0, 10).replaceAll("-", "/");
}

function customerTypeLabel(v: string | null | undefined) {
  if (v === "corporation") return "法人";
  if (v === "individual") return "個人";
  return v ?? "";
}

function customerStatusLabel(v: string | null | undefined) {
  if (v === "active") return "アクティブ";
  if (v === "inactive") return "非アクティブ";
  if (v === "pending") return "保留";
  return v ?? "";
}

function prospectLabel(v: string | null | undefined) {
  if (v === "A") return "A（見込度：高）";
  if (v === "B") return "B（見込度：中）";
  if (v === "C") return "C（見込度：低）";
  return v ?? "";
}

/** binding に応じて自動流し込み値を解決する。manual / 未解決は空文字 */
export function resolveFieldValue(field: PdfFormField, ctx: FillContext): string {
  const c = ctx.customer;
  switch (field.binding) {
    case "construction_title": return ctx.constructionTitle ?? "";
    case "construction_no":    return ctx.constructionNo ?? "";
    case "order_amount":       return ctx.orderAmount != null ? fmtYen(ctx.orderAmount) : "";
    case "order_amount_tax":   return ctx.orderAmount != null ? fmtYen(Math.round(ctx.orderAmount * 1.1)) : "";
    case "start_date":         return fmtDate(ctx.startDate) || (ctx.startDate ?? "");
    case "end_date":           return fmtDate(ctx.endDate) || (ctx.endDate ?? "");
    case "today":              return new Date().toLocaleDateString("ja-JP");
    case "customer_name":      return c?.name ?? ctx.customerName ?? "";
    case "customer_company_name": return c?.company_name ?? "";
    case "customer_type":      return customerTypeLabel(c?.customer_type);
    case "customer_phone":     return c?.phone ?? "";
    case "customer_email":     return c?.email ?? "";
    case "customer_eight_id":  return c?.eight_id ?? "";
    case "customer_department": return c?.department ?? "";
    case "customer_age":       return c?.age != null ? String(c.age) : "";
    case "customer_address":   return c?.address ?? ctx.customerAddress ?? "";
    case "customer_source":    return c?.source ?? "";
    case "customer_inquiry_category": return c?.inquiry_category ?? "";
    case "customer_inquiry_date": return fmtDate(c?.inquiry_date);
    case "customer_inquiry_content": return c?.inquiry_content ?? "";
    case "customer_assignee":  return ctx.customerAssigneeName ?? "";
    case "customer_budget_min": return c?.budget_min != null ? fmtYen(c.budget_min) : "";
    case "customer_budget_max": return c?.budget_max != null ? fmtYen(c.budget_max) : "";
    case "customer_prospect_grade": return prospectLabel(c?.prospect_grade);
    case "customer_special_demand": return c?.is_special_demand ? "特需" : "";
    case "customer_special_probability":
      return c?.special_probability != null ? `${c.special_probability}%` : "";
    case "customer_status":    return customerStatusLabel(c?.status);
    case "customer_tags":      return (c?.tags ?? []).filter(Boolean).join("、");
    case "customer_notes":     return c?.notes ?? "";
    case "customer_line_id":   return c?.line_user_id ?? "";
    case "customer_slack_id":  return c?.slack_channel_id ?? "";
    case "customer_custom": {
      const key = field.bindingKey?.trim();
      if (!key) return "";
      return c?.custom_fields?.[key] ?? "";
    }
    case "manual":             return field.text ?? "";
    default:                   return field.text ?? "";
  }
}
