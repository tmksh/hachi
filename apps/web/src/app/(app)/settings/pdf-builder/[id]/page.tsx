import {
  getPdfFormTemplates,
  getPdfFormTemplateUrl,
} from "@/lib/actions/pdf-form-templates";
import type { PdfFormDocType } from "@/lib/pdf-form-template";
import { PdfBuilderEditClient } from "./pdf-builder-edit-client";

export default async function PdfBuilderEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type } = await searchParams;
  const initDocType = (type ?? "contract") as PdfFormDocType;
  const isNew = id === "new";

  const templates = await getPdfFormTemplates();
  const initialTemplate = isNew ? null : templates.find((t) => t.id === id) ?? null;
  const initialPdfUrl =
    initialTemplate ? await getPdfFormTemplateUrl(initialTemplate.storagePath) : null;

  return (
    <PdfBuilderEditClient
      id={id}
      initDocType={initDocType}
      initialTemplate={initialTemplate}
      initialPdfUrl={initialPdfUrl}
    />
  );
}
