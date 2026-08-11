/**
 * 決算書（財務諸表）共通ユーティリティ（クライアント・サーバー両用）
 * 顧客要望 No.85〜104
 */

import type {
  FinancialAccountItem,
  FinancialAccountSection,
  FinancialCogsCategory,
  FinancialFormulaRole,
  FinancialStatementLine,
} from "@/lib/database.types";

// ── 区分定義 ─────────────────────────────────────────────────────────

/** PL区分の表示順・ラベル（No.87: 第1階層） */
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

/**
 * 製造原価報告書の表示区分（No.90: 材料費/労務費/製造経費の3区分）。
 * DB上の outsourcing は製造経費に含めて表示する（外注加工費はオレンジ強調）。
 */
export const COGS_DISPLAY_CATEGORIES: Array<{
  key: "material" | "labor" | "expense";
  label: string;
}> = [
  { key: "material", label: "材料費" },
  { key: "labor", label: "労務費" },
  { key: "expense", label: "製造経費" },
];

/** マスタ編集用（DBカテゴリ。outsourcing は新規では非推奨だが既存互換） */
export const COGS_CATEGORIES: Array<{ key: FinancialCogsCategory; label: string }> = [
  { key: "material", label: "材料費" },
  { key: "labor", label: "労務費" },
  { key: "expense", label: "製造経費" },
  { key: "outsourcing", label: "外注費（旧）" },
];

export const COGS_CATEGORY_LABELS: Record<FinancialCogsCategory, string> = {
  material: "材料費",
  labor: "労務費",
  expense: "製造経費",
  outsourcing: "外注費",
};

/** 法人税概算の実効税率（No.97） */
export const ESTIMATED_EFFECTIVE_TAX_RATE = 0.3;

const WIP_ROLES: FinancialFormulaRole[] = ["begin_wip", "end_wip"];
const MATERIAL_INV_ROLES: FinancialFormulaRole[] = [
  "begin_material",
  "material_purchase",
  "end_material",
];

// ── 期間ラベル（No.104 / モック: 令和表記） ───────────────────────────

/** 西暦 → 令和年（2019=令和1） */
export function toReiwaYear(westernYear: number): number {
  return westernYear - 2018;
}

export type FinancialPeriodOptions = {
  /** 期首日（1〜28）。未指定・1 のときは暦月の1日〜月末（No.104） */
  startDay?: number;
};

/**
 * 決算期の開始日・終了日を返す（ラベル・期間計算用・No.104）。
 * startDay>1 のとき: 開始年/開始月/startDay 〜 翌年同月 (startDay-1)
 * 例: (2026, 3, 21) → 2026/3/21〜2027/3/20
 */
export function financialPeriodRange(
  fiscalYear: number,
  startMonth: number,
  startDay = 1,
): { start: Date; end: Date; startYmd: string; endYmd: string } {
  const day = Math.min(28, Math.max(1, Math.floor(startDay) || 1));
  let start: Date;
  let end: Date;
  if (day <= 1) {
    start = new Date(fiscalYear, startMonth - 1, 1);
    const endMonth = startMonth === 1 ? 12 : startMonth - 1;
    const endYear = startMonth === 1 ? fiscalYear : fiscalYear + 1;
    const endDay = new Date(endYear, endMonth, 0).getDate();
    end = new Date(endYear, endMonth - 1, endDay);
  } else {
    start = new Date(fiscalYear, startMonth - 1, day);
    end = new Date(fiscalYear + 1, startMonth - 1, day - 1);
  }
  const ymd = (d: Date) =>
    `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  return { start, end, startYmd: ymd(start), endYmd: ymd(end) };
}

/**
 * 決算期ラベルを自動生成（手入力禁止・No.104）。
 * 例: (2026, 4) → 「令和8年度（2026/4/1〜2027/3/31）」
 * 例: (2026, 3, { startDay: 21 }) → 「令和8年度（2026/3/21〜2027/3/20）」
 */
export function buildFinancialPeriodLabel(
  fiscalYear: number,
  startMonth: number,
  options?: FinancialPeriodOptions,
): string {
  const { startYmd, endYmd } = financialPeriodRange(
    fiscalYear,
    startMonth,
    options?.startDay ?? 1,
  );
  const reiwa = toReiwaYear(fiscalYear);
  return `令和${reiwa}年度（${startYmd}〜${endYmd}）`;
}

/** 短い表示用（ヘッダー等） */
export function buildFinancialPeriodShortLabel(
  fiscalYear: number,
  startMonth: number,
  options?: FinancialPeriodOptions,
): string {
  return buildFinancialPeriodLabel(fiscalYear, startMonth, options);
}

// ── デフォルト勘定科目（No.87/80/90） ────────────────────────────────

export type DefaultAccountItemSeed = {
  section: FinancialAccountSection;
  cogsCategory?: FinancialCogsCategory;
  formulaRole?: FinancialFormulaRole;
  name: string;
};

/** 注釈モック用の部門名（プレビュー表示） */
export const MOCK_REVENUE_DEPARTMENTS = [
  "企画部門",
  "商業施設部門",
  "住宅リノベ部門",
  "その他部門",
] as const;

/** v1 seed から置き換える古い科目名（heal 時に非アクティブ化） */
export const OBSOLETE_FINANCIAL_ACCOUNT_NAMES = [
  "完成工事高",
  "兼業事業売上高",
  "材料費",
  "労務外注費",
  "外注費",
  "現場従業員給料手当",
  "機械等経費",
] as const;

/** 製造原価・販管・営業外の固定科目（売上部門は別途渡す） */
export const DEFAULT_FINANCIAL_FIXED_ITEMS: DefaultAccountItemSeed[] = [
  // 材料費
  { section: "cogs", cogsCategory: "material", formulaRole: "begin_material", name: "期首材料棚卸高" },
  { section: "cogs", cogsCategory: "material", formulaRole: "material_purchase", name: "材料仕入高" },
  { section: "cogs", cogsCategory: "material", formulaRole: "end_material", name: "期末材料棚卸高" },
  // 労務費
  { section: "cogs", cogsCategory: "labor", name: "労務費" },
  { section: "cogs", cogsCategory: "labor", name: "法定福利費" },
  // 製造経費（外注加工費を含む・No.90）
  { section: "cogs", cogsCategory: "expense", name: "外注加工費" },
  { section: "cogs", cogsCategory: "expense", name: "地代家賃" },
  { section: "cogs", cogsCategory: "expense", name: "減価償却費（製造）" },
  { section: "cogs", cogsCategory: "expense", name: "仮設経費" },
  { section: "cogs", cogsCategory: "expense", name: "動力用水光熱費" },
  { section: "cogs", cogsCategory: "expense", name: "その他製造経費" },
  // 仕掛品
  { section: "cogs", cogsCategory: "expense", formulaRole: "begin_wip", name: "期首仕掛品棚卸高" },
  { section: "cogs", cogsCategory: "expense", formulaRole: "end_wip", name: "期末仕掛品棚卸高" },
  // 販管費
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
  // 営業外
  { section: "non_operating_income", name: "受取利息" },
  { section: "non_operating_income", name: "雑収入" },
  { section: "non_operating_expense", name: "支払利息" },
  { section: "non_operating_expense", name: "雑損失" },
];

/**
 * 部門名付きの標準科目一覧を生成（No.80/87/90）。
 * 3階層は「区分 → 科目 → 合計（自動計算）」で表現する。
 */
export function buildDefaultFinancialAccountItems(
  departmentNames: string[],
): DefaultAccountItemSeed[] {
  const depts = departmentNames.length > 0 ? departmentNames : [...MOCK_REVENUE_DEPARTMENTS];
  return [
    ...depts.map((name) => ({ section: "revenue" as const, name })),
    ...DEFAULT_FINANCIAL_FIXED_ITEMS,
  ];
}

/** @deprecated buildDefaultFinancialAccountItems を使う。後方互換の固定リスト */
export const DEFAULT_FINANCIAL_ACCOUNT_ITEMS = buildDefaultFinancialAccountItems([
  ...MOCK_REVENUE_DEPARTMENTS,
]);

// ── PL 計算（No.89 / No.90） ─────────────────────────────────────────

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
  sectionEntries: Record<FinancialAccountSection, PlLineEntry[]>;
  sectionTotals: Record<FinancialAccountSection, PlAmounts>;
  /** DBカテゴリ別（outsourcing 含む） */
  cogsCategoryTotals: Record<FinancialCogsCategory, PlAmounts>;
  /** 表示用3区分の合計（材料は棚卸計算後） */
  cogsDisplayTotals: Record<"material" | "labor" | "expense", PlAmounts>;
  /** 各区分に出す明細（仕掛品ロールは除外） */
  cogsDisplayEntries: Record<"material" | "labor" | "expense", PlLineEntry[]>;
  /** 仕掛品行 */
  wipEntries: { begin: PlLineEntry[]; end: PlLineEntry[] };
  /** = 総製造費用 */
  totalManufacturingCost: PlAmounts;
  /** = 当期製品製造原価（→ PL売上原価） */
  productManufacturingCost: PlAmounts;
  grossProfit: PlAmounts;
  operatingIncome: PlAmounts;
  ordinaryIncome: PlAmounts;
  pretaxIncome: PlAmounts;
  estimatedTax: PlAmounts;
  estimatedNetIncome: PlAmounts;
};

function roleOf(item: FinancialAccountItem): FinancialFormulaRole | null {
  return (item.formula_role as FinancialFormulaRole | null | undefined) ?? null;
}

function isWip(item: FinancialAccountItem): boolean {
  const r = roleOf(item);
  return r === "begin_wip" || r === "end_wip";
}

function displayCategory(
  cat: FinancialCogsCategory | null,
): "material" | "labor" | "expense" | null {
  if (!cat) return null;
  if (cat === "outsourcing") return "expense";
  return cat;
}

/** 外注系科目か（No.90: オレンジ強調） */
export function isOutsourcingAccount(item: FinancialAccountItem): boolean {
  if (item.cogs_category === "outsourcing") return true;
  return /外注/.test(item.name);
}

/**
 * 勘定科目マスタと明細行から PL・製造原価を計算する。
 * 段階利益・総製造費用・当期製品製造原価は保存せずここで算出（No.89/90）。
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

  const cogsDisplayEntries = {
    material: [] as PlLineEntry[],
    labor: [] as PlLineEntry[],
    expense: [] as PlLineEntry[],
  };
  const wipEntries = { begin: [] as PlLineEntry[], end: [] as PlLineEntry[] };

  const byRole: Partial<Record<FinancialFormulaRole, PlAmounts>> = {};

  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  for (const item of sorted) {
    if (!item.is_active) continue;
    const line = lineByItem.get(item.id);
    const amounts: PlAmounts = {
      budget: Number(line?.budget_amount ?? 0),
      actual: Number(line?.actual_amount ?? 0),
      prior: Number(line?.prior_actual_amount ?? 0),
    };
    const entry: PlLineEntry = {
      item,
      amounts,
      varianceNote: line?.variance_note ?? "",
    };

    sectionEntries[item.section].push(entry);

    if (item.section !== "cogs") {
      sectionTotals[item.section] = addAmounts(sectionTotals[item.section], amounts);
      continue;
    }

    const role = roleOf(item);
    if (role) {
      byRole[role] = addAmounts(byRole[role] ?? { ...ZERO_AMOUNTS }, amounts);
    }

    if (role === "begin_wip") {
      wipEntries.begin.push(entry);
      continue;
    }
    if (role === "end_wip") {
      wipEntries.end.push(entry);
      continue;
    }

    if (item.cogs_category) {
      cogsCategoryTotals[item.cogs_category] = addAmounts(
        cogsCategoryTotals[item.cogs_category],
        amounts,
      );
    }
    const disp = displayCategory(item.cogs_category);
    if (disp) cogsDisplayEntries[disp].push(entry);
  }

  // 材料費 = 期首 + 仕入 − 期末（ロールがある場合）。なければ単純合計
  const hasMaterialFormula = MATERIAL_INV_ROLES.some((r) => byRole[r] != null);
  let materialTotal: PlAmounts;
  if (hasMaterialFormula) {
    materialTotal = subtractAmounts(
      addAmounts(byRole.begin_material ?? ZERO_AMOUNTS, byRole.material_purchase ?? ZERO_AMOUNTS),
      byRole.end_material ?? ZERO_AMOUNTS,
    );
    // ロール外の材料科目があれば加算
    for (const e of cogsDisplayEntries.material) {
      const r = roleOf(e.item);
      if (!r || !MATERIAL_INV_ROLES.includes(r)) {
        materialTotal = addAmounts(materialTotal, e.amounts);
      }
    }
  } else {
    materialTotal = cogsDisplayEntries.material.reduce(
      (s, e) => addAmounts(s, e.amounts),
      { ...ZERO_AMOUNTS },
    );
  }

  const laborTotal = cogsDisplayEntries.labor.reduce(
    (s, e) => addAmounts(s, e.amounts),
    { ...ZERO_AMOUNTS },
  );
  // outsourcing は displayCategory で expense に振り分け済み
  const expenseOnly = cogsDisplayEntries.expense.reduce(
    (s, e) => addAmounts(s, e.amounts),
    { ...ZERO_AMOUNTS },
  );

  const cogsDisplayTotals = {
    material: materialTotal,
    labor: laborTotal,
    expense: expenseOnly,
  };

  const totalManufacturingCost = addAmounts(
    addAmounts(materialTotal, laborTotal),
    expenseOnly,
  );

  const beginWip = byRole.begin_wip ?? ZERO_AMOUNTS;
  const endWip = byRole.end_wip ?? ZERO_AMOUNTS;
  const productManufacturingCost = subtractAmounts(
    addAmounts(totalManufacturingCost, beginWip),
    endWip,
  );

  // PLの売上原価 = 当期製品製造原価
  sectionTotals.cogs = productManufacturingCost;

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
    cogsDisplayTotals,
    cogsDisplayEntries,
    wipEntries,
    totalManufacturingCost,
    productManufacturingCost,
    grossProfit,
    operatingIncome,
    ordinaryIncome,
    pretaxIncome,
    estimatedTax,
    estimatedNetIncome,
  };
}

// ── 表示フォーマット ─────────────────────────────────────────────────

/** 決算書の表示単位（No.82: 千円表示対応） */
export type FinancialDisplayUnit = "yen" | "thousand";

export function fmtYen(v: number, unit: FinancialDisplayUnit = "yen"): string {
  const scaled = unit === "thousand" ? Math.round(v / 1000) : Math.round(v);
  if (scaled < 0) return `▲${Math.abs(scaled).toLocaleString()}`;
  return scaled.toLocaleString();
}

export function fmtCompositionRatio(value: number, revenueTotal: number): string {
  if (revenueTotal === 0) return "−";
  return `${((value / revenueTotal) * 100).toFixed(1)}%`;
}

export function fmtYoyRatio(actual: number, prior: number): string {
  if (prior === 0) return "−";
  return `${((actual / prior) * 100).toFixed(1)}%`;
}

export function listFinancialFiscalYears(): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: 12 }, (_, i) => current + 1 - i);
}

