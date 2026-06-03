import type { FontSize } from "@/lib/font-size";

export type PdfDocType = "estimate" | "contract" | "invoice";

/** PDF本文の文字サイズ（小・中・大） */
export const PDF_BODY_FONT_SIZE: Record<FontSize, number> = {
  sm: 9,
  md: 11,
  lg: 13,
};

export function inferPdfFontSizePreset(px: number): FontSize {
  if (px <= 9) return "sm";
  if (px >= 13) return "lg";
  return "md";
}

export const PDF_DOC_TYPES: { value: PdfDocType; label: string }[] = [
  { value: "estimate", label: "見積書" },
  { value: "contract", label: "契約書" },
  { value: "invoice", label: "請求書" },
];

export type PdfColumnKey = "quantity" | "unit" | "unitPrice" | "amount";

export type PdfSealColumn = { id: string; label: string };

export type PdfTemplate = {
  /** 帳票上部の大きな表題（例: 見　積　書） */
  title: string;
  /** ロゴ画像URL（任意。空ならテキストの会社名のみ） */
  logoUrl: string;
  showLogo: boolean;
  /** 罫線・見出し・合計欄に使うアクセントカラー */
  accentColor: string;
  /** 基本フォント */
  fontFamily: string;
  /** 本文の文字サイズ（小・中・大） */
  fontSizePreset: FontSize;
  /** 本文のフォントサイズ(px) — preset から自動設定 */
  fontSize: number;

  /** 発行元（自社）情報を表示するか */
  showIssuer: boolean;
  /** 会社情報を「設定の会社情報」から自動取得するか。false の場合は下の手動値を使用 */
  issuerUseCompany: boolean;
  issuerName: string;
  issuerPostal: string;
  issuerAddress: string;
  issuerTel: string;
  issuerInvoiceNo: string;

  /** 押印欄 */
  showSeal: boolean;
  sealColumns: PdfSealColumn[];

  /** 明細表に表示する列 */
  columns: Record<PdfColumnKey, boolean>;
  /** 明細表の最低行数（空行で埋める） */
  minRows: number;

  /** 有効期限 / 支払期限の表示と文言 */
  showValidity: boolean;
  validityLabel: string;
  validityText: string;

  /** 振込先情報（請求書向け） */
  showBank: boolean;
  bankInfo: string;

  /** 備考欄 */
  showNotes: boolean;
  notesLabel: string;
  notesDefault: string;

  /** 最下部フッター文言 */
  footerText: string;
};

export type PdfTemplates = Record<PdfDocType, PdfTemplate>;

const baseTemplate = (): PdfTemplate => ({
  title: "",
  logoUrl: "",
  showLogo: false,
  accentColor: "#0F5132",
  fontFamily: "sans-serif",
  fontSizePreset: "md",
  fontSize: PDF_BODY_FONT_SIZE.md,
  showIssuer: true,
  issuerUseCompany: true,
  issuerName: "",
  issuerPostal: "",
  issuerAddress: "",
  issuerTel: "",
  issuerInvoiceNo: "",
  showSeal: true,
  sealColumns: [
    { id: "s1", label: "担当" },
    { id: "s2", label: "確認" },
    { id: "s3", label: "承認" },
  ],
  columns: { quantity: true, unit: true, unitPrice: true, amount: true },
  minRows: 8,
  showValidity: true,
  validityLabel: "有効期限",
  validityText: "発行日より30日間",
  showBank: false,
  bankInfo: "",
  showNotes: true,
  notesLabel: "備考",
  notesDefault: "",
  footerText: "",
});

export const DEFAULT_PDF_TEMPLATES: PdfTemplates = {
  estimate: {
    ...baseTemplate(),
    title: "見　積　書",
    validityLabel: "有効期限",
    validityText: "発行日より30日間",
  },
  contract: {
    ...baseTemplate(),
    title: "工　事　請　負　契　約　書",
    showSeal: true,
    showValidity: false,
    columns: { quantity: true, unit: true, unitPrice: true, amount: true },
    notesLabel: "特記事項",
  },
  invoice: {
    ...baseTemplate(),
    title: "請　求　書",
    showValidity: true,
    validityLabel: "お支払期限",
    validityText: "請求日より翌月末日",
    showBank: true,
    bankInfo: "○○銀行 ○○支店 普通 0000000\n口座名義: カ）○○ケンセツ",
    notesLabel: "備考",
  },
};

/** company.settings.pdf_templates から安全に取り出し、欠損キーをデフォルトで補完する */
export function resolvePdfTemplates(raw: unknown): PdfTemplates {
  const source = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<PdfDocType, Partial<PdfTemplate>>>;
  const merge = (type: PdfDocType): PdfTemplate => {
    const partial = source[type] ?? {};
    const fontSize = typeof partial.fontSize === "number" ? partial.fontSize : DEFAULT_PDF_TEMPLATES[type].fontSize;
    const fontSizePreset =
      partial.fontSizePreset === "sm" || partial.fontSizePreset === "md" || partial.fontSizePreset === "lg"
        ? partial.fontSizePreset
        : inferPdfFontSizePreset(fontSize);
    return {
      ...DEFAULT_PDF_TEMPLATES[type],
      ...partial,
      fontSizePreset,
      fontSize: PDF_BODY_FONT_SIZE[fontSizePreset] ?? fontSize,
      columns: { ...DEFAULT_PDF_TEMPLATES[type].columns, ...(partial.columns ?? {}) },
      sealColumns: partial.sealColumns ?? DEFAULT_PDF_TEMPLATES[type].sealColumns,
    };
  };
  return {
    estimate: merge("estimate"),
    contract: merge("contract"),
    invoice: merge("invoice"),
  };
}
