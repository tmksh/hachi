export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const nice =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

export function buildTicks(max: number, count = 4): number[] {
  const ceiling = niceMax(max);
  const step = ceiling / count;
  return Array.from({ length: count + 1 }, (_, i) => Math.round(step * i))
    .filter((t, i, arr) => i === 0 || t !== arr[i - 1]);
}

// 上下で必要な分だけ軸を確保する非対称目盛り（財務P&L向け）
export function buildAsymmetricTicks(min: number, max: number, count = 4): number[] {
  const span = Math.max(max, 1) - Math.min(min, 0);
  const step = niceMax(span / count);
  const yMin = Math.floor(Math.min(min, 0) / step) * step;
  const yMax = Math.ceil(Math.max(max, step) / step) * step;
  const ticks: number[] = [];
  for (let v = yMin; v <= yMax + step * 0.001; v += step) {
    ticks.push(Math.round(v));
  }
  return ticks;
}

export function buildSignedTicks(min: number, max: number, count = 4): number[] {
  const absMax = Math.max(Math.abs(min), Math.abs(max), 1);
  const ceiling = niceMax(absMax);
  const step = ceiling / count;
  const ticks: number[] = [];
  for (let i = -count; i <= count; i += 1) {
    ticks.push(Math.round(step * i));
  }
  return ticks.filter((t, i, arr) => i === 0 || t !== arr[i - 1]);
}

export function linePath(
  points: Array<{ x: number; y: number }>,
): string {
  if (points.length === 0) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
}

export function areaPath(
  points: Array<{ x: number; y: number }>,
  baselineY: number,
): string {
  if (points.length === 0) return "";
  const top = linePath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${top} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
}

// Catmull-Rom → cubic bezier で滑らかな曲線を描く
export function smoothLinePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length < 3) return linePath(points);
  const d = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d.push(`C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`);
  }
  return d.join(" ");
}

export function smoothAreaPath(
  points: Array<{ x: number; y: number }>,
  baselineY: number,
): string {
  if (points.length === 0) return "";
  const top = smoothLinePath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${top} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
}

/** 積み上げエリア用: 上辺〜下辺の帯を滑らかに閉じる */
export function smoothBandPath(
  top: Array<{ x: number; y: number }>,
  bottom: Array<{ x: number; y: number }>,
): string {
  if (top.length === 0 || bottom.length === 0) return "";
  const topPath = smoothLinePath(top);
  const bottomRev = [...bottom].reverse();
  const bottomPath = smoothLinePath(bottomRev).replace(/^M/, "L");
  return `${topPath} ${bottomPath} Z`;
}

export function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleInDegrees: number,
) {
  const angle = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

export function describeDonutArc(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
): string {
  const startOuter = polarToCartesian(cx, cy, outerRadius, endAngle);
  const endOuter = polarToCartesian(cx, cy, outerRadius, startAngle);
  const startInner = polarToCartesian(cx, cy, innerRadius, startAngle);
  const endInner = polarToCartesian(cx, cy, innerRadius, endAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 1 ${endInner.x} ${endInner.y}`,
    "Z",
  ].join(" ");
}
