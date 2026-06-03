import {
  CONTRACT_TEMPLATES,
  buildDefaults,
  renderPreview,
  type ContractTemplate,
  type FormValues,
  type RenderContext,
} from "@/lib/contract-templates";
import type { PdfTemplate } from "@/lib/pdf-template";

/** 契約書PDF用のサンプルコンテキスト（設定画面プレビュー） */
export const SAMPLE_CONTRACT_CTX: RenderContext = {
  construction: {
    title: "鈴木邸 新築工事",
    start_date: "2024-09-01",
    end_date: "2025-06-30",
    order_amount: 28_500_000,
  },
  customer: {
    name: "鈴木 太郎",
    address: "東京都世田谷区成城 3-12-5",
  },
};

export function buildSampleContractForm(templateId: string): FormValues {
  const tpl = CONTRACT_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) return {};
  const base = buildDefaults(tpl, SAMPLE_CONTRACT_CTX);
  if (templateId === "construction_contract") {
    return {
      ...base,
      otsu_name: "田中建設株式会社",
      otsu_address: "東京都新宿区西新宿1-1-1",
      payment_terms: "着工時30%、上棟時30%、完成引渡時40%",
    };
  }
  if (templateId === "design_supervision") {
    return {
      ...base,
      otsu_name: "○○設計事務所",
      otsu_address: "東京都渋谷区○○1-2-3",
      scope: "基本設計、実施設計、確認申請、工事監理",
    };
  }
  if (templateId === "change_order") {
    return {
      ...base,
      original_work: "鈴木邸 新築工事",
      original_date: "2024-09-01",
      change_summary: "・外構工事の追加\n・キッチン仕様の変更",
      amount_excl_tax: 1_200_000,
    };
  }
  return base;
}

export function contractPreviewStyle(pdf: PdfTemplate): React.CSSProperties {
  return {
    fontFamily: pdf.fontFamily,
    fontSize: `${pdf.fontSize}px`,
    lineHeight: 1.65,
    color: "#111827",
  };
}

/** PDF設定の fontSize を基準に本文HTML内の固定サイズを上書き */
export const CONTRACT_PREVIEW_CLASS =
  "max-w-none [&_h2]:!text-[1.45em] [&_h2]:text-center [&_h2]:font-bold [&_h2]:tracking-wider [&_h2]:mb-4 " +
  "[&_h3]:!text-[1.05em] [&_h3]:font-bold [&_h3]:mb-1.5 " +
  "[&_p]:!text-[1em] [&_p]:leading-relaxed [&_p]:my-0.5 " +
  "[&_.text-sm]:!text-[0.95em] [&_.text-xl]:!text-[1.45em]";

export function buildContractPrintHtml(
  bodyHtml: string,
  pdf: PdfTemplate,
  title: string,
): string {
  const fs = pdf.fontSize;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body {
    font-family: ${pdf.fontFamily};
    font-size: ${fs}px;
    line-height: 1.65;
    padding: 48px 56px;
    color: #111;
  }
  h2 { text-align: center; font-size: ${Math.round(fs * 1.45)}px; letter-spacing: 0.1em; margin-bottom: 28px; font-weight: bold; }
  h3 { font-weight: bold; margin: 0 0 6px; font-size: ${Math.round(fs * 1.05)}px; }
  p { margin: 3px 0; line-height: 1.65; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 48px; }
  .space-y-6 > * + * { margin-top: 24px; }
  .font-semibold { font-weight: 600; }
  .font-bold { font-weight: bold; }
  .text-sm { font-size: ${Math.round(fs * 0.95)}px; }
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .whitespace-pre-line { white-space: pre-line; }
  .pt-4 { padding-top: 16px; }
</style></head><body>${bodyHtml}</body></html>`;
}

export function renderContractDocumentHtml(
  contractTemplate: ContractTemplate,
  form: FormValues,
  ctx: RenderContext,
): string {
  return renderPreview(contractTemplate, form, ctx);
}
