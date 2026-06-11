import { getDocumentCategories, getDocuments } from "@/lib/actions/documents";
import { DocumentsClient } from "./documents-client";

export default async function DocumentsPage() {
  const [initialCategories, initialDocuments] = await Promise.all([
    getDocumentCategories(),
    getDocuments(),
  ]);

  return (
    <DocumentsClient
      initialCategories={initialCategories}
      initialDocuments={initialDocuments}
    />
  );
}
