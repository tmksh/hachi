/**
 * PDF 上のラベル（会社名 / 工事名称 / 金額 など）から値欄を推定し、
 * 新規項目の配置候補を作る。保存済みの配置や連携元は変更しない。
 */

import { type PdfFormField } from "@/lib/pdf-form-template";

export type PdfTextItem = { str: string; x: number; yTop: number; w: number };
export type OverlayBox = { x: number; y: number; w: number; h: number };

export type FormSlotKind =
  | "postal"
  | "address_contractor"
  | "address_orderer"
  | "company_contractor"
  | "company_orderer"
  | "construction_title"
  | "construction_place"
  | "construction_no"
  | "period"
  | "payment"
  | "issue_date"
  | "quantity"
  | "amount"
  | "subtotal"
  | "tax"
  | "total"
  | "printed";

export type SlotFillData = {
  orderAmount?: number | null;
  constructionTitle?: string | null;
  constructionNo?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  customerName?: string | null;
  customerAddress?: string | null;
  customerCompanyName?: string | null;
};

export type FormSlot = OverlayBox & { id: string; kind: FormSlotKind; autoPlace?: boolean };

type TextRun = PdfTextItem & { h: number };

type PdfJsTextContent = {
  items: Array<{ str?: string; transform?: number[]; width?: number }>;
};

export function textItemsFromPdfContent(
  textContent: PdfJsTextContent,
  pageHeight: number,
): PdfTextItem[] {
  const out: PdfTextItem[] = [];
  for (const it of textContent.items) {
    if (typeof it.str !== "string" || !it.str.trim()) continue;
    const t = it.transform;
    if (!Array.isArray(t) || t.length < 6) continue;
    // 縦書き・回転文字を水平方向のラベルとして誤認しない。
    if (Math.abs(t[1]) > 0.01 || Math.abs(t[2]) > 0.01 || t[0] <= 0) continue;
    const x = Number(t[4]);
    const yBottom = Number(t[5]);
    if (!Number.isFinite(x) || !Number.isFinite(yBottom)) continue;
    out.push({
      str: it.str,
      x,
      yTop: pageHeight - yBottom,
      w: Number(it.width) || 0,
    });
  }
  return out;
}

function pctBox(
  pageW: number,
  pageH: number,
  x: number,
  yTop: number,
  w: number,
  h: number,
): OverlayBox {
  return {
    x: clamp01(x / pageW),
    y: clamp01(yTop / pageH),
    w: clamp01(Math.max(0.02, w / pageW)),
    h: clamp01(Math.max(0.014, h / pageH)),
  };
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function normalize(s: string) {
  return s.normalize("NFKC").replace(/\s+/g, "").replace(/[　]/g, "");
}

function yenLike(s: string) {
  const n = normalize(s);
  if (!/\d/.test(n)) return false;
  if (/[¥¥\\]/.test(n)) return true;
  return /^\d{1,3}(,\d{3})+$/.test(n);
}

/**
 * 同じ行の文字を左から結合してラベルを探す。
 * 発注書は「合　　　計」「⼯ 事 名 称」のように字間が広く、
 * かつ康煕部首（⼯→工）が混ざるため、隣接ギャップでは見つからない。
 */
function findLabels(
  items: PdfTextItem[],
  target: string,
  opts?: { xMax?: number; xMin?: number },
): TextRun[] {
  const needle = normalize(target);
  if (!needle) return [];
  const filtered = items.filter((it) => {
    if (opts?.xMax != null && it.x > opts.xMax) return false;
    if (opts?.xMin != null && it.x < opts.xMin) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => a.yTop - b.yTop || a.x - b.x);
  const rows: PdfTextItem[][] = [];
  for (const it of sorted) {
    const last = rows[rows.length - 1];
    if (!last || Math.abs(it.yTop - last[0].yTop) > 8) rows.push([it]);
    else last.push(it);
  }
  const found: TextRun[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    let acc = "";
    const pieces: { start: number; end: number; it: PdfTextItem }[] = [];
    for (const it of row) {
      const n = normalize(it.str);
      if (!n) continue;
      pieces.push({ start: acc.length, end: acc.length + n.length, it });
      acc += n;
    }
    let from = 0;
    while (from < acc.length) {
      const idx = acc.indexOf(needle, from);
      if (idx < 0) break;
      const end = idx + needle.length;
      const used = pieces.filter((p) => p.end > idx && p.start < end);
      from = end;
      if (used.length === 0) continue;
      // 「工事名」が「工事名称」の一部分に一致したり、本文中に一致するのを防ぐ。
      if (used[0].start !== idx || used[used.length - 1].end !== end) continue;
      const x0 = Math.min(...used.map((p) => p.it.x));
      const x1 = Math.max(...used.map((p) => p.it.x + p.it.w));
      const y0 = used.reduce((s, p) => s + p.it.yTop, 0) / used.length;
      found.push({ str: needle, x: x0, yTop: y0, w: Math.max(1, x1 - x0), h: 12 });
    }
  }
  return found;
}

function findLabel(
  items: PdfTextItem[],
  target: string,
  opts?: { xMax?: number; xMin?: number },
): TextRun | undefined {
  return findLabels(items, target, opts)[0];
}

function skipValueToken(s: string) {
  const n = normalize(s);
  return /^(御中|担当者|印|氏名|年|月|日|〜|～|~|\(|\)|（|）)$/.test(n);
}

function valuesRightOf(
  items: PdfTextItem[],
  label: TextRun,
  maxX: number,
): PdfTextItem[] {
  return items
    .filter(
      (r) =>
        r.x >= label.x + label.w + 6
        && r.x < maxX
        && Math.abs(r.yTop - label.yTop) < 16
        && r.str.trim()
        && !skipValueToken(r.str),
    )
    .sort((a, b) => a.x - b.x);
}

function yenOnRow(items: PdfTextItem[], label: TextRun, pageW: number): PdfTextItem | undefined {
  return items
    .filter(
      (r) => yenLike(r.str) && r.x > pageW * 0.42 && Math.abs(r.yTop - label.yTop) < 12,
    )
    .sort((a, b) => a.x - b.x)[0];
}

/**
 * ページ内テキストから、差し込み先の値欄を作る。
 * 座標はページ幅・高さに対する比率（CSS top-left）。
 */
export function buildFormSlots(
  items: PdfTextItem[],
  pageW: number,
  pageH: number,
): FormSlot[] {
  if (pageW < 1 || pageH < 1 || items.length === 0) return [];
  const slots: FormSlot[] = [];
  const box = (id: string, kind: FormSlotKind, x: number, y: number, w: number, h: number): FormSlot => ({
    id,
    kind,
    ...pctBox(pageW, pageH, x, y, w, h),
  });

  const around = (yBaseline: number, h = 22) => ({ y: yBaseline - 13, h });

  const valueSlot = (
    id: string,
    kind: FormSlotKind,
    label: TextRun,
    maxX: number,
    fallbackW: number,
    minW = 64,
  ) => {
    const hits = valuesRightOf(items, label, maxX);
    const x = (hits[0]?.x ?? label.x + label.w + 10) - 2;
    const available = Math.min(pageW - 4, maxX - 2) - x;
    if (available < 16) return;
    const x1 = hits.length > 0
      ? Math.max(...hits.map((h) => h.x + Math.max(h.w, 6)))
      : x + fallbackW;
    const yTop = hits.length > 0
      ? hits.reduce((s, h) => s + h.yTop, 0) / hits.length
      : label.yTop;
    const { y, h } = around(yTop, 22);
    slots.push({ ...box(`${id}_${slots.length}`, kind, x, y, Math.min(available, Math.max(minW, Math.max(x1 - x + 8, fallbackW))), h),
      autoPlace: hits.length === 0 && !["company_orderer", "company_contractor", "address_orderer", "address_contractor"].includes(kind),
    });
  };

  const postalMark = findLabel(items, "〒", { xMax: pageW * 0.45 }) ?? findLabel(items, "郵便番号", { xMax: pageW * 0.45 });
  if (postalMark) {
    const ph = items.find(
      (r) => /※/.test(r.str) && r.x > postalMark.x && r.x < pageW * 0.48 && Math.abs(r.yTop - postalMark.yTop) < 10,
    );
    const r = ph ?? postalMark;
    const { y, h } = around(r.yTop, 20);
    slots.push(box("postal", "postal", r.x, y, Math.max(r.w, 88), h));
  }

  for (const lab of findLabels(items, "住所")) {
    const left = lab.x < pageW * 0.42;
    valueSlot(
      left ? "address_contractor" : "address_orderer",
      left ? "address_contractor" : "address_orderer",
      lab,
      left ? pageW * 0.5 : pageW * 0.98,
      140,
      80,
    );
  }

  for (const lab of findLabels(items, "会社名")) {
    const left = lab.x < pageW * 0.42;
    valueSlot(
      left ? "company_contractor" : "company_orderer",
      left ? "company_contractor" : "company_orderer",
      lab,
      left ? pageW * 0.5 : pageW * 0.98,
      130,
      80,
    );
  }

  const kokiLabel = findLabel(items, "工期");
  const titleLabels = [...findLabels(items, "工事名称"), ...findLabels(items, "工事名"), ...findLabels(items, "案件名")];
  const titleLabel = titleLabels[0];
  // 別の行の「工期開始」を右隣の欄と誤認すると、名称欄の幅が潰れる。
  const periodOnTitleRow = kokiLabel && titleLabel
    && kokiLabel.x > titleLabel.x + titleLabel.w
    && Math.abs(kokiLabel.yTop - titleLabel.yTop) < 16;
  const titleMax = periodOnTitleRow ? kokiLabel.x - 6 : pageW * 0.98;
  for (const label of titleLabels) {
    const nextLabel = items.filter((item) => item.x > label.x + label.w
      && Math.abs(item.yTop - label.yTop) < 8
      && /^(工期|工期開始|工期終了|会社名|数量|金額|小計|合計|消費税|工事番号|工事名称|工事名|案件名)$/.test(normalize(item.str)))
      .sort((a, b) => a.x - b.x)[0];
    valueSlot("construction_title", "construction_title", label, nextLabel ? nextLabel.x - 6 : pageW * 0.98, 160, 80);
  }

  const placeLabel = findLabel(items, "工事場所");
  if (placeLabel) valueSlot("construction_place", "construction_place", placeLabel, titleMax, 160, 80);

  const mansionLabel = findLabel(items, "マンション名");
  if (mansionLabel) {
    const hits = valuesRightOf(items, mansionLabel, titleMax);
    if (hits.length > 0) {
      valueSlot("mansion_sample", "printed", mansionLabel, titleMax, 120, 60);
    }
  }

  if (kokiLabel) {
    const hits = valuesRightOf(items, kokiLabel, pageW * 0.98);
    const x = (hits[0]?.x ?? kokiLabel.x + kokiLabel.w + 8) - 4;
    const x1 = hits.length > 0 ? Math.max(...hits.map((h) => h.x + h.w)) : x + 140;
    const yTop = hits[0]?.yTop ?? kokiLabel.yTop;
    const { y, h } = around(yTop, 22);
    slots.push(box("period", "period", x, y, Math.max(90, x1 - x + 10), h));
  }

  const payLabel = findLabel(items, "支払条件");
  if (payLabel) {
    valueSlot("payment", "payment", payLabel, pageW * 0.98, 100, 70);
  }

  const noLabel = findLabel(items, "発注No") ?? findLabel(items, "発注番号");
  if (noLabel) {
    valueSlot("construction_no", "construction_no", noLabel, kokiLabel?.x ?? pageW * 0.55, 90, 50);
  }

  const hatchu = findLabel(items, "発注者");
  if (hatchu) {
    const stars = items
      .filter(
        (r) =>
          /※/.test(r.str)
          && r.x > pageW * 0.48
          && r.yTop > hatchu.yTop + 2
          && r.yTop < hatchu.yTop + 86,
      )
      .sort((a, b) => a.yTop - b.yTop || a.x - b.x);
    const starRows: PdfTextItem[][] = [];
    for (const it of stars) {
      const last = starRows.at(-1);
      if (!last || Math.abs(it.yTop - last[0].yTop) > 8) starRows.push([it]);
      else last.push(it);
    }
    starRows.forEach((row, i) => {
      const x = Math.min(...row.map((r) => r.x)) - 4;
      const x1 = Math.max(...row.map((r) => r.x + r.w));
      const { y, h } = around(row[0].yTop, 20);
      const cand = box(`orderer_star_${i}`, "printed", x, y, Math.max(x1 - x + 8, 48), h);
      if (!slots.some((s) => overlap(s, cand) >= 0.4)) slots.push(cand);
    });
  }

  const yearTok = items.find(
    (r) =>
      r.yTop < pageH * 0.16
      && r.x > pageW * 0.52
      && /^(19|20)\d{2}$/.test(normalize(r.str)),
  );
  if (yearTok) {
    const row = items.filter((r) => Math.abs(r.yTop - yearTok.yTop) < 10 && r.x >= yearTok.x - 2);
    const x1 = Math.max(...row.map((r) => r.x + r.w), yearTok.x + 80);
    const { y, h } = around(yearTok.yTop, 20);
    slots.push(box("issue_date", "issue_date", yearTok.x - 4, y, Math.max(x1 - yearTok.x + 10, 90), h));
  }

  const circleItems = items.filter(
    (r) =>
      /[○◯〇]/.test(r.str)
      && r.yTop > pageH * 0.32
      && r.yTop < pageH * 0.55
      && r.x > pageW * 0.45,
  );
  const circleRows: PdfTextItem[][] = [];
  for (const it of circleItems.sort((a, b) => a.yTop - b.yTop || a.x - b.x)) {
    const last = circleRows.at(-1);
    if (!last || Math.abs(it.yTop - last[0].yTop) > 8) circleRows.push([it]);
    else last.push(it);
  }
  circleRows.forEach((row, i) => {
    const x = Math.min(...row.map((r) => r.x)) - 4;
    const x1 = Math.max(
      ...row.map((r) => r.x + r.w),
      ...items
        .filter((r) => normalize(r.str) === "時" && r.x > row[0].x && Math.abs(r.yTop - row[0].yTop) < 12)
        .map((r) => r.x + r.w),
    );
    const { y, h } = around(row[0].yTop, 20);
    const cand = box(`circle_${i}`, "printed", x, y, Math.max(x1 - x + 16, 36), h);
    if (!slots.some((s) => overlap(s, cand) >= 0.4)) slots.push(cand);
  });

  const tokkiLabel = findLabel(items, "特記事項");
  const subtotalLabel = findLabel(items, "請負代金小計") ?? findLabel(items, "小計");
  const tableRight = tokkiLabel ? tokkiLabel.x - 4 : pageW * 0.7;
  const lineBottom = subtotalLabel ? subtotalLabel.yTop - 6 : pageH * 0.78;

  const moneyBox = (id: string, kind: FormSlotKind, label: TextRun) => {
    const yen = yenOnRow(items, label, pageW);
    const x = (yen?.x ?? Math.max(label.x + label.w + 8, pageW * 0.48)) - 8;
    const w = Math.max(64, tableRight - x);
    const { y, h } = around(yen?.yTop ?? label.yTop);
    // 表の罫線を解析していないため、金額欄の推測位置は確認用途に限定する。
    slots.push({ ...box(id, kind, x, y, w, h), autoPlace: false });
  };

  const qtyLabel = findLabel(items, "数量");
  const unitHdr = qtyLabel ? findLabel(items, "単位", { xMin: qtyLabel.x + 6 }) : undefined;
  if (qtyLabel) {
    const shiki = items
      .filter(
        (r) =>
          normalize(r.str) === "式"
          && r.x > qtyLabel.x
          && r.yTop > qtyLabel.yTop + 2
          && r.yTop < qtyLabel.yTop + 44,
      )
      .sort((a, b) => a.x - b.x)[0];
    const colRight = (shiki?.x ?? unitHdr?.x ?? qtyLabel.x + 36) - 1;
    const colLeft = qtyLabel.x - 2;
    const nums = items
      .filter(
        (r) =>
          /^\d+$/.test(normalize(r.str))
          && r.x >= colLeft - 8
          && r.x < colRight + 8
          && r.yTop > qtyLabel.yTop + 3
          && r.yTop < lineBottom,
      )
      .sort((a, b) => a.yTop - b.yTop);
    const rows = nums.length > 0 ? nums : [{ x: colLeft, yTop: qtyLabel.yTop + 16, w: 10, str: "" }];
    rows.forEach((row, i) => {
      const x = Math.min(colLeft, row.x - 4);
      const { y, h } = around(row.yTop);
      slots.push(box(`quantity_${i}`, "quantity", x, y, Math.max(16, colRight - x), h));
    });
  }

  const amountLabel = findLabel(items, "金額");
  if (amountLabel) {
    const colLeft = amountLabel.x - 2;
    const colRight = Math.max(colLeft + 36, tableRight);
    const yens = items
      .filter(
        (r) =>
          yenLike(r.str)
          && r.x >= colLeft - 16
          && r.x < colRight + 10
          && r.yTop > amountLabel.yTop + 6
          && r.yTop < lineBottom,
      )
      .sort((a, b) => a.yTop - b.yTop);
    const rows: Array<{ x: number; yTop: number }> = yens.length > 0 ? yens : [{ x: colLeft + 8, yTop: amountLabel.yTop + 16 }];
    rows.forEach((row, i) => {
      const x = Math.min(colLeft, row.x - 8);
      const { y, h } = around(row.yTop);
      slots.push(box(`amount_${i}`, "amount", x, y, Math.max(36, colRight - x), h));
    });
  }

  if (subtotalLabel) moneyBox("subtotal", "subtotal", subtotalLabel);

  const taxLabel = findLabel(items, "消費税等") ?? findLabel(items, "消費税");
  if (taxLabel) moneyBox("tax", "tax", taxLabel);

  const totalLabel = findLabel(items, "合計");
  if (totalLabel) moneyBox("total", "total", totalLabel);

  const doneLabel = findLabel(items, "完了時");
  if (doneLabel) {
    const yen = items
      .filter(
        (r) =>
          yenLike(r.str)
          && r.x > doneLabel.x
          && Math.abs(r.yTop - doneLabel.yTop) < 14,
      )
      .sort((a, b) => a.x - b.x)[0];
    if (yen) {
      const { y, h } = around(yen.yTop);
      slots.push(box("completion_yen", "printed", yen.x - 8, y, Math.max(yen.w + 20, 64), h));
    }
  }

  if (qtyLabel) {
    const units = items
      .filter(
        (r) =>
          normalize(r.str) === "式"
          && r.yTop > qtyLabel.yTop + 2
          && r.yTop < lineBottom,
      )
      .sort((a, b) => a.yTop - b.yTop);
    units.forEach((row, i) => {
      const { y, h } = around(row.yTop);
      slots.push(box(`unit_${i}`, "printed", row.x - 3, y, Math.max(row.w + 10, 18), h));
    });
  }

  findLabels(items, "別紙内訳書").forEach((run, i) => {
    const { y, h } = around(run.yTop, 22);
    slots.push(box(`linedesc_${i}`, "printed", run.x - 2, y, Math.max(run.w + 48, 90), h));
  });

  findLabels(items, "あいうえ").forEach((run, i) => {
    const cand = { x: run.x / pageW, y: (run.yTop - 13) / pageH, w: Math.max(run.w + 12, 40) / pageW, h: 22 / pageH };
    if (slots.some((s) => overlap(s, cand) >= 0.3)) return;
    const { y, h } = around(run.yTop);
    slots.push(box(`sample_aiue_${i}`, "printed", run.x - 2, y, Math.max(run.w + 16, 48), h));
  });

  return slots.filter((slot) => [slot.x, slot.y, slot.w, slot.h].every(Number.isFinite)
    && slot.x + slot.w <= 1 && slot.y + slot.h <= 1);
}

function overlap(a: OverlayBox, b: OverlayBox) {
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const inter = ix * iy;
  const area = Math.max(a.w * a.h, 1e-6);
  return inter / area;
}

function kindsForField(field: PdfFormField): FormSlotKind[] {
  switch (field.binding) {
    case "customer_address":
      return [];
    case "customer_company_name":
    case "customer_name":
      // 帳票の左右だけで顧客・自社・協力会社を決めない。
      return [];
    case "construction_title":
      return ["construction_title"];
    case "construction_no":
      return ["construction_no"];
    case "start_date":
    case "end_date":
      // 開始日と終了日を同じ工期欄に重ねない。
      return [];
    case "today":
      return ["issue_date"];
    case "order_amount":
      return ["subtotal"];
    case "order_amount_tax":
      return ["total"];
    default:
      break;
  }
  const label = `${field.label ?? ""}${field.text ?? ""}`;
  if (field.binding === "manual" && /郵便/.test(label)) return ["postal"];
  if (field.type === "number" && field.binding === "manual") {
    if (/数量/.test(field.label)) return ["quantity"];
    if (/消費税/.test(field.label)) return ["tax"];
    if (/合計/.test(field.label)) return ["total"];
    if (/小計/.test(field.label)) return ["subtotal"];
    return [];
  }
  if (field.binding === "manual" && /工事名称|名称/.test(field.label)) return ["construction_title"];
  if (field.binding === "manual" && /住所/.test(field.label) && !/工事場所/.test(field.label)) {
    return ["address_orderer"];
  }
  return [];
}

/**
 * binding / ラベルから値欄へ載せる。会社名セルに金額が乗る、数値セルが工事名称に乗る、を防ぐ。
 */
export function snapFieldsToSlots(fields: PdfFormField[], slots: FormSlot[]): PdfFormField[] {
  if (slots.length === 0) return fields;
  const used = new Set<string>();
  return fields.map((field) => {
    const kinds = kindsForField(field);
    if (kinds.length === 0) return field;
    const chosen = kinds
      .map((kind) => slots.find((s) => s.kind === kind && !used.has(s.id)))
      .find((s): s is FormSlot => !!s);
    if (!chosen) return field;
    used.add(chosen.id);
    const align =
      chosen.kind === "quantity" ? "center"
        : chosen.kind === "amount" || chosen.kind === "subtotal" || chosen.kind === "total" || chosen.kind === "tax"
          ? "right"
          : field.align;
    return { ...field, xPct: chosen.x, yPct: chosen.y, wPct: chosen.w, hPct: chosen.h, align };
  });
}

export async function slotsFromPdfPage(
  page: { getTextContent: () => PromiseLike<unknown>; getViewport: (o: { scale: number }) => { width: number; height: number; rotation?: number; viewBox?: number[] } },
): Promise<FormSlot[]> {
  const vp = page.getViewport({ scale: 1 });
  // 座標原点や向きが違うPDFでは推定を使わず、表示上の明示配置を使う。
  if ((vp.rotation ?? 0) % 360 !== 0 || (vp.viewBox && (vp.viewBox[0] !== 0 || vp.viewBox[1] !== 0))) return [];
  const text = await page.getTextContent();
  return buildFormSlots(textItemsFromPdfContent(textContentSafe(text), vp.height), vp.width, vp.height);
}

function textContentSafe(text: unknown): PdfJsTextContent {
  if (text && typeof text === "object" && Array.isArray((text as PdfJsTextContent).items)) {
    return text as PdfJsTextContent;
  }
  return { items: [] };
}

export function slotPlacementForPalette(
  binding: PdfFormField["binding"],
  type: PdfFormField["type"],
  label: string,
  slots: FormSlot[],
  taken: OverlayBox[],
): OverlayBox | null {
  const fake: PdfFormField = {
    id: "_",
    page: 0,
    type,
    label,
    binding,
    xPct: 0,
    yPct: 0,
    wPct: 0.1,
    hPct: 0.02,
    fontSize: 12,
    color: "#111",
    align: "left",
  };
  const kinds = kindsForField(fake);
  const candidates = slots.filter((s) => kinds.includes(s.kind));
  if (candidates.length !== 1 || candidates[0].autoPlace === false) return null;
  const slot = candidates[0];
  if (taken.some((t) => Math.min(t.x + t.w, slot.x + slot.w) > Math.max(t.x, slot.x)
    && Math.min(t.y + t.h, slot.y + slot.h) > Math.max(t.y, slot.y))) return null;
  return slot;
}

const COVER_SLOT_KINDS: FormSlotKind[] = [
  "tax",
  "amount",
  "quantity",
  "printed",
  "address_contractor",
  "address_orderer",
  "company_contractor",
  "company_orderer",
  "construction_title",
  "construction_place",
  "construction_no",
  "period",
  "payment",
  "issue_date",
  "subtotal",
  "total",
];

/**
 * 差し込み項目が載っていない印刷サンプルを白で覆う。
 * 契約データがあれば会社名・工事名・工期・税額などを載せる。
 */
export function leftoverSlotOverlays(
  slots: FormSlot[],
  placed: PdfFormField[],
  page: number,
  fill: SlotFillData | number | null | undefined,
): PdfFormField[] {
  if (slots.length === 0) return [];
  const ctx: SlotFillData = typeof fill === "number" ? { orderAmount: fill } : fill ?? {};
  return slots
    .filter((s) => COVER_SLOT_KINDS.includes(s.kind))
    .filter((s) => !placed.some((f) => overlap({ x: f.xPct, y: f.yPct, w: f.wPct, h: f.hPct }, s) >= 0.35))
    .map((s) => ({
      id: `__cover_${s.id}`,
      page,
      type: "text" as const,
      label: s.kind,
      binding: "manual" as const,
      text: autoValueForSlot(s.kind, ctx),
      xPct: s.x,
      yPct: s.y,
      wPct: s.w,
      hPct: s.h,
      fontSize: 11,
      color: "#111111",
      align:
        s.kind === "quantity" ? "center" as const
          : s.kind === "amount" || s.kind === "subtotal" || s.kind === "total" || s.kind === "tax"
            ? "right" as const
            : "left" as const,
    }));
}

function fmtSlashDate(iso?: string | null) {
  if (!iso) return "";
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${m[1]}/${Number(m[2])}/${Number(m[3])}`;
}

function autoValueForSlot(kind: FormSlotKind, ctx: SlotFillData): string {
  const amount = ctx.orderAmount;
  const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`;
  switch (kind) {
    case "tax":
      return amount != null && Number.isFinite(amount) ? yen(amount * 0.1) : "";
    case "subtotal":
      return amount != null && Number.isFinite(amount) ? yen(amount) : "";
    case "total":
      return amount != null && Number.isFinite(amount) ? yen(amount * 1.1) : "";
    case "construction_title":
      return (ctx.constructionTitle ?? "").trim();
    case "construction_no":
      return (ctx.constructionNo ?? "").trim();
    case "period": {
      const a = fmtSlashDate(ctx.startDate);
      const b = fmtSlashDate(ctx.endDate);
      if (a && b) return `${a} ～ ${b}`;
      return a || b;
    }
    case "issue_date": {
      const now = new Date();
      return `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日`;
    }
    default:
      return "";
  }
}
