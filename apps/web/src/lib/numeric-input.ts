/** 整数入力文字列を正規化（数字のみ・先頭ゼロ除去） */
export function normalizeIntegerInput(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits === "") return "";
  return digits.replace(/^0+(?=\d)/, "");
}

/** 正規化済み文字列 → 数値（空は 0） */
export function parseIntegerInput(raw: string): number {
  const normalized = normalizeIntegerInput(raw);
  if (normalized === "") return 0;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

/** 非編集中の表示用文字列（0 は空欄） */
export function formatIntegerDisplay(value: number): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "";
  return String(Math.trunc(n));
}
