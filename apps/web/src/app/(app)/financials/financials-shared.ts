/** 決算書画面のクライアント共有型・ヘルパー */

import type { FinancialAccountItem, FinancialStatementLine } from "@/lib/database.types";

/** 科目ごとの編集中の値（入力中は文字列で保持） */
export type EditableLineValue = {
  budget: string;
  actual: string;
  prior: string;
  note: string;
};

export type EditableValues = Record<string, EditableLineValue>;

export const EMPTY_LINE_VALUE: EditableLineValue = { budget: "", actual: "", prior: "", note: "" };

/** 入力文字列 → 金額数値（カンマ・空白を許容。不正値は0） */
export function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[,，\s円]/g, "").replace(/▲/g, "-");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** 保存済み明細行 → 編集用の値マップ */
export function buildEditableValues(lines: FinancialStatementLine[]): EditableValues {
  const values: EditableValues = {};
  for (const line of lines) {
    values[line.account_item_id] = {
      budget: line.budget_amount ? String(Math.round(Number(line.budget_amount))) : "",
      actual: line.actual_amount ? String(Math.round(Number(line.actual_amount))) : "",
      prior: line.prior_actual_amount ? String(Math.round(Number(line.prior_actual_amount))) : "",
      note: line.variance_note ?? "",
    };
  }
  return values;
}

/** 編集用の値マップ → PL計算用の擬似明細行（computePl へ渡す） */
export function buildLinesForCompute(
  items: FinancialAccountItem[],
  values: EditableValues,
): FinancialStatementLine[] {
  return items.map((item) => {
    const v = values[item.id] ?? EMPTY_LINE_VALUE;
    return {
      id: item.id,
      company_id: item.company_id,
      statement_id: "",
      account_item_id: item.id,
      budget_amount: parseAmount(v.budget),
      actual_amount: parseAmount(v.actual),
      prior_actual_amount: parseAmount(v.prior),
      variance_note: v.note || null,
      created_at: "",
      updated_at: "",
    };
  });
}
