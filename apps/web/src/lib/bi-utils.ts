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
