/** BI 型定義・定数（クライアント/サーバー共用、"use server" 非依存） */

export type BiOverheadItem = {
  id: string;
  name: string;
  amount: number;
  sort_order: number;
  is_custom: boolean;
};

export type BiDepartmentTarget = {
  id: string;
  department_name: string;
  target_revenue: number;
  target_gross_profit: number;
  sort_order: number;
};

export type BiAnnualSettings = {
  id: string;
  fiscal_year: number;
  target_revenue: number;
  target_gross_profit: number;
  overhead_budget: number;
  sga_budget: number;
  overhead_mode: "breakdown" | "lump_sum";
  overhead_items: BiOverheadItem[];
  department_targets: BiDepartmentTarget[];
};

export type BiBudgetChangeLog = {
  id: string;
  field_name: "overhead_budget" | "sga_budget" | "target_revenue" | "target_gross_profit";
  old_value: number;
  new_value: number;
  effective_from: string;
  note: string | null;
  created_at: string;
  changer?: { display_name: string } | null;
};

export type BiDeptActual = {
  name: string;
  label: string;
  revenue: number;
  grossProfit: number;
};

export type BiMonthlyActual = {
  month: string;
  revenue: number;
  grossProfit: number;
};

export type BiForecastTierActual = {
  id: string;
  label: string;
  revenue: number;
  grossProfit: number;
};

export type BiDeptMonthlySeries = {
  name: string;
  label: string;
  months: Array<{ month: string; revenue: number; grossProfit: number; grossProfitTotal: number }>;
};

export type BiActuals = {
  deptActuals: BiDeptActual[];
  monthly: BiMonthlyActual[];
  monthlyByDept: BiDeptMonthlySeries[];
  monthlyOverheadAllocations: number[];
  monthlySgaAllocations: number[];
  forecastTiers: BiForecastTierActual[];
  hasData: boolean;
  sparklines: {
    revenue: number[];
    grossProfitRate: number[];
    grossProfitTotal: number[];
    operatingProfit: number[];
  };
  deltas: {
    grossProfitRatePt: number | null;
    revenueAchievePct: number | null;
  };
};

export const DEFAULT_OVERHEAD_ITEMS: Omit<BiOverheadItem, "id">[] = [
  { name: "労務費",      amount: 0, sort_order: 0,  is_custom: false },
  { name: "法定福利費",  amount: 0, sort_order: 1,  is_custom: false },
  { name: "福利厚生費",  amount: 0, sort_order: 2,  is_custom: false },
  { name: "労務管理費",  amount: 0, sort_order: 3,  is_custom: false },
  { name: "動力費",      amount: 0, sort_order: 4,  is_custom: false },
  { name: "支払保険料",  amount: 0, sort_order: 5,  is_custom: false },
  { name: "修繕費",      amount: 0, sort_order: 6,  is_custom: false },
  { name: "水道光熱費",  amount: 0, sort_order: 7,  is_custom: false },
  { name: "租税公課",    amount: 0, sort_order: 8,  is_custom: false },
  { name: "事務用品費",  amount: 0, sort_order: 9,  is_custom: false },
  { name: "リース料",    amount: 0, sort_order: 10, is_custom: false },
  { name: "設計費",      amount: 0, sort_order: 11, is_custom: false },
  { name: "通信交通費",  amount: 0, sort_order: 12, is_custom: false },
  { name: "交際費",      amount: 0, sort_order: 13, is_custom: false },
  { name: "雑費",        amount: 0, sort_order: 14, is_custom: false },
];

export type { BiCompanyConfig, BiForecastTierConfig, BiDataSourceFilter } from "@/lib/bi-config";
