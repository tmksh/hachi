/**
 * 経営調整費は見積明細行ではなく、会社率で一律計上する。
 * 予備費（明細の任意原価）を含めた見積全体（売価合計＋予備費原価）に率を掛ける。
 */
export function calcManagementFeeAmount(input: {
  sellingTotal: number;
  reserveCost?: number;
  /** 0〜1。1超はパーセントとして扱う */
  rate: number;
}): number {
  const selling = Math.max(0, Number(input.sellingTotal) || 0);
  const reserve = Math.max(0, Number(input.reserveCost) || 0);
  const raw = Number(input.rate) || 0;
  const rate = raw > 1 ? raw / 100 : raw;
  if (rate <= 0) return 0;
  return Math.round((selling + reserve) * rate);
}

export function normalizeFeeRate(raw: number | null | undefined): number {
  const value = Number(raw ?? 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value > 1 ? value / 100 : value;
}
