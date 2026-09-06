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

  const mockLocations = [
    { id: "mock-loc-hq", name: "本社", target_revenue: 2200, sga_budget: 0, revenue: 1400, grossProfit: 820 },
    { id: "mock-loc-tokyo", name: "東京支店", target_revenue: 2000, sga_budget: 0, revenue: 1100, grossProfit: 640 },
    { id: "mock-loc-osaka", name: "大阪支店", target_revenue: 1600, sga_budget: 0, revenue: 680, grossProfit: 390 },
    { id: "mock-loc-nagoya", name: "名古屋支店", target_revenue: 1300, sga_budget: 0, revenue: 340, grossProfit: 213 },
  ] as const;

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
    location_targets: mockLocations.map((l, i) => ({
      id: `mock-loc-target-${i}`,
      location_id: l.id,
      location_name: l.name,
      target_revenue: l.target_revenue,
      sga_budget: l.sga_budget,
      sort_order: i,
    })),
    reserve_fee_rate: 0,
    reserve_released: false,
    reserve_released_at: null,
    base_gross_profit_rate: 0.5,
  };

  const actuals: BiActuals = {
    deptActuals: MOCK_DEPT_ACTUALS.map((d) => ({ ...d })),
    locationActuals: mockLocations.map((l, i) => ({
      id: l.id,
      name: l.name,
      label: ["A拠点", "B拠点", "C拠点", "D拠点"][i] ?? "—",
      revenue: l.revenue,
      grossProfit: l.grossProfit,
    })),
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
 * 実CRMが空のときのフォールバック専用。実データがあるときは使わない。
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

/**
 * 見込み売上（期待値）は CRM の見込度を正とする。
 * 当年度デモモック中でも実集計があればそれを出し、空のときだけデモ母数を使う。
 */
export function resolveDashboardProspectSummary(
  mock: BiProspectSummary | undefined,
  live: BiProspectSummary | null | undefined,
): BiProspectSummary | null | undefined {
  if (live?.hasData) return live;
  if (mock) return applyLiveRatesToProspectMock(mock, live);
  return live;
}

/** No.75 モック案件行（部門別・万円）。規定割れが一目で分かるよう粗利率にばらつきを持たせる */
const MOCK_DEPT_PROJECTS: Record<string, Array<{
  customerName: string;
  projectName: string;
  revenue: number;
  grossProfitRate: number;
}>> = {
  一般住宅: [
    { customerName: "田中様", projectName: "中川町新築", revenue: 320, grossProfitRate: 62.1 },
    { customerName: "佐藤様", projectName: "港区リノベーション", revenue: 280, grossProfitRate: 59.4 },
    { customerName: "山本様", projectName: "名東区リノベーション", revenue: 250, grossProfitRate: 41.2 },
    { customerName: "伊藤様", projectName: "昭和区増築", revenue: 210, grossProfitRate: 38.5 },
    { customerName: "鈴木様", projectName: "千種区内装リフォーム", revenue: 140, grossProfitRate: 66.0 },
  ],
  新築: [
    { customerName: "加藤様", projectName: "天白区新築戸建", revenue: 420, grossProfitRate: 61.2 },
    { customerName: "中村様", projectName: "緑区注文住宅", revenue: 380, grossProfitRate: 58.0 },
    { customerName: "小林建設", projectName: "守山区建売（3棟）", revenue: 310, grossProfitRate: 42.5 },
    { customerName: "吉田様", projectName: "瑞穂区新築", revenue: 220, grossProfitRate: 55.8 },
    { customerName: "松本様", projectName: "熱田区狭小住宅", revenue: 120, grossProfitRate: 48.0 },
  ],
  公共工事: [
    { customerName: "市役所", projectName: "区役所改修工事", revenue: 210, grossProfitRate: 52.0 },
    { customerName: "教育委員会", projectName: "小学校体育館改修", revenue: 160, grossProfitRate: 48.5 },
    { customerName: "水道局", projectName: "配水管更新工事", revenue: 110, grossProfitRate: 44.0 },
    { customerName: "公園緑地課", projectName: "公園トイレ新設", revenue: 80, grossProfitRate: 55.5 },
    { customerName: "消防本部", projectName: "署舎耐震補強", revenue: 60, grossProfitRate: 39.0 },
  ],
  リフォーム: [
    { customerName: "渡辺様", projectName: "キッチン全面改装", revenue: 85, grossProfitRate: 72.0 },
    { customerName: "斎藤様", projectName: "浴室・洗面改修", revenue: 60, grossProfitRate: 68.5 },
    { customerName: "清水様", projectName: "外壁塗装", revenue: 45, grossProfitRate: 55.0 },
    { customerName: "森田様", projectName: "屋根葺き替え", revenue: 35, grossProfitRate: 48.0 },
    { customerName: "池田様", projectName: "内装リフォーム", revenue: 25, grossProfitRate: 80.0 },
  ],
};

/** 部門PJ一覧（No.75）のモック行。BI本体がモック表示の年度で使用（万円） */
export function buildBiDepartmentProjectsMock(departmentName: string): Array<{
  id: string;
  customerName: string;
  projectName: string;
  revenue: number;
  grossProfitRate: number;
  grossProfit: number;
  cost: number;
}> {
  const preset = MOCK_DEPT_PROJECTS[departmentName];
  if (preset) {
    return preset.map((r, i) => {
      const grossProfit = Math.round((r.revenue * r.grossProfitRate) / 100);
      return {
        id: `mock-${departmentName}-${i}`,
        customerName: r.customerName,
        projectName: r.projectName,
        revenue: r.revenue,
        grossProfitRate: r.grossProfitRate,
        grossProfit,
        cost: r.revenue - grossProfit,
      };
    });
  }

  // 拠点名など部門プリセット外でもモック行を返す（No.80）
  const dept = MOCK_DEPT_ACTUALS.find((d) => d.name === departmentName)
    ?? { name: departmentName, label: "", revenue: 900, grossProfit: 520 };

  const customers = ["田中様", "佐藤様", "鈴木建設", "山本様", "高橋不動産"];
  const shares = [0.34, 0.26, 0.18, 0.13, 0.09];
  const rateJitter = [1.6, -12.1, 0.8, -14.2, 2.4];
  const baseRate = dept.revenue > 0 ? (dept.grossProfit / dept.revenue) * 100 : 50;

  return shares.map((share, i) => {
    const revenue = Math.round(dept.revenue * share);
    const rate = Math.round((baseRate + rateJitter[i]) * 10) / 10;
    const grossProfit = Math.round((revenue * rate) / 100);
    return {
      id: `mock-${departmentName}-${i}`,
      customerName: customers[i],
      projectName: `${departmentName}工事 PJ-${i + 1}`,
      revenue,
      grossProfitRate: rate,
      grossProfit,
      cost: revenue - grossProfit,
    };
  });
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
