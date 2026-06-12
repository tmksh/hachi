import { format } from "date-fns";
import { buildContractPrintHtml } from "@/lib/contract-pdf";
import {
  findTemplate,
  renderPreview,
  type ContractTemplate,
  type FormValues,
  type RenderContext,
} from "@/lib/contract-templates";
import type { PdfTemplate } from "@/lib/pdf-template";

/** 契約書エディタの内容から印刷用 HTML を生成 */
export function buildContractArchiveHtml(
  template: ContractTemplate,
  form: FormValues,
  renderCtx: RenderContext,
  pdfTemplate: PdfTemplate,
): string {
  const bodyHtml = renderPreview(template, form, renderCtx);
  return buildContractPrintHtml(bodyHtml, pdfTemplate, template.name);
}

/** ドキュメント一覧に表示する名称 */
export function contractArchiveDocumentName(templateName: string, date = new Date()) {
  return `${templateName}（確定 ${format(date, "yyyy/MM/dd")}）`;
}
