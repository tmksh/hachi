import type { FormSlot } from "./pdf-form-snap";
import type { PdfFieldBinding, PdfFormField } from "./pdf-form-template";

export type PdfMappingIssue = {
  fieldId: string;
  message: string;
  suggestedBinding?: PdfFieldBinding;
  suggestedSlot?: FormSlot;
};

/** PDFの既存ラベルは誤配置の確認にのみ使う。保存済みの位置・連携元は変更しない。 */
export function pdfMappingIssues(fields: PdfFormField[], pageSlots: FormSlot[][]): PdfMappingIssue[] {
  return fields.flatMap((field) => {
    if (field.type !== "number") return [];
    const slots = pageSlots[field.page] ?? [];
    const conflicting = slots.find((slot) => {
      if (!["construction_title", "company_orderer", "company_contractor"].includes(slot.kind)) return false;
      const w = Math.max(0, Math.min(field.xPct + field.wPct, slot.x + slot.w) - Math.max(field.xPct, slot.x));
      const h = Math.max(0, Math.min(field.yPct + field.hPct, slot.y + slot.h) - Math.max(field.yPct, slot.y));
      return w * h / Math.max(Math.min(field.wPct * field.hPct, slot.w * slot.h), 0.000001) > 0.5;
    });
    if (!conflicting) return [];
    const title = conflicting.kind === "construction_title";
    const expected = field.binding === "order_amount" ? "subtotal" : field.binding === "order_amount_tax" ? "total" : null;
    return [{
      fieldId: field.id,
      message: `${title ? "工事名称" : "会社名"}欄に数値項目があります。連携元を確認するか、数値項目を正しい欄へ移動してください。`,
      // 明確な連携元がある金額項目を、名称項目に置き換えない。
      suggestedBinding: field.binding === "manual" ? (title ? "construction_title" : "customer_company_name") as PdfFieldBinding : undefined,
      suggestedSlot: expected ? slots.find((slot) => slot.kind === expected) : undefined,
    }];
  });
}
