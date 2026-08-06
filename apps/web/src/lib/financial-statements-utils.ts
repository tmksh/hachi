/**
 * 決算書（財務諸表）共通ユーティリティ（クライアント・サーバー両用）
 * 顧客要望 No.85〜104
 */

import type {
  FinancialAccountItem,
  FinancialAccountSection,
  FinancialCogsCategory,
  FinancialStatementLine,
} from "@/lib/database.types";

// ── 区分定義 ─────────────────────────────────────────────────────────

/** PL区分の表示順・ラベル */
export const FINANCIAL_SECTIONS: Array<{ key: FinancialAccountSection; label: string }> = [
  { key: "revenue", label: "売上高" },
  { key: "cogs", label: "売上原価" },
  { key: "sga", label: "販売費及び一般管理費" },
  { key: "non_operating_income", label: "営業外収益" },
  { key: "non_operating_expense", label: "営業外費用" },
];

export const FINANCIAL_SECTION_LABELS: Record<FinancialAccountSection, string> =
  Object.fromEntries(FINANCIAL_SECTIONS.map((s) => [s.key, s.label])) as Record<
    FinancialAccountSection,
    string
  >;

/** 製造原価報告書のサブ区分（No.90: 材料費/労務費/製造経費の3区分＋外注費） */
export const COGS_CATEGORIES: Array<{ key: FinancialCogsCategory; label: string }> = [
  { key: "material", label: "材料費" },
  { key: "labor", label: "労務費" },
  { key: "outsourcing", label: "外注費" },
  { key: "expense", label: "製造経費" },
];

export const COGS_CATEGORY_LABELS: Record<FinancialCogsCategory, string> =
  Object.fromEntries(COGS_CATEGORIES.map((c) => [c.key, c.label])) as Record<
    FinancialCogsCategory,
    string
  >;

/** 法人税概算の実効税率（No.97: あくまで概算表示） */
export const ESTIMATED_EFFECTIVE_TAX_RATE = 0.3;

// ── 期間ラベル（No.104） ─────────────────────────────────────────────

/**
 * 決算期の開始年・開始月から対象期間ラベルを自動生成する（手入力禁止）。
 * 例: (2025, 8) → 「2025年8月〜2026年7月期」 / (2025, 1) → 「2025年1月〜2025年12月期」
 */
export function buildFinancialPeriodLabel(fiscalYear: number, startMonth: number): string {
  const endMonth = startMonth === 1 ? 12 : startMonth - 1;
  const endYear = startMonth === 1 ? fiscalYear : fiscalYear + 1;
  return `${fiscalYear}年${startMonth}月〜${endYear}年${endMonth}月期`;
}

// ── デフォルト勘定科目（No.87: 標準的な建設業PL・初回自動seed用） ──────

export type DefaultAccountItemSeed = {
  section: FinancialAccountSection;
  cogsCategory?: FinancialCogsCategory;
  name: string;
};

/**
 * 標準的な建設業PLのデフォルト科目。
 * 人件費系は製造原価（労務費）と販管費のどちらにも登録できる構造（No.98）。
 */
export const DEFAULT_FINANCIAL_ACCOUNT_ITEMS: DefaultAccountItemSeed[] = [
  // 売上高
  { section: "revenue", name: "完成工事高" },
  { section: "revenue", name: "兼業事業売上高" },
  // 売上原価（製造原価報告書 No.90）
  { section: "cogs", cogsCategory: "material", name: "材料費" },
  { section: "cogs", cogsCategory: "labor", name: "労務費" },
  { section: "cogs", cogsCategory: "labor", name: "労務外注費" },
  { section: "cogs", cogsCategory: "outsourcing", name: "外注費" },
  { section: "cogs", cogsCategory: "expense", name: "仮設経費" },
  { section: "cogs", cogsCategory: "expense", name: "動力用水光熱費" },
  { section: "cogs", cogsCategory: "expense", name: "機械等経費" },
  { section: "cogs", cogsCategory: "expense", name: "現場従業員給料手当" },
  { section: "cogs", cogsCategory: "expense", name: "減価償却費（製造）" },
  { section: "cogs", cogsCategory: "expense", name: "その他製造経費" },
  // 販売費及び一般管理費
  { section: "sga", name: "役員報酬" },
  { section: "sga", name: "給料手当" },
  { section: "sga", name: "賞与" },
  { section: "sga", name: "法定福利費" },
  { section: "sga", name: "福利厚生費" },
  { section: "sga", name: "広告宣伝費" },
  { section: "sga", name: "接待交際費" },
  { section: "sga", name: "旅費交通費" },
  { section: "sga", name: "通信費" },
  { section: "sga", name: "水道光熱費" },
  { section: "sga", name: "消耗品費" },
  { section: "sga", name: "地代家賃" },
  { section: "sga", name: "保険料" },
  { section: "sga", name: "租税公課" },
  { section: "sga", name: "減価償却費" },
  { section: "sga", name: "支払手数料" },
  { section: "sga", name: "雑費" },
  // 営業外収益
  { section: "non_operating_income", name: "受取利息" },
  { section: "non_operating_income", name: "雑収入" },
  // 営業外費用
  { section: "non_operating_expense", name: "支払利息" },
  { section: "non_operating_expense", name: "雑損失" },
];

// ── PL 計算（No.89: 段階利益は自動計算・手入力禁止） ──────────────────

/** 予算・実績・前期実績の3値セット */
export type PlAmounts = {
  budget: number;
  actual: number;
  prior: number;
};

export const ZERO_AMOUNTS: PlAmounts = { budget: 0, actual: 0, prior: 0 };

export function addAmounts(a: PlAmounts, b: PlAmounts): PlAmounts {
  return { budget: a.budget + b.budget, actual: a.actual + b.actual, prior: a.prior + b.prior };
}

export function subtractAmounts(a: PlAmounts, b: PlAmounts): PlAmounts {
  return { budget: a.budget - b.budget, actual: a.actual - b.actual, prior: a.prior - b.prior };
}

export type PlLineEntry = {
  item: FinancialAccountItem;
  amounts: PlAmounts;
  varianceNote: string;
};

export type PlComputation = {
  /** 区分ごとの科目行 */
  sectionEntries: Record<FinancialAccountSection, PlLineEntry[]>;
  /** 区分ごとの合計 */
  sectionTotals: Record<FinancialAccountSection, PlAmounts>;
  /** 製造原価報告書サブ区分ごとの合計（No.90） */
  cogsCategoryTotals: Record<FinancialCogsCategory, PlAmounts>;
  /** 売上総利益 = 売上高 − 売上原価 */
  grossProfit: PlAmounts;
  /** 営業利益 = 売上総利益 − 販管費 */
  operatingIncome: PlAmounts;
  /** 経常利益 = 営業利益 ＋ 営業外収益 − 営業外費用 */
  ordinaryIncome: PlAmounts;
  /** 税引前当期純利益（特別損益なしのPL1枚構成のため経常利益と同額） */
  pretaxIncome: PlAmounts;
  /** 法人税等の概算（No.97: 税引前利益 × 実効税率約30%） */
  estimatedTax: PlAmounts;
  /** 概算の当期純利益（No.97） */
  estimatedNetIncome: PlAmounts;
};

/**
 * 勘定科目マスタと明細行から PL 全体（区分合計・段階利益）を計算する。
 * 段階利益は保存せずここで算出する（No.89）。
 */
export function computePl(
  items: FinancialAccountItem[],
  lines: FinancialStatementLine[],
): PlComputation {
  const lineByItem = new Map(lines.map((l) => [l.account_item_id, l]));

  const sectionEntries = {
    revenue: [],
    cogs: [],
    sga: [],
    non_operating_income: [],
    non_operating_expense: [],
  } as Record<FinancialAccountSection, PlLineEntry[]>;

  const sectionTotals = {
    revenue: { ...ZERO_AMOUNTS },
    cogs: { ...ZERO_AMOUNTS },
    sga: { ...ZERO_AMOUNTS },
    non_operating_income: { ...ZERO_AMOUNTS },
    non_operating_expense: { ...ZERO_AMOUNTS },
  } as Record<FinancialAccountSection, PlAmounts>;

  const cogsCategoryTotals = {
    material: { ...ZERO_AMOUNTS },
    labor: { ...ZERO_AMOUNTS },
    outsourcing: { ...ZERO_AMOUNTS },
    expense: { ...ZERO_AMOUNTS },
  } as Record<FinancialCogsCategory, PlAmounts>;

  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  for (const item of sorted) {
    if (!item.is_active) continue;
    const line = lineByItem.get(item.id);
    const amounts: PlAmounts = {
      budget: Number(line?.budget_amount ?? 0),
      actual: Number(line?.actual_amount ?? 0),
      prior: Number(line?.prior_actual_amount ?? 0),
    };
    sectionEntries[item.section].push({
      item,
      amounts,
      varianceNote: line?.variance_note ?? "",
    });
    sectionTotals[item.section] = addAmounts(sectionTotals[item.section], amounts);
    if (item.section === "cogs" && item.cogs_category) {
      cogsCategoryTotals[item.cogs_category] = addAmounts(
        cogsCategoryTotals[item.cogs_category],
        amounts,
      );
    }
  }

  const grossProfit = subtractAmounts(sectionTotals.revenue, sectionTotals.cogs);
  const operatingIncome = subtractAmounts(grossProfit, sectionTotals.sga);
  const ordinaryIncome = subtractAmounts(
    addAmounts(operatingIncome, sectionTotals.non_operating_income),
    sectionTotals.non_operating_expense,
  );
  const pretaxIncome = ordinaryIncome;
  const estimatedTax: PlAmounts = {
    budget: Math.max(0, Math.round(pretaxIncome.budget * ESTIMATED_EFFECTIVE_TAX_RATE)),
    actual: Math.max(0, Math.round(pretaxIncome.actual * ESTIMATED_EFFECTIVE_TAX_RATE)),
    prior: Math.max(0, Math.round(pretaxIncome.prior * ESTIMATED_EFFECTIVE_TAX_RATE)),
  };
  const estimatedNetIncome = subtractAmounts(pretaxIncome, estimatedTax);

  return {
    sectionEntries,
    sectionTotals,
    cogsCategoryTotals,
    grossProfit,
    operatingIncome,
    ordinaryIncome,
    pretaxIncome,
    estimatedTax,
    estimatedNetIncome,
  };
}

// ── 表示フォーマット ─────────────────────────────────────────────────

/** 金額（円）を表示用にフォーマット。負値は ▲ 表記 */
export function fmtYen(v: number): string {
  const rounded = Math.round(v);
  if (rounded < 0) return `▲${Math.abs(rounded).toLocaleString()}`;
  return rounded.toLocaleString();
}

/** 構成比（売上高計に対する%）。売上高がゼロなら "−" */
export function fmtCompositionRatio(value: number, revenueTotal: number): string {
  if (revenueTotal === 0) return "−";
  return `${((value / revenueTotal) * 100).toFixed(1)}%`;
}

/** 前期比（当期実績 ÷ 前期実績）。前期がゼロなら "−" */
export function fmtYoyRatio(actual: number, prior: number): string {
  if (prior === 0) return "−";
  return `${((actual / prior) * 100).toFixed(1)}%`;
}

/** 決算期として選択可能な開始年リスト（当年から過去10年＋翌年） */
export function listFinancialFiscalYears(): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: 12 }, (_, i) => current + 1 - i);
}
