"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  CONTRACT_PREVIEW_CLASS,
  contractPreviewStyle,
  renderContractDocumentHtml,
} from "@/lib/contract-pdf";
import { findTemplate, type FormValues, type RenderContext } from "@/lib/contract-templates";
import type { PdfTemplate } from "@/lib/pdf-template";

type Props = {
  pdf: PdfTemplate;
  contractTemplateId: string;
  form: FormValues;
  ctx: RenderContext;
  className?: string;
  padded?: boolean;
};

export function ContractContentPreview({
  pdf,
  contractTemplateId,
  form,
  ctx,
  className,
  padded = true,
}: Props) {
  const contractTpl = findTemplate(contractTemplateId);
  const html = useMemo(() => {
    if (!contractTpl) return "";
    return renderContractDocumentHtml(contractTpl, form, ctx);
  }, [contractTpl, form, ctx]);

  if (!contractTpl) return null;

  return (
    <div
      className={cn(
        "bg-white text-slate-900",
        padded && "p-8 md:p-10",
        CONTRACT_PREVIEW_CLASS,
        className,
      )}
      style={contractPreviewStyle(pdf)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
