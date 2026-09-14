import { fieldOverlayBox, overlayFontSizePx, overlayJustify, type PdfFormField } from "./pdf-form-template";

export function pdfFieldOverlayHtml(
  field: PdfFormField,
  value: string,
  pageWidth: number,
  renderW: number,
  pageHeight: number,
): string {
  const box = fieldOverlayBox(field);
  const boxH = box.h * pageHeight;
  const boxW = box.w * (renderW || pageWidth);
  const fontPx = overlayFontSizePx(field.fontSize, pageWidth, renderW, boxH, boxW, value, field.type === "textarea");
  const justify = overlayJustify(field.align);
  const alignItems = field.type === "textarea" ? "flex-start" : "center";
  const whiteSpace = field.type === "textarea" ? "pre-wrap" : "nowrap";
  const content =
    field.type === "textarea" ? escapePdfHtml(value).replace(/\n/g, "<br/>") : escapePdfHtml(value);
  return `<div style="position:absolute;left:${(box.x * 100).toFixed(3)}%;top:${(box.y * 100).toFixed(3)}%;width:${(box.w * 100).toFixed(3)}%;height:${(box.h * 100).toFixed(3)}%;display:flex;align-items:${alignItems};justify-content:${justify};color:${escapePdfHtml(field.color)};font-size:${fontPx}px;line-height:1.15;overflow:hidden;box-sizing:border-box;background:#fff;padding:0 2px;font-weight:400;"><span style="min-width:0;max-width:100%;overflow:hidden;white-space:${whiteSpace};overflow-wrap:break-word;">${content}</span></div>`;
}

export type PdfPrintPage = { width: number; height: number; image: string; overlays: string };

/** PDFのポイント寸法を保持し、縦横混在もページごとの用紙で出力する。 */
export function pdfPrintDocumentHtml(name: string, pages: PdfPrintPage[]): string {
  const rules = pages.map((p, i) => `@page pdfPage${i} { size:${p.width}pt ${p.height}pt; margin:0; }`).join("\n");
  const content = pages.map((p, i) => `<section class="sheet" style="page:pdfPage${i};width:${p.width}pt;height:${p.height}pt;"><div class="page" style="width:${p.width}px;height:${p.height}px;"><img src="${escapePdfHtml(p.image)}" style="position:absolute;inset:0;width:100%;height:100%;display:block;"/>${p.overlays}</div></section>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${escapePdfHtml(name)}</title><style>
    ${rules}
    * { box-sizing:border-box; }
    body { margin:0; font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif; }
    .sheet { position:relative; break-after:page; overflow:hidden; }
    .sheet:last-child { break-after:auto; }
    .page { position:absolute; top:0; left:0; transform:scale(1.33333333333333); transform-origin:top left; overflow:hidden; }
  </style></head><body>${content}</body></html>`;
}

export function escapePdfHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
