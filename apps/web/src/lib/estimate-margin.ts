/**
 * 見積の基準粗利率をパーセント（例: 50）に正規化する。
 * DB には 0.5（割合）または 50（パーセント）の両方が入りうる。
 */
export function toMarginThresholdPercent(raw: number | null | undefined): number {
  const v = raw ?? 0.5;
  if (!Number.isFinite(v) || v < 0) return 50;
  return v > 1 ? v : v * 100;
}

/** 明細からライブ粗利率（%）を算出 */
export function calcGrossProfitRatePercent(
  items: Array<{ selling_amount?: number | null; cost_amount?: number | null }>,
): number {
  const sell = items.reduce((s, i) => s + Number(i.selling_amount ?? 0), 0);
  const cost = items.reduce((s, i) => s + Number(i.cost_amount ?? 0), 0);
  if (sell <= 0) return 0;
  return ((sell - cost) / sell) * 100;
}
