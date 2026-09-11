"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

/** pdfjs を遅延ロードし、ワーカーを設定して返す */
export async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

/** URL または ArrayBuffer から PDFDocumentProxy を読み込む */
export async function loadPdfDocument(src: string | ArrayBuffer): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfjs();
  const task =
    typeof src === "string"
      ? pdfjs.getDocument(src)
      : pdfjs.getDocument({ data: new Uint8Array(src) });
  return task.promise;
}

type Props = {
  doc: PDFDocumentProxy;
  pageNumber: number; // 1-based
  /** 描画幅(px)。高さは縦横比から自動 */
  width: number;
  onRendered?: (size: { width: number; height: number }) => void;
  className?: string;
  /**
   * PDF 注釈（AcroForm の見た目など）を描画するか。
   * 差し込みプレビューでは HTML オーバーレイと二重になるため false にする。
   */
  renderAnnotations?: boolean;
};

/** PDF の1ページを canvas に描画する */
export function PdfPageCanvas({
  doc,
  pageNumber,
  width,
  onRendered,
  className,
  renderAnnotations = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;

    (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = width / Math.max(baseViewport.width, 1);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        // 親要素のボックスにフィットさせ、inset-0 との寸法衝突で PDF がずれるのを防ぐ
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.display = "block";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        renderTask = page.render({
          canvas,
          canvasContext: ctx,
          viewport,
          annotationMode: renderAnnotations ? 1 : 0,
        } as Parameters<typeof page.render>[0]);
        await (renderTask as unknown as { promise: Promise<void> }).promise;
        if (!cancelled) {
          onRendered?.({ width: viewport.width, height: viewport.height });
        }
      } catch (e: unknown) {
        if (!cancelled && (e as Error)?.name !== "RenderingCancelledException") {
          setError("PDFの描画に失敗しました");
        }
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [doc, pageNumber, width, onRendered, renderAnnotations]);

  if (error) {
    return <div className="text-xs text-destructive p-4">{error}</div>;
  }
  return <canvas ref={canvasRef} className={className} />;
}
