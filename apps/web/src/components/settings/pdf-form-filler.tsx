"use client";

import { useEffect, useMemo, useState } from "react";
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
  const renderW = 560;

  const valueFor = (f: PdfFormField): string => values[f.id] ?? resolveFieldValue(f, ctx);

  useEffect(() => {
    setLoading(true);
    setDoc(null);
    let cancelled = false;
    (async () => {
      try {
        const url = await getPdfFormTemplateUrl(template.storagePath);
        if (!url) throw new Error("PDFを取得できませんでした");
        const d = await loadPdfDocument(url);
        if (cancelled) return;
        setDoc(d);
        const init: Record<string, string> = {};
        template.fields.forEach((f) => {
          init[f.id] = resolveFieldValue(f, ctx);
        });
        setValues(init);
      } catch (e: unknown) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "読み込みに失敗しました");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [template, ctx]);

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
      for (let p = 0; p < template.pageCount; p++) {
        const size = template.pageSizes[p];
        const page = await doc.getPage(p + 1);
        const scale = 2;
        const vp = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        const c = canvas.getContext("2d");
        if (!c) continue;
        await (
          page.render({ canvas, canvasContext: c, viewport: vp } as Parameters<typeof page.render>[0]) as unknown as {
            promise: Promise<void>;
          }
        ).promise;
        const img = canvas.toDataURL("image/jpeg", 0.92);

        const overlays = template.fields
          .filter((f) => f.page === p)
          .map((f) => {
            const v = valueFor(f);
            if (!v && f.type !== "checkbox") return "";
            const left = (f.xPct * 100).toFixed(3);
            const top = (f.yPct * 100).toFixed(3);
            const width = (f.wPct * 100).toFixed(3);
            const height = (f.hPct * 100).toFixed(3);
            const justify = f.align === "center" ? "center" : f.align === "right" ? "flex-end" : "flex-start";
            const content =
              f.type === "checkbox"
                ? v ? "✓" : ""
                : escapeHtml(v).replace(/\n/g, "<br/>");
            return `<div style="position:absolute;left:${left}%;top:${top}%;width:${width}%;height:${height}%;display:flex;align-items:center;justify-content:${justify};color:${f.color};font-size:${f.fontSize}px;line-height:1.2;white-space:pre-wrap;overflow:hidden;">${content}</div>`;
          })
          .join("");

        pagesHtml.push(
          `<div class="page" style="width:${size.width}px;height:${size.height}px;">
             <img src="${img}" style="position:absolute;inset:0;width:100%;height:100%;" />
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

  const aspect = template.pageSizes[0] ? template.pageSizes[0].height / template.pageSizes[0].width : 1.414;

  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden flex flex-col", className)}>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3 bg-muted/20">
        <p className="text-sm font-semibold truncate">{template.name}</p>
        {onClose && (
          <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0" onClick={onClose}>
            <X className="h-4 w-4 mr-1" />
            閉じる
          </Button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row min-h-[min(72vh,620px)] max-h-[min(80vh,720px)]">
        {/* 左：入力項目 */}
        <div className="w-full lg:w-80 shrink-0 overflow-y-auto border-b lg:border-b-0 lg:border-r bg-background p-4 space-y-4">
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

        {/* 右：プレビュー */}
        <div className="flex-1 overflow-auto bg-muted/30 p-5 min-h-[320px]">
          {loading || !doc ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="mx-auto space-y-4" style={{ maxWidth: renderW }}>
              {Array.from({ length: template.pageCount }).map((_, p) => {
                const h = renderW * (template.pageSizes[p]
                  ? template.pageSizes[p].height / template.pageSizes[p].width
                  : aspect);
                return (
                  <div
                    key={p}
                    className="relative mx-auto bg-white shadow"
                    style={{ width: renderW, height: h }}
                  >
                    <PdfPageCanvas
                      doc={doc}
                      pageNumber={p + 1}
                      width={renderW}
                      className="absolute inset-0"
                    />
                    {template.fields
                      .filter((f) => f.page === p)
                      .map((f) => {
                        const v = valueFor(f);
                        const justify =
                          f.align === "center" ? "center" : f.align === "right" ? "flex-end" : "flex-start";
                        return (
                          <div
                            key={f.id}
                            className="absolute flex items-center overflow-hidden whitespace-pre-wrap leading-tight"
                            style={{
                              left: `${f.xPct * 100}%`,
                              top: `${f.yPct * 100}%`,
                              width: `${f.wPct * 100}%`,
                              height: `${f.hPct * 100}%`,
                              color: f.color,
                              fontSize: f.fontSize * (renderW / (template.pageSizes[p]?.width ?? renderW)),
                              justifyContent: justify,
                            }}
                          >
                            {f.type === "checkbox" ? (v ? "✓" : "") : v}
                          </div>
                        );
                      })}
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
      <DialogContent className="w-[960px] max-w-[95vw] max-h-[90vh] overflow-hidden p-0 flex flex-col gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{template.name}</DialogTitle>
        </DialogHeader>
        <PdfFormFillerPanel
          template={template}
          ctx={ctx}
          onClose={() => onOpenChange(false)}
          className="border-0 rounded-none min-h-0 max-h-[85vh]"
        />
      </DialogContent>
    </Dialog>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
