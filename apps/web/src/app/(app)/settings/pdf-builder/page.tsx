import { getPdfFormTemplates } from "@/lib/actions/pdf-form-templates";
import { PdfBuilderClient } from "./pdf-builder-client";

export default async function PdfBuilderListPage() {
  const initialTemplates = await getPdfFormTemplates();

  return <PdfBuilderClient initialTemplates={initialTemplates} />;
}
