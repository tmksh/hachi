"use client";

import Link from "next/link";
import { ContractContentPreview } from "@/components/contracts/contract-content-preview";
import { groupFields, ContractFormSection } from "@/components/contracts/contract-doc-editor-parts";
import { findTemplate, type FormValues, type RenderContext } from "@/lib/contract-templates";
import type { PdfTemplate } from "@/lib/pdf-template";

const PREVIEW_PAPER_CLASS =
  "border border-slate-300 shadow-[0_2px_16px_rgba(0,0,0,0.12)] w-full max-w-[640px] min-h-[905px] mx-auto";

type Props = {
  templateId: string;
  form: FormValues;
  renderCtx: RenderContext;
  pdfTemplate: PdfTemplate | null;
  onFieldChange: (name: string, value: string | number) => void;
  autoSaveNote?: string;
};

/** 契約書エディタ共通：左入力項目 + 右A4プレビュー */
export function ContractDocumentEditorLayout({
  templateId,
  form,
  renderCtx,
  pdfTemplate,
  onFieldChange,
  autoSaveNote = "入力内容は右のプレビューにリアルタイム反映されます",
}: Props) {
  const tpl = findTemplate(templateId);
  if (!tpl) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 h-[calc(100vh-220px)] overflow-hidden rounded-xl border border-border">
      <div className="border-r border-border bg-[#F4F6F8] px-3 md:px-4 py-4 overflow-y-auto h-full min-w-0">
        <div className="w-full space-y-3.5">
          <div>
            <h3 className="text-sm font-bold text-slate-800">入力項目</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{autoSaveNote}</p>
          </div>
          {groupFields(tpl.fields).map(({ group, fields }) => (
            <ContractFormSection
              key={`${group.title}-${fields.map((f) => f.name).join("-")}`}
              title={group.title}
              description={group.description}
              fields={fields}
              form={form}
              onChange={onFieldChange}
            />
          ))}
        </div>
      </div>

      <div className="px-4 md:px-6 py-5 overflow-y-auto bg-muted/20 h-full">
        <h3 className="text-sm font-semibold mb-4 text-muted-foreground">プレビュー</h3>
        {pdfTemplate ? (
          <ContractContentPreview
            pdf={pdfTemplate}
            contractTemplateId={templateId}
            form={form}
            ctx={renderCtx}
            className={PREVIEW_PAPER_CLASS}
          />
        ) : (
          <div className={`${PREVIEW_PAPER_CLASS} flex items-center justify-center text-sm text-muted-foreground`}>
            プレビューを読み込み中...
          </div>
        )}
        <p className="text-[10px] text-muted-foreground text-center mt-2 max-w-[640px] mx-auto">
          表示は
          <Link href="/settings" className="text-primary underline underline-offset-2 mx-0.5">
            設定のPDF編集（契約書）
          </Link>
          のフォント・サイズ設定に連動しています
        </p>
      </div>
    </div>
  );
}

export { PREVIEW_PAPER_CLASS };
