"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ContractContentPreview } from "@/components/contracts/contract-content-preview";
import { groupFields, ContractFormSection } from "@/components/contracts/contract-doc-editor-parts";
import { findTemplate, type FormValues, type RenderContext } from "@/lib/contract-templates";
import type { PdfTemplate } from "@/lib/pdf-template";

/** A4実寸で組んだ用紙を、画面上では少し縮小して見せる */
const A4_SCALE = 0.88;
const PREVIEW_PAPER_CLASS =
  "border border-slate-300 shadow-[0_2px_16px_rgba(0,0,0,0.12)] w-[210mm] min-h-[297mm] box-border";

function A4PreviewFrame({ children }: { children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [boxHeight, setBoxHeight] = useState<number>();

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const sync = () => setBoxHeight(el.offsetHeight * A4_SCALE);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className="mx-auto overflow-hidden"
      style={{ width: `calc(210mm * ${A4_SCALE})`, height: boxHeight }}
    >
      <div
        ref={innerRef}
        className="origin-top-left"
        style={{ width: "210mm", transform: `scale(${A4_SCALE})` }}
      >
        {children}
      </div>
    </div>
  );
}

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
    <div className="flex flex-col lg:flex-row h-[calc(100vh-220px)] overflow-hidden rounded-xl border border-border">
      <div className="lg:w-[400px] xl:w-[420px] shrink-0 border-r border-border bg-[#F4F6F8] px-3 md:px-4 py-4 overflow-y-auto h-full min-w-0">
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

      <div className="flex-1 min-w-0 px-3 md:px-5 py-5 overflow-auto bg-muted/20 h-full">
        <h3 className="text-sm font-semibold mb-4 text-muted-foreground">プレビュー（A4）</h3>
        <A4PreviewFrame>
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
        </A4PreviewFrame>
        <p className="text-[10px] text-muted-foreground text-center mt-2 mx-auto" style={{ width: `calc(210mm * ${A4_SCALE})` }}>
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
