/** 全国加盟店BIレポートを日本語対応の PDF としてダウンロードする */

const PAGE_W = 595;
const PAGE_H = 842;
const SCALE = 2;
const CW = PAGE_W * SCALE;
const CH = PAGE_H * SCALE;
const M = 56;
const BOTTOM = CH - 48;

const FONT = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", sans-serif';

const STATUS_LABEL: Record<string, string> = {
  preparing: "準備中",
  in_progress: "進行中",
  completed: "完了",
  suspended: "中止",
  delayed: "遅延",
};

export type AdminBiPdfInput = {
  stats: { companyCount: number; userCount: number; constructionCount: number; contractCount: number };
  bi: {
    totalRevenue: number;
    totalGross: number;
    totalCost: number;
    grossRateWeighted: number;
    grossRateAvg: number;
    avgUnitPrice: number;
    constructionCount: number;
    companyCount: number;
    activeCompanyCount: number;
    inProgressCount: number;
    completedCount: number;
    customerCount: number;
  } | null;
  status: Record<string, number> | null;
  dist: Array<{ key: string; label: string; count: number }>;
  trend: Array<{ label: string; revenue: number; gross: number; count: number }>;
  ranking: Array<{
    companyName: string;
    constructionCount: number;
    completedCount: number;
    revenue: number;
    gross: number;
    grossRate: number;
    avgUnitPrice: number;
  }>;
};

function yen(n: number) {
  return `¥${Math.round(n).toLocaleString()}`;
}

function compactYen(n: number) {
  const abs = Math.abs(n);
  if (abs >= 100_000_000) return `¥${(n / 100_000_000).toFixed(1)}億`;
  if (abs >= 10_000) return `¥${Math.round(n / 10_000).toLocaleString()}万`;
  return yen(n);
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function cssVar(name: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function concatBytes(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function canvasesToPdfBlob(canvases: HTMLCanvasElement[]): Promise<Blob> {
  const images: { w: number; h: number; jpeg: Uint8Array }[] = [];
  for (const canvas of canvases) {
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PDF画像の生成に失敗しました"))), "image/jpeg", 0.92);
    });
    images.push({ w: canvas.width, h: canvas.height, jpeg: new Uint8Array(await blob.arrayBuffer()) });
  }

  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let pos = 0;
  const push = (data: Uint8Array | string) => {
    const bytes = typeof data === "string" ? enc.encode(data) : data;
    chunks.push(bytes);
    pos += bytes.length;
  };

  const objStarts: number[] = [];
  const startObj = () => {
    objStarts.push(pos);
  };

  push("%PDF-1.4\n%\x80\x80\x80\x80\n");

  const n = images.length;
  const pageIds = images.map((_, i) => 3 + i * 3);

  startObj();
  push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  startObj();
  push(`2 0 obj\n<< /Type /Pages /Count ${n} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>\nendobj\n`);

  for (let i = 0; i < n; i++) {
    const pageId = 3 + i * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const img = images[i];
    const content = `q ${PAGE_W} 0 0 ${PAGE_H} 0 0 cm /Im${i} Do Q\n`;

    startObj();
    push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${contentId} 0 R /Resources << /XObject << /Im${i} ${imageId} 0 R >> >> >>\nendobj\n`,
    );
    startObj();
    push(`${contentId} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);
    startObj();
    push(
      `${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.jpeg.length} >>\nstream\n`,
    );
    push(img.jpeg);
    push("endstream\nendobj\n");
  }

  const xrefPos = pos;
  push(`xref\n0 ${objStarts.length + 1}\n`);
  push("0000000000 65535 f \n");
  for (const off of objStarts) {
    push(`${String(off).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${objStarts.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

  return new Blob([concatBytes(chunks) as BlobPart], { type: "application/pdf" });
}

type Painter = {
  pages: HTMLCanvasElement[];
  ctx: CanvasRenderingContext2D;
  y: number;
  dark: string;
  light: string;
  mid: string;
  accent: string;
};

function makeCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = CW;
  canvas.height = CH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("キャンバスを初期化できませんでした");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CW, CH);
  return { canvas, ctx };
}

function newPage(p: Painter, isFirst: boolean, exportedAt: string) {
  const { canvas, ctx } = makeCanvas();
  p.pages.push(canvas);
  p.ctx = ctx;
  ctx.fillStyle = p.dark;
  ctx.fillRect(0, 0, CW, 10);

  ctx.fillStyle = p.dark;
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText("BRIDGE Linq", M, 40);
  ctx.fillStyle = "#64748b";
  ctx.font = `400 16px ${FONT}`;
  ctx.fillText("運営管理 ／ 全国加盟店BI", M + 170, 40);

  if (isFirst) {
    ctx.fillStyle = "#0f172a";
    ctx.font = `700 36px ${FONT}`;
    ctx.fillText("全国加盟店BIレポート", M, 92);
    ctx.fillStyle = "#64748b";
    ctx.font = `400 16px ${FONT}`;
    ctx.fillText(`出力日 ${exportedAt}`, M, 118);
    p.y = 148;
  } else {
    p.y = 68;
  }
}

function ensure(p: Painter, h: number, exportedAt: string) {
  if (p.y + h > BOTTOM) newPage(p, false, exportedAt);
}

function sectionTitle(p: Painter, title: string, exportedAt: string) {
  ensure(p, 40, exportedAt);
  p.ctx.fillStyle = p.dark;
  p.ctx.fillRect(M, p.y + 6, 8, 18);
  p.ctx.fillStyle = "#0f172a";
  p.ctx.font = `700 20px ${FONT}`;
  p.ctx.fillText(title, M + 18, p.y + 22);
  p.y += 36;
}

function drawKpiCards(
  p: Painter,
  items: Array<{ label: string; value: string; sub?: string }>,
  cols: number,
  exportedAt: string,
) {
  const gap = 12;
  const inner = CW - M * 2;
  const w = (inner - gap * (cols - 1)) / cols;
  const h = 72;
  const rows = Math.ceil(items.length / cols);
  ensure(p, rows * (h + gap), exportedAt);
  items.forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = M + col * (w + gap);
    const y = p.y + row * (h + gap);
    p.ctx.fillStyle = p.accent;
    roundRect(p.ctx, x, y, w, h, 12);
    p.ctx.fill();
    p.ctx.fillStyle = "#64748b";
    p.ctx.font = `600 12px ${FONT}`;
    p.ctx.fillText(item.label, x + 14, y + 22);
    p.ctx.fillStyle = "#0f172a";
    p.ctx.font = `700 22px ${FONT}`;
    p.ctx.fillText(item.value, x + 14, y + 48);
    if (item.sub) {
      p.ctx.fillStyle = "#64748b";
      p.ctx.font = `400 12px ${FONT}`;
      p.ctx.fillText(item.sub, x + 14, y + 64);
    }
  });
  p.y += rows * (h + gap) + 8;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawShareRows(
  p: Painter,
  rows: Array<{ label: string; value: string; share: number; color: string }>,
  exportedAt: string,
) {
  const h = rows.length * 28;
  ensure(p, h + 4, exportedAt);
  const barX = M + 220;
  const barW = CW - M - barX - 90;
  rows.forEach((row, i) => {
    const y = p.y + i * 28;
    p.ctx.fillStyle = row.color;
    p.ctx.beginPath();
    p.ctx.arc(M + 8, y + 10, 5, 0, Math.PI * 2);
    p.ctx.fill();
    p.ctx.fillStyle = "#334155";
    p.ctx.font = `500 14px ${FONT}`;
    p.ctx.fillText(row.label, M + 22, y + 15);
    p.ctx.fillStyle = p.accent;
    roundRect(p.ctx, barX, y + 4, barW, 10, 5);
    p.ctx.fill();
    if (row.share > 0) {
      p.ctx.fillStyle = row.color;
      roundRect(p.ctx, barX, y + 4, Math.max(4, (barW * Math.min(100, row.share)) / 100), 10, 5);
      p.ctx.fill();
    }
    p.ctx.fillStyle = "#0f172a";
    p.ctx.font = `600 13px ${FONT}`;
    p.ctx.textAlign = "right";
    p.ctx.fillText(`${row.value}  ${Math.round(row.share)}%`, CW - M, y + 15);
    p.ctx.textAlign = "left";
  });
  p.y += h + 12;
}

function drawTrend(p: Painter, trend: AdminBiPdfInput["trend"], exportedAt: string) {
  const chartH = 160;
  ensure(p, chartH + 28, exportedAt);
  const inner = CW - M * 2;
  const max = Math.max(1, ...trend.map((t) => Math.max(t.revenue, t.gross)));
  const groupW = inner / Math.max(1, trend.length);
  const axisY = p.y + chartH - 24;

  p.ctx.strokeStyle = "rgba(16,115,122,0.18)";
  p.ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = p.y + 8 + ((chartH - 40) * i) / 4;
    p.ctx.beginPath();
    p.ctx.moveTo(M, y);
    p.ctx.lineTo(CW - M, y);
    p.ctx.stroke();
  }

  trend.forEach((t, i) => {
    const gx = M + i * groupW + groupW * 0.18;
    const bw = groupW * 0.28;
    const revH = ((t.revenue / max) * (chartH - 48));
    const grossH = ((t.gross / max) * (chartH - 48));
    p.ctx.fillStyle = p.dark;
    roundRect(p.ctx, gx, axisY - revH, bw, Math.max(2, revH), 3);
    p.ctx.fill();
    p.ctx.fillStyle = p.mid;
    roundRect(p.ctx, gx + bw + 4, axisY - grossH, bw, Math.max(2, grossH), 3);
    p.ctx.fill();
    p.ctx.fillStyle = "#64748b";
    p.ctx.font = `400 12px ${FONT}`;
    p.ctx.textAlign = "center";
    p.ctx.fillText(t.label, M + i * groupW + groupW / 2, axisY + 18);
    p.ctx.textAlign = "left";
  });

  p.y += chartH;
  p.ctx.font = `500 12px ${FONT}`;
  p.ctx.fillStyle = p.dark;
  p.ctx.fillRect(M, p.y, 10, 10);
  p.ctx.fillStyle = "#334155";
  p.ctx.fillText("受注額", M + 16, p.y + 10);
  p.ctx.fillStyle = p.mid;
  p.ctx.fillRect(M + 80, p.y, 10, 10);
  p.ctx.fillStyle = "#334155";
  p.ctx.fillText("粗利", M + 96, p.y + 10);
  p.y += 28;
}

function drawRanking(p: Painter, ranking: AdminBiPdfInput["ranking"], exportedAt: string) {
  const cols = [
    { key: "rank", label: "#", w: 44 },
    { key: "name", label: "加盟店", w: 220 },
    { key: "n", label: "工事", w: 70 },
    { key: "done", label: "完了", w: 70 },
    { key: "rev", label: "受注額", w: 130 },
    { key: "gross", label: "粗利", w: 130 },
    { key: "rate", label: "粗利率", w: 90 },
    { key: "avg", label: "平均単価", w: 140 },
  ] as const;
  const rowH = 32;
  const headerH = 30;

  const drawHeader = () => {
    ensure(p, headerH + rowH, exportedAt);
    p.ctx.fillStyle = p.accent;
    roundRect(p.ctx, M, p.y, CW - M * 2, headerH, 8);
    p.ctx.fill();
    p.ctx.fillStyle = p.dark;
    p.ctx.font = `700 12px ${FONT}`;
    let x = M + 12;
    for (const col of cols) {
      p.ctx.fillText(col.label, x, p.y + 20);
      x += col.w;
    }
    p.y += headerH;
  };

  drawHeader();
  ranking.forEach((r, i) => {
    if (p.y + rowH > BOTTOM) {
      newPage(p, false, exportedAt);
      sectionTitle(p, "加盟店ランキング（続き）", exportedAt);
      drawHeader();
    }
    if (i % 2 === 0) {
      p.ctx.fillStyle = "rgba(229,244,246,0.45)";
      p.ctx.fillRect(M, p.y, CW - M * 2, rowH);
    }
    const cells = [
      String(i + 1),
      r.companyName,
      String(r.constructionCount),
      String(r.completedCount),
      compactYen(r.revenue),
      compactYen(r.gross),
      r.revenue > 0 ? pct(r.grossRate) : "—",
      r.constructionCount > 0 ? compactYen(r.avgUnitPrice) : "—",
    ];
    p.ctx.fillStyle = "#0f172a";
    p.ctx.font = `500 13px ${FONT}`;
    let x = M + 12;
    cells.forEach((cell, ci) => {
      const maxW = cols[ci].w - 8;
      let text = cell;
      while (p.ctx.measureText(text).width > maxW && text.length > 1) {
        text = `${text.slice(0, -2)}…`;
      }
      p.ctx.fillText(text, x, p.y + 21);
      x += cols[ci].w;
    });
    p.y += rowH;
  });
  p.y += 12;
}

function paintFooters(pages: HTMLCanvasElement[]) {
  pages.forEach((canvas, i) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#94a3b8";
    ctx.font = `400 13px ${FONT}`;
    ctx.fillText("BRIDGE Linq  運営管理レポート", M, CH - 22);
    ctx.textAlign = "right";
    ctx.fillText(`${i + 1} / ${pages.length}`, CW - M, CH - 22);
    ctx.textAlign = "left";
  });
}

export async function downloadAdminBiPdf(input: AdminBiPdfInput) {
  const dark = cssVar("--brand-dark", "#10737a");
  const light = cssVar("--brand-light", "#34d9e5");
  const mid = cssVar("--brand-mid", "#a0e4e9");
  const accent = cssVar("--brand-accent", "#e5f4f6");
  const exportedAt = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const p: Painter = {
    pages: [],
    ctx: undefined as unknown as CanvasRenderingContext2D,
    y: 0,
    dark,
    light,
    mid,
    accent,
  };
  newPage(p, true, exportedAt);

  const stats = input.stats;
  const bi = input.bi;
  sectionTitle(p, "プラットフォームKPI", exportedAt);
  drawKpiCards(
    p,
    [
      { label: "登録企業数", value: String(stats.companyCount) },
      { label: "総ユーザー数", value: String(stats.userCount) },
      { label: "工事案件数", value: String(stats.constructionCount) },
      { label: "契約書数", value: String(stats.contractCount) },
    ],
    4,
    exportedAt,
  );

  if (bi) {
    sectionTitle(p, "実績サマリ", exportedAt);
    drawKpiCards(
      p,
      [
        { label: "総受注金額", value: compactYen(bi.totalRevenue), sub: `${bi.constructionCount}件` },
        { label: "総粗利", value: compactYen(bi.totalGross), sub: pct(bi.grossRateWeighted) },
        { label: "平均単価", value: compactYen(bi.avgUnitPrice), sub: `${bi.companyCount}社` },
        { label: "平均粗利率", value: pct(bi.grossRateAvg) },
        { label: "アクティブ", value: `${bi.activeCompanyCount}/${bi.companyCount}`, sub: "直近30日" },
        { label: "進行中", value: String(bi.inProgressCount), sub: `完了 ${bi.completedCount}` },
        { label: "顧客数", value: bi.customerCount.toLocaleString() },
        { label: "総原価", value: compactYen(bi.totalCost) },
      ],
      4,
      exportedAt,
    );
  }

  if (input.status) {
    sectionTitle(p, "工事ステータス分布", exportedAt);
    const statusColors: Record<string, string> = {
      preparing: mid,
      in_progress: light,
      completed: dark,
      suspended: "#94a3b8",
      delayed: "#64748b",
    };
    const values = Object.keys(STATUS_LABEL).map((key) => input.status?.[key] ?? 0);
    const total = values.reduce((s, n) => s + n, 0) || 1;
    drawShareRows(
      p,
      (Object.keys(STATUS_LABEL) as Array<keyof typeof STATUS_LABEL>).map((key) => ({
        label: STATUS_LABEL[key],
        value: `${input.status?.[key] ?? 0}件`,
        share: ((input.status?.[key] ?? 0) / total) * 100,
        color: statusColors[key] ?? dark,
      })),
      exportedAt,
    );
  }

  if (input.dist.length) {
    sectionTitle(p, "加盟店粗利率分布", exportedAt);
    const distColors = [mid, light, "#1aa8b3", dark];
    const total = input.dist.reduce((s, r) => s + r.count, 0) || 1;
    drawShareRows(
      p,
      input.dist.map((row, i) => ({
        label: row.label.replace(/^粗利率\s*/, ""),
        value: `${row.count}社`,
        share: (row.count / total) * 100,
        color: distColors[i] ?? dark,
      })),
      exportedAt,
    );
  }

  if (input.trend.length) {
    sectionTitle(p, "月次トレンド（直近12ヶ月）", exportedAt);
    drawTrend(p, input.trend, exportedAt);
  }

  if (input.ranking.length) {
    sectionTitle(p, "加盟店ランキング", exportedAt);
    drawRanking(p, input.ranking, exportedAt);
  }

  paintFooters(p.pages);
  const blob = await canvasesToPdfBlob(p.pages);
  const stamp = new Intl.DateTimeFormat("sv-SE").format(new Date()).replace(/-/g, "");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `全国加盟店BI_${stamp}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
