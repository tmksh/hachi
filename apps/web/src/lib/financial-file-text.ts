"use client";

/**
 * 決算書ファイル読込（No.91）用: PDF / Excel / CSV からテキストを抽出する。
 * ブラウザ側で抽出したテキストを Server Action（importFinancialActualsFromText）へ渡す。
 * OCR は行わない（テキスト埋め込みPDFのみ対応）。
 */

const MAX_TEXT_LENGTH = 60_000;

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function loadPdfjs() {
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

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await loadPdfjs();
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;

  const pages: string[] = [];
  for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();
    // Y座標の変化で改行を復元する（表形式の書類を行単位でLLMに渡すため）
    let lastY: number | null = null;
    let text = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = item.transform[5] as number;
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        text += "\n";
      } else if (text && !text.endsWith("\n")) {
        text += " ";
      }
      text += item.str;
      lastY = y;
    }
    pages.push(text);
  }
  await doc.destroy();
  return pages.join("\n\n");
}

async function extractExcelText(file: File): Promise<string> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  return workbook.SheetNames.map((name) => {
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name]);
    return `【シート: ${name}】\n${csv}`;
  }).join("\n\n");
}

/**
 * アップロードされたファイル（PDF / Excel / CSV）からテキストを抽出する。
 * 対応外の拡張子はエラーを投げる。
 */
export async function extractFinancialFileText(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  let text: string;
  if (ext === "csv" || ext === "txt" || ext === "tsv") {
    text = await file.text();
  } else if (ext === "xlsx" || ext === "xls") {
    text = await extractExcelText(file);
  } else if (ext === "pdf") {
    text = await extractPdfText(file);
  } else {
    throw new Error("対応していないファイル形式です（PDF / Excel / CSV のみ）");
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("ファイルからテキストを抽出できませんでした（画像のみのPDFは非対応です）");
  }
  return trimmed.slice(0, MAX_TEXT_LENGTH);
}
