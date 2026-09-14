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
  return <PdfBuilderDemo pdfSource={`data:application/pdf;base64,${pdf.toString("base64")}`} patterns={patterns} />;
}
