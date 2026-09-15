"use client";

import { useState } from "react";
import { PdfBuilderEditClient } from "@/app/(app)/settings/pdf-builder/[id]/pdf-builder-edit-client";
import { newFieldDefaults, type FillContext, type PdfFormTemplate, type PdfFieldBinding, type PdfFieldType } from "@/lib/pdf-form-template";
import { Button } from "@/components/ui/button";

const field = (id: string, label: string, type: PdfFieldType, binding: PdfFieldBinding, baseline: number, page = 0) => ({
  id, ...newFieldDefaults(type, page), label, binding,
  xPct: 156 / 595, yPct: (842 - baseline - 12) / 842, wPct: 379 / 595, hPct: 22 / 842,
});
const example: PdfFormTemplate = {
  id: "local-pdf-demo", name: "工事契約書 - ローカル確認用", docType: "contract", isActive: true,
  storagePath: "development-only", fileName: "pdf-builder.pdf", pageCount: 2,
  pageSizes: [{ width: 595, height: 842 }, { width: 595, height: 842 }],
  fields: [
    { ...field("title", "工事名称", "text", "construction_title", 650), required: true, editable: false },
    field("company", "会社名", "text", "customer_company_name", 595),
    field("amount", "受注金額", "number", "order_amount", 540),
    field("date", "工期開始", "date", "start_date", 485),
    { ...field("notes", "備考", "textarea", "manual", 400), required: true, placeholder: "確認事項を入力" },
    field("second-title", "工事名称（2ページ）", "text", "construction_title", 650, 1),
    { ...field("quantity", "数量", "number", "manual", 595, 1), text: "1", numberFormat: "grouped" },
    field("confirmed", "確認済み", "checkbox", "manual", 540, 1),
  ],
  createdAt: "2026-09-14T00:00:00Z", updatedAt: "2026-09-14T00:00:00Z",
};

export type PdfPattern = { key: string; template: PdfFormTemplate; context: FillContext; pdfSource: string };

export function PdfBuilderDemo({ pdfSource, patterns = [] }: { pdfSource: string; patterns?: PdfPattern[] }) {
  const [patternKey, setPatternKey] = useState("");
  const pattern = patterns.find((p) => p.key === patternKey);
  const [template, setTemplate] = useState(example);
  const [revision, setRevision] = useState(0);
  const [importMode, setImportMode] = useState(false);
  const load = (next: PdfFormTemplate) => { setImportMode(false); setTemplate(next); setRevision((v) => v + 1); };
  return <main className="min-h-screen bg-background">
    <div className="flex flex-wrap items-center gap-3 border-b bg-muted/30 px-4 py-2 text-xs">
      <span>ローカル確認用 · 保存先はこのブラウザです</span>
      <select aria-label="確認する雛形" className="rounded border bg-background p-2" value={patternKey} onChange={(e) => {
        const key = e.target.value; setPatternKey(key); load(patterns.find((p) => p.key === key)?.template ?? example);
      }}><option value="">基本サンプル / No.106</option>{patterns.map((p) => <option key={p.key} value={p.key}>{p.template.name}</option>)}</select>
      <Button size="sm" variant="outline" onClick={() => {
        const stored = localStorage.getItem(`pdf-builder-demo:${patternKey}`);
        load(stored ? JSON.parse(stored) as PdfFormTemplate : pattern?.template ?? example);
      }}>保存内容を開き直す</Button>
      <Button size="sm" variant="outline" onClick={() => { setPatternKey(""); load({ ...example, fields: example.fields.map((f) => f.id === "title" ? { ...f, type: "number", binding: "manual", label: "数値", text: "111111", editable: true } : f) }); }}>No.106を再現</Button>
      <Button size="sm" variant="ghost" onClick={() => load(pattern?.template ?? example)}>サンプルを初期化</Button>
      <Button size="sm" variant="outline" onClick={() => { setImportMode(true); setRevision(v => v + 1); }}>PDFを新規アップロードして検証</Button>
    </div>
    <PdfBuilderEditClient key={revision} id={importMode ? "new" : template.id} initDocType={template.docType} initialTemplate={importMode ? null : template} initialPdfUrl={importMode ? null : pattern?.pdfSource ?? pdfSource} previewContext={pattern?.context} customFieldKeys={["管理コード"]} onSaveTemplate={async (next) => { localStorage.setItem(`pdf-builder-demo:${importMode ? "uploaded" : patternKey}`, JSON.stringify(next)); }} />
  </main>;
}
