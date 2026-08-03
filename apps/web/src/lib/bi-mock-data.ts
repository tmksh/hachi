/**
 * BIダッシュボード説明用の統一モックデータ（万円）
 * 期首設定・月別推移・部門別・昨対・着地予測・見込み売上を一貫した数値で揃える
 */

import type { BiActuals, BiAnnualSettings } from "@/lib/bi-types";
import { MOCK_OVERHEAD_BUDGET_MAN } from "@/lib/bi-types";
import {
  buildFiscalMonthLabels,
  buildRealisticMonthlyComboData,
  getCurrentFiscalYear,
  getForecastStartIndex,
  DEFAULT_FISCAL_MONTH_START,
  MOCK_GP_WEIGHTS,
} from "@/lib/bi-utils";
import type { BiProspectSummary } from "@/lib/actions/bi";

export { MOCK_GP_WEIGHTS };

export const MOCK_TARGET_REVENUE_MAN = 7100;
export const MOCK_TARGET_GP_MAN = 4200;
export const MOCK_SGA_BUDGET_MAN = 0;
export const MOCK_GP_RATE = 58.6;

const MOCK_YTD_REVENUE_MAN = 3520;
const MOCK_YTD_GP_MAN = 2063;

const MOCK_DEPT_ACTUALS = [
  { name: "一般住宅", label: "A部門", revenue: 1200, grossProfit: 703 },
  { name: "新築", label: "B部門", revenue: 1450, grossProfit: 849 },
  { name: "公共工事", label: "C部門", revenue: 620, grossProfit: 310 },
  { name: "リフォーム", label: "D部門", revenue: 250, grossProfit: 201 },
] as const;

const MOCK_DEPT_TARGETS = [
  { department_name: "一般住宅", target_revenue: 2000, target_gross_profit: 1200 },
  { department_name: "新築", target_revenue: 2500, target_gross_profit: 1500 },
  { department_name: "公共工事", target_revenue: 1800, target_gross_profit: 900 },
  { department_name: "リフォーム", target_revenue: 800, target_gross_profit: 600 },
] as const;

const MOCK_FORECAST_TIERS = [
  { id: "contracted", label: "着地（契約済）", revenue: 6800, grossProfit: 3980 },
  { id: "prospective", label: "着地（A見込含）", revenue: 7400, grossProfit: 4320 },
] as const;

/** 当年度ダッシュボードをモック表示にするか */
export function shouldUseBiDashboardMock(
  fiscalYear: number,
  fiscalMonthStart = DEFAULT_FISCAL_MONTH_START,
): boolean {
  return fiscalYear === getCurrentFiscalYear(fiscalMonthStart);
}

function buildMockMonthly(
  fiscalMonthStart: number,
  ytdRevenue: number,
  annualGp: number,
  forecastStartIdx: number,
) {
  const months = buildFiscalMonthLabels(fiscalMonthStart);
  const weightSum = MOCK_GP_WEIGHTS.reduce((s, w) => s + w, 0);
  const ytdWeightSum = MOCK_GP_WEIGHTS.slice(0, forecastStartIdx).reduce((s, w) => s + w, 0) || 1;

  return months.map((month, i) => {
    const grossProfit = Math.round(MOCK_GP_WEIGHTS[i] * annualGp / weightSum);
    const revenue =
      i < forecastStartIdx
        ? Math.round(MOCK_GP_WEIGHTS[i] * ytdRevenue / ytdWeightSum)
        : Math.round(MOCK_GP_WEIGHTS[i] * (ytdRevenue / ytdWeightSum) * 1.08);
    return { month, revenue, grossProfit };
  });
}

function buildMockPrevMonthly(
  fiscalMonthStart: number,
  currentMonthly: Array<{ month: string; revenue: number; grossProfit: number }>,
) {
  return currentMonthly.map((m) => ({
    month: m.month,
    revenue: Math.round(m.revenue * 0.88),
    grossProfit: Math.round(m.grossProfit * 0.9),
  }));
}

export type BiDashboardMockBundle = {
  settings: BiAnnualSettings;
  actuals: BiActuals;
  prevActuals: BiActuals;
  prospectSummary: BiProspectSummary;
};

export function buildBiDashboardMock(
  fiscalMonthStart = DEFAULT_FISCAL_MONTH_START,
): BiDashboardMockBundle {
  const forecastStartIdx = getForecastStartIndex(fiscalMonthStart);
  const monthly = buildMockMonthly(
    fiscalMonthStart,
    MOCK_YTD_REVENUE_MAN,
    MOCK_YTD_GP_MAN,
    forecastStartIdx,
  );
  const monthlyOverhead = Math.round(MOCK_OVERHEAD_BUDGET_MAN / 12);
  const monthlySga = Math.round(MOCK_SGA_BUDGET_MAN / 12);
  const prevMonthly = buildMockPrevMonthly(fiscalMonthStart, monthly);

  const settings: BiAnnualSettings = {
    id: "mock",
    fiscal_year: getCurrentFiscalYear(fiscalMonthStart),
    target_revenue: MOCK_TARGET_REVENUE_MAN,
    target_gross_profit: MOCK_TARGET_GP_MAN,
    overhead_budget: MOCK_OVERHEAD_BUDGET_MAN,
    sga_budget: MOCK_SGA_BUDGET_MAN,
    overhead_mode: "breakdown",
    overhead_items: [],
    department_targets: MOCK_DEPT_TARGETS.map((d, i) => ({
      id: `mock-dept-${i}`,
      ...d,
      sort_order: i,
    })),
    reserve_fee_rate: 0,
    reserve_released: false,
    reserve_released_at: null,
    base_gross_profit_rate: 0.5,
  };

  const actuals: BiActuals = {
    deptActuals: MOCK_DEPT_ACTUALS.map((d) => ({ ...d })),
    monthly,
    monthlyByDept: [],
    monthlyOverheadAllocations: Array(12).fill(monthlyOverhead),
    monthlySgaAllocations: Array(12).fill(monthlySga),
    forecastTiers: MOCK_FORECAST_TIERS.map((t) => ({ ...t })),
    hasData: true,
    fiscalMonthStart,
    sparklines: {
      revenue: monthly.map((m) => m.revenue),
      grossProfitRate: monthly.map((m) =>
        m.revenue > 0 ? Math.round((m.grossProfit / m.revenue) * 1000) / 10 : 0,
      ),
      grossProfitTotal: monthly.map((m, i) => m.grossProfit - monthlyOverhead * (i + 1)),
      operatingProfit: monthly.map((m, i) => m.grossProfit - monthlyOverhead - monthlySga * (i + 1)),
    },
    deltas: {
      grossProfitRatePt: 1.2,
      revenueAchievePct: null,
    },
  };

  const prevActuals: BiActuals = {
    ...actuals,
    deptActuals: MOCK_DEPT_ACTUALS.map((d) => ({
      ...d,
      revenue: Math.round(d.revenue * 0.88),
      grossProfit: Math.round(d.grossProfit * 0.9),
    })),
    monthly: prevMonthly,
    forecastTiers: [],
    hasData: true,
    deltas: { grossProfitRatePt: null, revenueAchievePct: null },
  };

  const prospectSummary: BiProspectSummary = {
    rows: [
      { grade: "A", rate: 80, customerCount: 3, baseRevenue: 1200, weightedRevenue: 960 },
      { grade: "B", rate: 50, customerCount: 5, baseRevenue: 800, weightedRevenue: 400 },
      { grade: "C", rate: 20, customerCount: 8, baseRevenue: 400, weightedRevenue: 80 },
    ],
    special: { customerCount: 1, baseRevenue: 2000, weightedRevenue: 1200, companyRate: 100 },
    totalBase: 2400,
    totalWeighted: 1440,
    totalBaseWithSpecial: 4400,
    totalWeightedWithSpecial: 2640,
    hasData: true,
    hasSpecial: true,
  };

  return { settings, actuals, prevActuals, prospectSummary };
}

/**
 * ダッシュボードモックの見込み母数に、会社設定の確度%／特需契約率を掛け直す。
 * （着地予測はモックのまま、見込み売上だけ実CRMで¥0になる不整合を防ぐ）
 */
export function applyLiveRatesToProspectMock(
  mock: BiProspectSummary,
  live: BiProspectSummary | null | undefined,
): BiProspectSummary {
  const rateByGrade = new Map(
    (live?.rows ?? []).map((r) => [r.grade, r.rate] as const),
  );
  const rows = mock.rows.map((r) => {
    const rate = rateByGrade.get(r.grade) ?? r.rate;
    return {
      ...r,
      rate,
      weightedRevenue: Math.round(r.baseRevenue * rate / 100),
    };
  });
  const companyRate = live?.special.companyRate ?? mock.special.companyRate;
  const special = {
    ...mock.special,
    companyRate,
    weightedRevenue: Math.round(mock.special.baseRevenue * companyRate / 100),
  };
  const totalBase = rows.reduce((s, r) => s + r.baseRevenue, 0);
  const totalWeighted = rows.reduce((s, r) => s + r.weightedRevenue, 0);
  return {
    rows,
    special,
    totalBase,
    totalWeighted,
    totalBaseWithSpecial: totalBase + special.baseRevenue,
    totalWeightedWithSpecial: totalWeighted + special.weightedRevenue,
    hasData: true,
    hasSpecial: special.customerCount > 0,
  };
}

/** 月別推移グラフ用（ダッシュボードモックと同系列） */
export function buildBiDashboardMonthlyCombo(
  fiscalMonthStart = DEFAULT_FISCAL_MONTH_START,
) {
  const months = buildFiscalMonthLabels(fiscalMonthStart).map((month) => ({ month }));
  return buildRealisticMonthlyComboData(
    months,
    MOCK_YTD_GP_MAN,
    MOCK_OVERHEAD_BUDGET_MAN,
  );
}
