/** 旧スキーマの specialty コード → 表示名。CHECK 制約解除後はラベル文字列を保存する。 */
export const LEGACY_SPECIALTY_LABELS: Record<string, string> = {
  carpenter: "大工",
  electrical: "電気",
  interior: "内装",
  plumbing: "配管",
  general: "総合",
};

export function specialtyLabel(value: string | null | undefined): string {
  if (!value) return "";
  return LEGACY_SPECIALTY_LABELS[value] ?? value;
}
