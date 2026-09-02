/** 見積・契約PDFで共有する顧客参照 */
export type PdfCustomerRef = {
  name?: string | null;
  company_name?: string | null;
  customer_type?: string | null;
  notes?: string | null;
};

export function isCorporateCustomer(c: PdfCustomerRef | null | undefined): boolean {
  if (!c) return false;
  // 会社名があれば法人扱い（記入画面のバッジと同じ）。種別だけ individual でも御中にする
  if (c.company_name?.trim()) return true;
  return c.customer_type === "corporation";
}

/** 見積PDFの宛名（法人=会社名 御中 / 個人=氏名 様） */
export function formatPdfAddressee(c: PdfCustomerRef | null | undefined): string {
  const company = c?.company_name?.trim() || "";
  const name = c?.name?.trim() || "";
  if (isCorporateCustomer(c)) {
    const label = company || name;
    return label ? `${label} 御中` : "";
  }
  return name ? `${name} 様` : "";
}

/** 契約書の甲（発注者）名。法人は会社名を優先 */
export function formatPdfPartyName(c: PdfCustomerRef | null | undefined): string {
  const company = c?.company_name?.trim() || "";
  const name = c?.name?.trim() || "";
  if (isCorporateCustomer(c) && company) return company;
  return name;
}

export function composePdfNotes(
  documentNotes?: string | null,
  customerNotes?: string | null,
): string {
  return [documentNotes?.trim(), customerNotes?.trim()].filter(Boolean).join("\n\n");
}

export function toPdfCustomer(
  c: PdfCustomerRef | null | undefined,
): PdfCustomerRef | null {
  if (!c) return null;
  return {
    name: c.name ?? null,
    company_name: c.company_name ?? null,
    customer_type: c.customer_type ?? null,
    notes: c.notes ?? null,
  };
}

export function toRenderCustomer(
  c: {
    name: string;
    address?: string | null;
    company_name?: string | null;
    customer_type?: string | null;
    notes?: string | null;
  } | null | undefined,
) {
  if (!c) return null;
  return {
    name: c.name,
    address: c.address ?? null,
    company_name: c.company_name ?? null,
    customer_type: c.customer_type ?? null,
    notes: c.notes ?? null,
  };
}
