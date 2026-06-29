/** BI ダッシュボード共通ユーティリティ（クライアント・サーバー両用） */

/** 現在の会計年度（4月始まり）を西暦で返す */
export function getCurrentFiscalYear(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

/** 西暦年度 → 令和表記（例: 2026 → "R8年度"） */
export function fiscalYearLabel(year: number): string {
  const reiwa = year - 2018;
  return `R${reiwa}年度`;
}

/** 標準部門リスト */
export const DEFAULT_DEPARTMENTS = ["一般住宅", "新築", "公共工事", "リフォーム"] as const;

/** 選択可能な会計年度（当年度から過去5年） */
export function listFiscalYears(count = 5): number[] {
  const current = getCurrentFiscalYear();
  return Array.from({ length: count }, (_, i) => current - i);
}
