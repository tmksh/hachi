/** BI ダッシュボード共通ユーティリティ（クライアント・サーバー両用） */

/** デフォルト年度始まり月（4月） */
export const DEFAULT_FISCAL_MONTH_START = 4;

/**
 * 現在の会計年度を西暦で返す。
 * @param startMonth 年度始まり月（1=1月 … 12=12月, デフォルト 4=4月）
 */
export function getCurrentFiscalYear(startMonth = DEFAULT_FISCAL_MONTH_START): number {
  const now = new Date();
  const calendarMonth = now.getMonth() + 1; // 1〜12
  return calendarMonth >= startMonth ? now.getFullYear() : now.getFullYear() - 1;
}

/** 西暦年度 → 令和表記（例: 2026 → "R8年度"） */
export function fiscalYearLabel(year: number): string {
  const reiwa = year - 2018;
  return `R${reiwa}年度`;
}

/** 標準部門リスト */
export const DEFAULT_DEPARTMENTS = ["一般住宅", "新築", "公共工事", "リフォーム"] as const;

/**
 * 年度内の 12 ヶ月ラベル配列を返す。
 * 例: startMonth=4 → ["4月","5月",...,"3月"]
 */
export function buildFiscalMonthLabels(startMonth = DEFAULT_FISCAL_MONTH_START): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m = ((startMonth - 1 + i) % 12) + 1;
    return `${m}月`;
  });
}

/**
 * 今日が年度内の何番目のインデックス（0始まり）かを返す。
 * 例: startMonth=4 で今日が9月 → 5
 */
export function getCurrentFiscalMonthIndex(startMonth = DEFAULT_FISCAL_MONTH_START): number {
  const calendarMonth = new Date().getMonth() + 1; // 1〜12
  return ((calendarMonth - startMonth + 12) % 12);
}

/**
 * 着地予測の開始インデックス（= 今日の翌月から年度末まで）。
 * 例: startMonth=4 で今日が9月(index=5) → forecastFrom=6
 * 年度末（index=11）を超えた場合は 12 を返す（すべて実績扱い）。
 */
export function getForecastStartIndex(startMonth = DEFAULT_FISCAL_MONTH_START): number {
  const idx = getCurrentFiscalMonthIndex(startMonth);
  return Math.min(idx + 1, 12);
}

/** 選択可能な会計年度（当年度から過去5年） */
export function listFiscalYears(count = 5, startMonth = DEFAULT_FISCAL_MONTH_START): number[] {
  const current = getCurrentFiscalYear(startMonth);
  return Array.from({ length: count }, (_, i) => current - i);
}

/** @deprecated 固定値の代わりに getForecastStartIndex() を使う */
export const BI_FORECAST_START_INDEX = 6;

/** 期首設定の金額（円入力）を万円に正規化 */
export function normalizeBudgetMan(value: number): number {
  if (value >= 100_000) return Math.round(value / 10_000);
  return value;
}

export type MonthlyComboPoint = {
  month: string;
  粗利額: number;
  月次予定配賦: number;
  累計: number;
};

/**
 * 建設業の季節性を大げさに効かせた月次粗利ウェイト（4月始まり）。
 * 山谷を極端にしてストリームグラフでも動きが分かるようにする。
 * 例: 4月ほぼゼロ → 7月急峰 → 8–9月谷 → 12月最高峰 → 1–2月急落 → 3月再加速
 */
export const MOCK_GP_WEIGHTS = [0.12, 0.35, 1.55, 3.1, 0.55, 0.18, 0.22, 1.05, 2.6, 3.4, 0.65, 1.85];

/** 月別推移グラフ用のリアルなモックデータ（万円） */
export function buildRealisticMonthlyComboData(
  months: Array<{ month: string }>,
  totalGrossProfitMan: number,
  overheadMan: number,
): MonthlyComboPoint[] {
  const weightSum = MOCK_GP_WEIGHTS.reduce((s, w) => s + w, 0);
  // 年間粗利を盛って山谷を強調（見た目用モック）
  const displayTotal = totalGrossProfitMan > 0 ? totalGrossProfitMan * 1.35 : 2800;
  const gpScale = displayTotal / weightSum;
  const monthlyOverhead = overheadMan > 0 ? Math.round(overheadMan / 12) : 150;
  let cum = 0;
  return months.map((m, i) => {
    const grossProfit = Math.round(MOCK_GP_WEIGHTS[i] * gpScale);
    // 閑散月は固定費の方が大きく、累計が下がる（山谷がはっきりする）
    const alloc = monthlyOverhead;
    cum += grossProfit - alloc;
    return {
      month: m.month,
      粗利額: grossProfit,
      月次予定配賦: -alloc,
      累計: cum,
    };
  });
}

/** 実績月が少ない・スケール異常時はモック表示に切り替える */
export function shouldUseMonthlyTrendMock(
  monthly: Array<{ grossProfit: number }>,
  comboData: MonthlyComboPoint[],
): boolean {
  const activeMonths = monthly.filter((m) => m.grossProfit > 0).length;
  if (activeMonths < 6) return true;
  const maxAbs = comboData
    .flatMap((r) => [r.粗利額, r.月次予定配賦, r.累計])
    .reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  return maxAbs > 5_000;
}
