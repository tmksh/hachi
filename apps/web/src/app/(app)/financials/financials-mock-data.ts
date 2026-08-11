/**
 * 決算書プレビュー用モック（UI確認用・DB非保存）
 * 注釈 No.80/90 の部門別売上・製造原価3区分に合わせた金額
 */
import type {
  FinancialAccountItem,
  FinancialAccountSection,
  FinancialCogsCategory,
  FinancialFormulaRole,
} from "@/lib/database.types";
import {
  MOCK_REVENUE_DEPARTMENTS,
  buildDefaultFinancialAccountItems,
  buildFinancialPeriodLabel,
} from "@/lib/financial-statements-utils";
import type { EditableValues } from "./financials-shared";

type Amt = { budget: number; actual: number; prior: number; note?: string };

const MOCK_BY_NAME: Record<string, Amt> = {
  企画部門: { budget: 80_000_000, actual: 72_000_000, prior: 65_000_000 },
  商業施設部門: { budget: 120_000_000, actual: 108_000_000, prior: 95_000_000 },
  住宅リノベ部門: { budget: 150_000_000, actual: 132_000_000, prior: 118_000_000 },
  その他部門: { budget: 50_000_000, actual: 40_000_000, prior: 32_000_000 },
  期首材料棚卸高: { budget: 8_000_000, actual: 7_500_000, prior: 7_000_000 },
  材料仕入高: { budget: 30_000_000, actual: 28_000_000, prior: 25_000_000 },
  期末材料棚卸高: { budget: 9_000_000, actual: 8_500_000, prior: 7_500_000 },
  労務費: { budget: 18_000_000, actual: 17_200_000, prior: 16_000_000 },
  法定福利費: { budget: 3_200_000, actual: 3_000_000, prior: 2_800_000 },
  外注加工費: {
    budget: 160_000_000,
    actual: 148_000_000,
    prior: 135_000_000,
    note: "売上の約42%（建設業で重要）",
  },
  地代家賃: { budget: 4_000_000, actual: 4_000_000, prior: 3_800_000 },
  "減価償却費（製造）": { budget: 3_500_000, actual: 3_500_000, prior: 3_200_000 },
  仮設経費: { budget: 4_000_000, actual: 3_800_000, prior: 3_500_000 },
  動力用水光熱費: { budget: 2_200_000, actual: 2_100_000, prior: 1_900_000 },
  その他製造経費: { budget: 5_000_000, actual: 4_800_000, prior: 4_200_000 },
  期首仕掛品棚卸高: { budget: 6_000_000, actual: 5_500_000, prior: 5_000_000 },
  期末仕掛品棚卸高: { budget: 7_000_000, actual: 6_200_000, prior: 5_500_000 },
  役員報酬: { budget: 24_000_000, actual: 24_000_000, prior: 22_000_000 },
  給料手当: { budget: 36_000_000, actual: 34_500_000, prior: 32_000_000 },
  賞与: { budget: 8_000_000, actual: 7_200_000, prior: 6_800_000 },
  福利厚生費: { budget: 1_800_000, actual: 1_650_000, prior: 1_500_000 },
  広告宣伝費: { budget: 4_000_000, actual: 3_200_000, prior: 2_800_000 },
  接待交際費: { budget: 2_000_000, actual: 1_850_000, prior: 1_700_000 },
  旅費交通費: { budget: 2_400_000, actual: 2_100_000, prior: 1_900_000 },
  通信費: { budget: 1_200_000, actual: 1_150_000, prior: 1_100_000 },
  水道光熱費: { budget: 1_500_000, actual: 1_420_000, prior: 1_350_000 },
  消耗品費: { budget: 900_000, actual: 820_000, prior: 780_000 },
  保険料: { budget: 1_100_000, actual: 1_050_000, prior: 980_000 },
  租税公課: { budget: 2_800_000, actual: 2_600_000, prior: 2_400_000 },
  減価償却費: { budget: 3_200_000, actual: 3_200_000, prior: 3_000_000 },
  支払手数料: { budget: 2_500_000, actual: 2_300_000, prior: 2_100_000 },
  雑費: { budget: 1_000_000, actual: 880_000, prior: 750_000 },
  受取利息: { budget: 200_000, actual: 180_000, prior: 150_000 },
  雑収入: { budget: 500_000, actual: 420_000, prior: 300_000 },
  支払利息: { budget: 1_800_000, actual: 1_650_000, prior: 1_900_000 },
  雑損失: { budget: 300_000, actual: 120_000, prior: 200_000 },
};

function fakeItem(
  id: string,
  section: FinancialAccountSection,
  name: string,
  sortOrder: number,
  cogsCategory: FinancialCogsCategory | null = null,
  formulaRole: FinancialFormulaRole | null = null,
): FinancialAccountItem {
  const now = new Date().toISOString();
  return {
    id,
    company_id: "mock",
    section,
    cogs_category: cogsCategory,
    formula_role: formulaRole,
    name,
    sort_order: sortOrder,
    is_active: true,
    created_at: now,
    updated_at: now,
  };
}

export type FinancialsMockPreview = {
  items: FinancialAccountItem[];
  values: EditableValues;
  periodLabel: string;
  fiscalYear: number;
  startMonth: number;
};

/**
 * UI確認用モック。注釈どおりのデフォルト科目構造で常に生成（DBマスタとは独立）。
 */
export function buildFinancialsMockPreview(
  _existingItems?: FinancialAccountItem[],
): FinancialsMockPreview {
  // 注釈例に近い期首（3/21開始）でラベル確認できるようにする
  const fiscalYear = 2026;
  const startMonth = 3;
  const periodLabel = buildFinancialPeriodLabel(fiscalYear, startMonth, { startDay: 21 });

  const items = buildDefaultFinancialAccountItems([...MOCK_REVENUE_DEPARTMENTS]).map((seed, i) =>
    fakeItem(
      `mock-${seed.section}-${seed.name}`,
      seed.section,
      seed.name,
      (i + 1) * 10,
      seed.cogsCategory ?? null,
      seed.formulaRole ?? null,
    ),
  );

  const values: EditableValues = {};
  for (const item of items) {
    const amt = MOCK_BY_NAME[item.name];
    if (!amt) {
      values[item.id] = { budget: "", actual: "", prior: "", note: "" };
      continue;
    }
    values[item.id] = {
      budget: String(amt.budget),
      actual: String(amt.actual),
      prior: String(amt.prior),
      note: amt.note ?? "",
    };
  }

  return { items, values, periodLabel, fiscalYear, startMonth };
}
