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
  resolveFieldValue,
  BINDING_LABELS,
  fieldOverlayBox,
  overlayFontSizePx,
  overlayJustify,
  type FillContext,
  type PdfFormField,
  type PdfFormTemplate,
} from "@/lib/pdf-form-template";
import { cn } from "@/lib/utils";

type PanelProps = {
  template: PdfFormTemplate;
  ctx: FillContext;
  onClose?: () => void;
  className?: string;
};

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: PdfFormTemplate | null;
  ctx: FillContext;
};

/** タブ内インライン表示：左に入力項目、右に PDF プレビュー */
export function PdfFormFillerPanel({ template, ctx, onClose, className }: PanelProps) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const previewColRef = useRef<HTMLDivElement>(null);
  const [renderW, setRenderW] = useState(0);
  const [pageViewports, setPageViewports] = useState<{ width: number; height: number }[]>([]);

  const valueFor = (f: PdfFormField): string => values[f.id] ?? resolveFieldValue(f, ctx);

  useEffect(() => {
    setLoading(true);
    setDoc(null);
    setPageViewports([]);
    let cancelled = false;
    (async () => {
      try {
        const url = await getPdfFormTemplateUrl(template.storagePath);
        if (!url) throw new Error("PDFを取得できませんでした");
        const d = await loadPdfDocument(url);
        if (cancelled) return;
        const sizes: { width: number; height: number }[] = [];
        for (let i = 1; i <= d.numPages; i++) {
          const page = await d.getPage(i);
          const vp = page.getViewport({ scale: 1 });
          sizes.push({ width: vp.width, height: vp.height });
        }
        if (cancelled) return;
        setPageViewports(sizes);
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
  }, [template.storagePath]);

  useEffect(() => {
    const init: Record<string, string> = {};
    template.fields.forEach((f) => {
      init[f.id] = resolveFieldValue(f, ctx);
    });
    setValues(init);
    // テンプレートを開いた時点の差し込み値で初期化する。ctx の参照変化で PDF を再読込しない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id]);

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
      const checked = !!values[f.id];
      return (
        <div className="flex items-center gap-2">
          <Switch checked={checked} onCheckedChange={(c) => setValue(f.id, c ? "1" : "")} />
          <span className="text-xs text-muted-foreground">{checked ? "あり" : "なし"}</span>
        </div>
      );
    }
    if (f.type === "textarea") {
      return (
        <Textarea
          value={values[f.id] ?? ""}
          onChange={(e) => setValue(f.id, e.target.value)}
          rows={2}
          className="text-sm"
        />
      );
    }
    return (
      <Input
        value={values[f.id] ?? ""}
        onChange={(e) => setValue(f.id, e.target.value)}
        className="h-8 text-sm"
      />
    );
  };

  const handlePrint = async () => {
    if (!doc) return;
    setPrinting(true);
    try {
      const pagesHtml: string[] = [];
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
            annotationMode: 0,
          } as Parameters<typeof page.render>[0]) as unknown as {
            promise: Promise<void>;
          }
        ).promise;
        const img = canvas.toDataURL("image/jpeg", 0.92);

        const overlays = fieldsPaintOrder(template.fields, p)
          .map((f) => overlayHtml(f, valueFor(f), baseVp.width, baseVp.width, baseVp.height))
          .join("");

        pagesHtml.push(
          `<div class="page" style="width:${baseVp.width}px;height:${baseVp.height}px;">
             <img src="${img}" style="position:absolute;inset:0;width:100%;height:100%;display:block;" />
             ${overlays}
           </div>`,
        );
      }

      const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(template.name)}</title>
        <style>
          @page { size: auto; margin: 0; }
          * { box-sizing: border-box; }
          body { margin:0; font-family: "Hiragino Sans","Yu Gothic",sans-serif; }
          .page { position:relative; page-break-after: always; overflow:hidden; }
          @media print { .page { box-shadow:none; } }
        </style></head>
        <body>${pagesHtml.join("")}</body></html>`;

      const win = window.open("", "_blank", "width=900,height=1200");
      if (!win) {
        toast.error("ポップアップがブロックされました");
        return;
      }
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 400);
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
                    {f.label}
                    <span className="rounded bg-emerald-50 px-1 py-0.5 text-[10px] font-normal text-emerald-600">
                      {BINDING_LABELS[f.binding]}
                    </span>
                  </Label>
                  {renderFieldInput(f)}
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
                  <Label className="text-xs">{f.label}</Label>
                  {renderFieldInput(f)}
                </div>
              ))}
            </div>
          )}

          <Button onClick={handlePrint} disabled={printing || loading || !doc} className="w-full mt-2">
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
                        renderAnnotations={false}
                        className="pointer-events-none absolute inset-0 h-full w-full"
                      />
                    )}
                    {fieldsPaintOrder(template.fields, p).map((f) => (
                        <FieldOverlay
                          key={f.id}
                          field={f}
                          value={valueFor(f)}
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

function fieldsPaintOrder(fields: PdfFormField[], page: number): PdfFormField[] {
  return fields
    .filter((f) => f.page === page)
    .slice()
    .sort((a, b) => b.wPct * b.hPct - a.wPct * a.hPct);
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
  const hasValue = field.type === "checkbox" ? !!value : value.trim().length > 0;
  if (!hasValue) return null;

  const fontPx = overlayFontSizePx(field.fontSize, pageWidth, renderW, box.h * pageHeight);
  const multiline = field.type === "textarea";

  return (
    <div
      className="absolute box-border flex min-h-0 min-w-0 overflow-hidden"
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
        {field.type === "checkbox" ? "✓" : value}
      </span>
    </div>
  );
}

function overlayHtml(
  field: PdfFormField,
  value: string,
  pageWidth: number,
  renderW: number,
  pageHeight: number,
): string {
  const hasValue = field.type === "checkbox" ? !!value : value.trim().length > 0;
  if (!hasValue) return "";
  const box = fieldOverlayBox(field);
  const fontPx = overlayFontSizePx(field.fontSize, pageWidth, renderW, box.h * pageHeight);
  const justify = overlayJustify(field.align);
  const alignItems = field.type === "textarea" ? "flex-start" : "center";
  const whiteSpace = field.type === "textarea" ? "pre-wrap" : "nowrap";
  const content =
    field.type === "checkbox"
      ? "✓"
      : escapeHtml(value).replace(/\n/g, "<br/>");
  return `<div style="position:absolute;left:${(box.x * 100).toFixed(3)}%;top:${(box.y * 100).toFixed(3)}%;width:${(box.w * 100).toFixed(3)}%;height:${(box.h * 100).toFixed(3)}%;display:flex;align-items:${alignItems};justify-content:${justify};color:${field.color};font-size:${fontPx}px;line-height:1.15;white-space:${whiteSpace};overflow:hidden;box-sizing:border-box;background:#fff;padding:0 2px;font-weight:400;">${content}</div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
