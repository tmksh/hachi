import { QueryProvider } from "@/components/providers/query-provider";
import { notFound } from "next/navigation";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PdfBuilderDemo } from "./pdf-builder-demo";
import type { PdfPattern } from "./pdf-builder-demo";

export default async function PdfBuilderDevelopmentPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const pdf = await readFile(path.join(process.cwd(), "scripts/fixtures/pdf-builder.pdf"));
  const fixtures = path.join(process.cwd(), "scripts/fixtures/pdf-patterns");
  const patterns: PdfPattern[] = JSON.parse(await readFile(path.join(fixtures, "patterns.json"), "utf8"));
  for (const pattern of patterns) {
    pattern.pdfSource = `data:application/pdf;base64,${(await readFile(path.join(fixtures, `${pattern.key}.pdf`))).toString("base64")}`;
  }
  for (const version of ["original", "corrected"]) {
    const bytes = await readFile(path.join(process.cwd(), "scripts/fixtures/pdf-updates", `${version}.pdf`));
    patterns.push({
      key: `pdf-update-${version}`, context: {}, pdfSource: `data:application/pdf;base64,${bytes.toString("base64")}`,
      template: { id: `pdf-update-${version}`, name: version === "original" ? "差し替え前：日付文字あり" : "差し替え後：白塗り・スタンプ・注釈", docType: "contract", isActive: false, storagePath: "development-only", fileName: `${version}.pdf`, pageCount: 2, pageSizes: [{width:595,height:842},{width:595,height:842}], fields: [], createdAt: "2026-09-21T00:00:00Z", updatedAt: "2026-09-21T00:00:00Z" },
    });
  }
  return <QueryProvider><PdfBuilderDemo pdfSource={`data:application/pdf;base64,${pdf.toString("base64")}`} patterns={patterns} /></QueryProvider>;
}
