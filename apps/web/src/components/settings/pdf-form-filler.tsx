"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Printer, Sparkles, PenLine, X } from "lucide-react";
import { toast } from "sonner";
import { loadPdfDocument, PdfPageCanvas } from "@/components/settings/pdf-page-canvas";
import { getPdfFormTemplateUrl } from "@/lib/actions/pdf-form-templates";
import {
  bindingDisplayLabel,
  pdfFieldInputValue,
  formatPdfFieldValue,
  pdfDateInputValue,
  pdfNumberValue,
  validatePdfFieldInputs,
  validatePdfTemplate,
  pdfFieldsForPage,
  pdfFormDocumentKey,
  fieldOverlayBox,
  overlayFontSizePx,
  overlayJustify,
  type FillContext,
  type PdfFormField,
  type PdfFormTemplate,
} from "@/lib/pdf-form-template";
import { slotsFromPdfPage, type FormSlot } from "@/lib/pdf-form-snap";
import { pdfMappingIssues } from "@/lib/pdf-form-mapping";
import { pdfFieldOverlayHtml, pdfPrintDocumentHtml, type PdfPrintPage } from "@/lib/pdf-form-print";
import { cn } from "@/lib/utils";
import { PDF_FORM_ANNOTATION_MODE } from "@/lib/pdf-form-render";

type PanelProps = {
  template: PdfFormTemplate;
  ctx: FillContext;
  onClose?: () => void;
  className?: string;
  pdfSource?: string;
};

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: PdfFormTemplate | null;
  ctx: FillContext;
};

/** タブ内インライン表示：左に入力項目、右に PDF プレビュー */
export function PdfFormFillerPanel(props: PanelProps) {
  return <PdfFormFillerContent key={`${pdfFormDocumentKey(props.template, props.pdfSource)}:${props.ctx.recordId ?? ""}`} {...props} />;
}

function PdfFormFillerContent({ template, ctx, onClose, className, pdfSource }: PanelProps) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const previewColRef = useRef<HTMLDivElement>(null);
  const [renderW, setRenderW] = useState(0);
  const [pageViewports, setPageViewports] = useState<{ width: number; height: number }[]>([]);
  const [pageSlots, setPageSlots] = useState<FormSlot[][]>([]);

  const valueFor = (f: PdfFormField): string => pdfFieldInputValue(f, ctx, values);
  const displayValueFor = (f: PdfFormField): string => formatPdfFieldValue(f, valueFor(f));
  const inputIssues = validatePdfFieldInputs(template.fields, valueFor);
  const mappingIssues = pdfMappingIssues(template.fields, pageSlots);
  const templateIssues = validatePdfTemplate(template);
  const invalid = inputIssues.length > 0 || mappingIssues.length > 0 || templateIssues.length > 0;

  useEffect(() => {
    setLoading(true);
    setDoc(null);
    setPageViewports([]);
    setPageSlots([]);
    let cancelled = false;
    (async () => {
      try {
        const url = pdfSource ?? await getPdfFormTemplateUrl(template.storagePath);
        if (!url) throw new Error("PDFを取得できませんでした");
        const d = await loadPdfDocument(url);
        if (cancelled) return;
        const sizes: { width: number; height: number }[] = [];
        const slots: FormSlot[][] = [];
        for (let i = 1; i <= d.numPages; i++) {
          const page = await d.getPage(i);
          const vp = page.getViewport({ scale: 1 });
          sizes.push({ width: vp.width, height: vp.height });
          slots.push(await slotsFromPdfPage(page));
        }
        if (cancelled) return;
        setPageViewports(sizes);
        setPageSlots(slots);
        setDoc(d);
      } catch (e: unknown) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "読み込みに失敗しました");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [template.storagePath, template.updatedAt, pdfSource]);

  useEffect(() => {
    const el = previewColRef.current;
    if (!el) return;
    const apply = () => {
      const w = el.clientWidth;
      if (w) setRenderW(Math.max(1, Math.floor(w)));
    };
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    apply();
    return () => ro.disconnect();
  }, [doc, loading]);

  const autoFields = useMemo(
    () => template.fields.filter((f) => f.binding !== "manual" && f.type !== "fixed"),
    [template],
  );
  const manualFields = useMemo(
    () => template.fields.filter((f) => f.binding === "manual" && f.type !== "fixed"),
    [template],
  );

  const setValue = (id: string, v: string) => setValues((m) => ({ ...m, [id]: v }));

  const renderFieldInput = (f: PdfFormField) => {
    if (f.type === "checkbox") {
      const checked = !!valueFor(f);
      return (
        <div className="flex items-center gap-2">
          <Switch aria-label={f.label} disabled={f.editable === false} checked={checked} onCheckedChange={(c) => setValue(f.id, c ? "1" : "")} />
          <span className="text-xs text-muted-foreground">{checked ? "あり" : "なし"}</span>
        </div>
      );
    }
    if (f.type === "textarea") {
      return (
        <Textarea
          value={valueFor(f)}
          onChange={(e) => setValue(f.id, e.target.value)}
          rows={2}
          aria-label={f.label}
          aria-invalid={inputIssues.some((issue) => issue.fieldId === f.id)}
          readOnly={f.editable === false}
          required={f.required}
          placeholder={f.placeholder}
          className="text-sm"
        />
      );
    }
    return (
      <Input
        type={f.type === "date" ? "date" : "text"}
        inputMode={f.type === "number" ? "decimal" : undefined}
        value={f.type === "date" ? pdfDateInputValue(valueFor(f)) : f.type === "number" ? (f.editable !== false ? values[f.id] : undefined) ?? (pdfNumberValue(valueFor(f))?.toString() ?? valueFor(f)) : valueFor(f)}
        aria-label={f.label}
        aria-invalid={inputIssues.some((issue) => issue.fieldId === f.id)}
        readOnly={f.editable === false}
        required={f.required}
        placeholder={f.placeholder}
        onChange={(e) => setValue(f.id, e.target.value)}
        className="h-8 text-sm read-only:bg-muted"
      />
    );
  };

  const handlePrint = async () => {
    if (!doc) return;
    if (invalid) {
      toast.error("入力項目とテンプレートの設定を確認してください");
      return;
    }
    setPrinting(true);
    try {
      const printPages: PdfPrintPage[] = [];
      for (let p = 0; p < doc.numPages; p++) {
        const page = await doc.getPage(p + 1);
        const baseVp = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        const c = canvas.getContext("2d");
        if (!c) continue;
        await (
          page.render({
            canvas,
            canvasContext: c,
            viewport: vp,
            annotationMode: PDF_FORM_ANNOTATION_MODE,
          } as Parameters<typeof page.render>[0]) as unknown as {
            promise: Promise<void>;
          }
        ).promise;
        const img = canvas.toDataURL("image/jpeg", 0.92);

        const overlays = pdfFieldsForPage(template.fields, p)
          .map((f) => pdfFieldOverlayHtml(f, displayValueFor(f), baseVp.width, baseVp.width, baseVp.height))
          .join("");

        printPages.push({ width: baseVp.width, height: baseVp.height, image: img, overlays });
      }

      const html = pdfPrintDocumentHtml(template.name, printPages);

      // 同じ画面内で印刷文書を準備し、ポップアップ制限の影響を受けないようにする。
      const frame = document.createElement("iframe");
      frame.title = "PDF印刷用ページ";
      frame.style.cssText = "position:fixed;left:-10000px;top:0;width:900px;height:1200px;border:0;";
      document.body.appendChild(frame);
      const win = frame.contentWindow;
      if (!win) { frame.remove(); throw new Error("印刷画面を開けませんでした"); }
      try {
        win.document.open();
        win.document.write(html);
        win.document.close();
        await Promise.all(Array.from(win.document.images).map((img) => img.decode()));
        await win.document.fonts.ready;
        win.addEventListener("afterprint", () => frame.remove(), { once: true });
        win.print();
        // 印刷ダイアログを開かないブラウザでも、不要な文書を残し続けない。
        setTimeout(() => frame.remove(), 60_000);
      } catch (error) {
        frame.remove();
        throw error;
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "出力に失敗しました");
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden flex flex-col min-h-[min(72vh,620px)]", className)}>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3 bg-muted/20 shrink-0">
        <p className="text-sm font-semibold truncate">{template.name}</p>
        {onClose && (
          <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0" onClick={onClose}>
            <X className="h-4 w-4 mr-1" />
            閉じる
          </Button>
        )}
      </div>

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        {/* 左：入力項目 */}
        <div className="w-full md:w-80 shrink-0 overflow-y-auto max-h-[38vh] md:max-h-none border-b md:border-b-0 md:border-r bg-background p-4 space-y-4">
          <div className="text-xs font-semibold text-muted-foreground">入力項目</div>

          {autoFields.length === 0 && manualFields.length === 0 && (
            <p className="text-xs text-muted-foreground">入力する項目はありません。</p>
          )}

          {autoFields.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
                <Sparkles className="h-3 w-3" />自動入力
              </div>
              {autoFields.map((f) => (
                <div key={f.id} className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5">
                    {f.label}{f.required && <span className="text-destructive">必須</span>}
                    {f.editable === false && <span className="text-muted-foreground">編集不可</span>}
                    <span className="rounded bg-emerald-50 px-1 py-0.5 text-[10px] font-normal text-emerald-600">
                      {bindingDisplayLabel(f)}
                    </span>
                  </Label>
                  {renderFieldInput(f)}
                  {inputIssues.filter((issue) => issue.fieldId === f.id).map((issue) => <p key={issue.message} className="text-xs text-destructive">{issue.message}</p>)}
                </div>
              ))}
            </div>
          )}

          {manualFields.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <PenLine className="h-3 w-3" />手入力
              </div>
              {manualFields.map((f) => (
                <div key={f.id} className="space-y-1">
                  <Label className="text-xs">{f.label}{f.required && <span className="ml-1 text-destructive">必須</span>}{f.editable === false && <span className="ml-1 text-muted-foreground">編集不可</span>}</Label>
                  {renderFieldInput(f)}
                  {inputIssues.filter((issue) => issue.fieldId === f.id).map((issue) => <p key={issue.message} className="text-xs text-destructive">{issue.message}</p>)}
                </div>
              ))}
            </div>
          )}

          {(mappingIssues.length > 0 || templateIssues.length > 0) && (
            <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive space-y-2">
              <p className="font-semibold">管理者によるテンプレートの修正が必要です</p>
              {[...mappingIssues, ...templateIssues].map((issue) => <p key={`${issue.fieldId}:${issue.message}`}>{template.fields.find((f) => f.id === issue.fieldId)?.label}：{issue.message}</p>)}
            </div>
          )}
          <Button onClick={handlePrint} disabled={printing || loading || !doc || invalid} className="w-full mt-2">
            {printing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Printer className="h-4 w-4 mr-1" />}
            印刷 / PDF出力
          </Button>
        </div>

        {/* 右：プレビュー（コンテナ幅いっぱいに収め、欄内でクリップする） */}
        <div className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto bg-muted/30 p-4 sm:p-5 min-h-[320px]">
          {loading || !doc ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div ref={previewColRef} className="mx-auto w-full min-w-0 space-y-4">
              {Array.from({ length: doc.numPages }).map((_, p) => {
                const stored = template.pageSizes[p];
                const live = pageViewports[p];
                const pw = live?.width ?? stored?.width ?? 595;
                const ph = live?.height ?? stored?.height ?? pw * 1.414;
                return (
                  <div
                    key={p}
                    className="relative mx-auto w-full bg-white shadow overflow-hidden"
                    style={{ aspectRatio: `${pw} / ${ph}` }}
                  >
                    {renderW > 0 && (
                      <PdfPageCanvas
                        doc={doc}
                        pageNumber={p + 1}
                        width={renderW}
                        renderFormFields={false}
                        className="pointer-events-none absolute inset-0 h-full w-full"
                      />
                    )}
                    {pdfFieldsForPage(template.fields, p).map((f) => (
                        <FieldOverlay
                          key={f.id}
                          field={f}
                          value={displayValueFor(f)}
                          pageWidth={pw}
                          renderW={renderW || pw}
                          pageHeight={(renderW || pw) * (ph / pw)}
                        />
                      ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** ダイアログ表示（後方互換） */
export function PdfFormFiller({ open, onOpenChange, template, ctx }: DialogProps) {
  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex flex-col gap-0 overflow-hidden p-0 w-[min(96vw,1100px)] max-w-[min(96vw,1100px)] sm:max-w-[min(96vw,1100px)] max-h-[90vh]"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{template.name}</DialogTitle>
        </DialogHeader>
        <PdfFormFillerPanel
          template={template}
          ctx={ctx}
          onClose={() => onOpenChange(false)}
          className="border-0 rounded-none min-h-0 flex-1 h-full max-h-[85vh]"
        />
      </DialogContent>
    </Dialog>
  );
}

function FieldOverlay({
  field,
  value,
  pageWidth,
  renderW,
  pageHeight,
}: {
  field: PdfFormField;
  value: string;
  pageWidth: number;
  renderW: number;
  pageHeight: number;
}) {
  const box = fieldOverlayBox(field);

  const boxH = box.h * pageHeight;
  const boxW = box.w * (renderW || pageWidth);
  const fontPx = overlayFontSizePx(field.fontSize, pageWidth, renderW, boxH, boxW, value, field.type === "textarea");
  const multiline = field.type === "textarea";

  return (
    <div
      className="absolute box-border flex min-h-0 min-w-0 overflow-hidden"
      data-pdf-field={field.id}
      style={{
        left: `${box.x * 100}%`,
        top: `${box.y * 100}%`,
        width: `${box.w * 100}%`,
        height: `${box.h * 100}%`,
        color: field.color,
        fontSize: fontPx,
        lineHeight: 1.15,
        justifyContent: overlayJustify(field.align),
        alignItems: multiline ? "flex-start" : "center",
        backgroundColor: "#fff",
        padding: "0 2px",
        fontFamily: '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif',
        fontWeight: 400,
        zIndex: 1,
      }}
    >
      <span
        className="min-w-0 max-w-full overflow-hidden"
        style={{
          whiteSpace: multiline ? "pre-wrap" : "nowrap",
          wordBreak: multiline ? "break-word" : "normal",
        }}
      >
        {value}
      </span>
    </div>
  );
}
