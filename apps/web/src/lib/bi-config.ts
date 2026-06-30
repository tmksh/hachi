/** BI 分析設定（会社単位・SaaS 向け） */

export type BiSourceType = "constructions" | "deals" | "contracts" | "invoices";

export type BiDataSourceFilter = {
  type: BiSourceType;
  statuses?: string[];
  stages?: string[];
};

export type BiForecastTierConfig = {
  id: string;
  label: string;
  enabled: boolean;
  /** true の場合、前段階の着地にこの段階のソースを加算 */
  cumulative: boolean;
  sources: BiDataSourceFilter[];
};

export type BiCompanyConfig = {
  forecast_tiers: BiForecastTierConfig[];
  actual_sources: BiDataSourceFilter[];
  /** 請求のみ（工事原価なし）の粗利算出率 0〜1 */
  invoice_gross_profit_rate: number;
  /** 商談・契約など原価未設定レコードの粗利算出率 0〜1 */
  deal_gross_profit_rate: number;
  unassigned_department_label: string;
  /** 全社月次の製造間接費按分（部門別は常に売上構成比） */
  monthly_overhead_mode: "equal" | "revenue_share";
};

export const CONSTRUCTION_STATUSES = [
  { value: "preparing", label: "着工前" },
  { value: "in_progress", label: "施工中" },
  { value: "completed", label: "完工" },
  { value: "suspended", label: "中断" },
  { value: "delayed", label: "遅延" },
] as const;

export const DEAL_STAGES = [
  { value: "inquiry", label: "問い合わせ" },
  { value: "first_meeting", label: "初回面談" },
  { value: "materials_sent", label: "資料送付" },
  { value: "quote_submitted", label: "見積提出" },
  { value: "negotiation", label: "交渉中" },
  { value: "closing", label: "クロージング" },
  { value: "won", label: "受注" },
  { value: "lost", label: "失注" },
] as const;

export const CONTRACT_STATUSES = [
  { value: "preparing", label: "準備中" },
  { value: "contracted", label: "契約済" },
  { value: "executing", label: "履行中" },
  { value: "completed", label: "完了" },
  { value: "cancelled", label: "キャンセル" },
] as const;

export const INVOICE_STATUSES = [
  { value: "draft", label: "下書き" },
  { value: "sent", label: "送付済" },
  { value: "paid", label: "入金済" },
] as const;

/** 建設業向けデフォルト（A見込等はこの会社向けだが、他社は無効化・名称変更可能） */
export const DEFAULT_FORECAST_TIERS: BiForecastTierConfig[] = [
  {
    id: "contracted",
    label: "着地（契約済）",
    enabled: true,
    cumulative: false,
    sources: [{ type: "constructions", statuses: ["completed"] }],
  },
  {
    id: "prospective",
    label: "着地（A見込含）",
    enabled: true,
    cumulative: true,
    sources: [
      { type: "constructions", statuses: ["preparing", "in_progress"] },
      { type: "deals", stages: ["negotiation", "closing", "quote_submitted"] },
    ],
  },
];

export const DEFAULT_BI_COMPANY_CONFIG: BiCompanyConfig = {
  forecast_tiers: DEFAULT_FORECAST_TIERS,
  actual_sources: [
    { type: "constructions", statuses: ["completed"] },
    { type: "invoices", statuses: ["paid"] },
  ],
  invoice_gross_profit_rate: 0.25,
  deal_gross_profit_rate: 0.29,
  unassigned_department_label: "未分類",
  monthly_overhead_mode: "equal",
};

export function mergeBiCompanyConfig(raw: unknown): BiCompanyConfig {
  const partial = (raw && typeof raw === "object" ? raw : {}) as Partial<BiCompanyConfig>;
  return {
    forecast_tiers: partial.forecast_tiers?.length
      ? partial.forecast_tiers.map((t, i) => ({
          id: t.id || `tier-${i}`,
          label: t.label || `着地 ${i + 1}`,
          enabled: t.enabled ?? true,
          cumulative: t.cumulative ?? false,
          sources: t.sources ?? [],
        }))
      : DEFAULT_BI_COMPANY_CONFIG.forecast_tiers,
    actual_sources: partial.actual_sources?.length
      ? partial.actual_sources
      : DEFAULT_BI_COMPANY_CONFIG.actual_sources,
    invoice_gross_profit_rate:
      typeof partial.invoice_gross_profit_rate === "number"
        ? partial.invoice_gross_profit_rate
        : DEFAULT_BI_COMPANY_CONFIG.invoice_gross_profit_rate,
    deal_gross_profit_rate:
      typeof partial.deal_gross_profit_rate === "number"
        ? partial.deal_gross_profit_rate
        : DEFAULT_BI_COMPANY_CONFIG.deal_gross_profit_rate,
    unassigned_department_label:
      partial.unassigned_department_label || DEFAULT_BI_COMPANY_CONFIG.unassigned_department_label,
    monthly_overhead_mode:
      partial.monthly_overhead_mode === "revenue_share" ? "revenue_share" : "equal",
  };
}

export type BiMetricRecord = {
  key: string;
  departmentName: string | null;
  revenue: number;
  grossProfit: number;
  date: string | null;
};

/**
 * 日付文字列から年度内の月インデックス（0始まり）を返す。
 * @param dateStr 日付文字列
 * @param startMonth 年度始まり月（1=1月〜12=12月, デフォルト 4=4月）
 */
export function fiscalMonthIndex(dateStr: string, startMonth = 4): number {
  const d = new Date(dateStr);
  const calendarMonth = d.getMonth() + 1; // 1〜12
  return ((calendarMonth - startMonth + 12) % 12);
}

export function matchesFilter(
  value: string | null | undefined,
  allowed?: string[]
): boolean {
  if (!allowed?.length) return true;
  return !!value && allowed.includes(value);
}

export function resolveDepartmentName(
  raw: string | null | undefined,
  departments: string[],
  unassignedLabel: string
): string {
  if (raw && departments.includes(raw)) return raw;
  if (raw) return raw;
  return unassignedLabel;
}

export function deptLabel(index: number): string {
  return `${String.fromCharCode(65 + index)}部門`;
}

export type BiForecastResult = {
  id: string;
  label: string;
  revenue: number;
  grossProfit: number;
};

export function aggregateForecastTiers(
  tiers: BiForecastTierConfig[],
  recordsByTier: Map<string, BiMetricRecord[]>
): BiForecastResult[] {
  const enabled = tiers.filter((t) => t.enabled);
  const results: BiForecastResult[] = [];
  let cumulativeRevenue = 0;
  let cumulativeGp = 0;

  for (const tier of enabled) {
    const tierRecords = recordsByTier.get(tier.id) ?? [];
    let revenue = tierRecords.reduce((s, r) => s + r.revenue, 0);
    let grossProfit = tierRecords.reduce((s, r) => s + r.grossProfit, 0);

    if (tier.cumulative) {
      revenue += cumulativeRevenue;
      grossProfit += cumulativeGp;
    }

    cumulativeRevenue = revenue;
    cumulativeGp = grossProfit;

    results.push({
      id: tier.id,
      label: tier.label,
      revenue: Math.round(revenue / 10000),
      grossProfit: Math.round(grossProfit / 10000),
    });
  }

  return results;
}

export type PeriodGranularity = "month" | "quarter" | "year";

export type BiChartPoint = {
  label: string;
  revenue: number;
  grossProfit: number;
  grossProfitTotal: number;
  operatingProfit: number;
};

export type BiBudgetChangeEntry = {
  field_name: "overhead_budget" | "sga_budget" | "target_revenue" | "target_gross_profit";
  old_value: number;
  new_value: number;
  effective_from: string;
};

/** 指定日時点で有効な年額予算（変更履歴を遡及適用） */
export function effectiveBudgetAtDate(
  baseline: number,
  changes: BiBudgetChangeEntry[],
  fieldName: BiBudgetChangeEntry["field_name"],
  date: string
): number {
  let value = baseline;
  for (const change of [...changes]
    .filter((c) => c.field_name === fieldName)
    .sort((a, b) => a.effective_from.localeCompare(b.effective_from))) {
    if (change.effective_from <= date) value = change.new_value;
  }
  return value;
}

/**
 * 年度内月インデックス（0始まり）から期末日付文字列（YYYY-MM-DD）を返す。
 * @param fiscalYear 会計年度（西暦）
 * @param monthIndex 年度内月インデックス 0〜11
 * @param startMonth 年度始まり月（1=1月〜12=12月, デフォルト 4=4月）
 */
export function fiscalMonthEndDate(fiscalYear: number, monthIndex: number, startMonth = 4): string {
  const calendarMonth = ((startMonth - 1 + monthIndex) % 12) + 1; // 1〜12
  const yearOffset = (startMonth - 1 + monthIndex) >= 12 ? 1 : 0;
  const calendarYear = fiscalYear + yearOffset;
  const lastDay = new Date(calendarYear, calendarMonth, 0).getDate();
  return `${calendarYear}-${String(calendarMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

/** 年額予算を月次均等按分（期中変更を月ごとに遡及適用） */
export function buildMonthlyBudgetAllocations(
  fiscalYear: number,
  fieldName: BiBudgetChangeEntry["field_name"],
  baselineMan: number,
  changes: BiBudgetChangeEntry[],
  startMonth = 4,
): number[] {
  return Array.from({ length: 12 }, (_, i) => {
    const monthEnd = fiscalMonthEndDate(fiscalYear, i, startMonth);
    const annual = effectiveBudgetAtDate(baselineMan, changes, fieldName, monthEnd);
    return Math.round(annual / 12);
  });
}

export function buildMonthlyOverheadAllocations(
  fiscalYear: number,
  baselineOverheadMan: number,
  changes: BiBudgetChangeEntry[],
  startMonth = 4,
): number[] {
  return buildMonthlyBudgetAllocations(fiscalYear, "overhead_budget", baselineOverheadMan, changes, startMonth);
}

/** 均等按分の合計を保ちつつ、月次売上構成比で再配分 */
export function applyRevenueShareOverhead(
  monthlyRevenue: number[],
  monthlyEqualOverhead: number[]
): number[] {
  const totalRev = monthlyRevenue.reduce((s, v) => s + v, 0);
  const totalOverhead = monthlyEqualOverhead.reduce((s, v) => s + v, 0);
  if (totalRev <= 0 || totalOverhead <= 0) {
    return monthlyEqualOverhead.map(() => 0);
  }
  return monthlyRevenue.map((rev) => Math.round(totalOverhead * rev / totalRev));
}

export function aggregateChartPeriods(
  monthly: Array<{ month: string; revenue: number; grossProfit: number }>,
  granularity: PeriodGranularity,
  monthlyOverheadAllocations: number[],
  monthlySgaAllocations: number[] = []
): BiChartPoint[] {
  const buildPoint = (
    label: string,
    revenue: number,
    grossProfit: number,
    overhead: number,
    sga: number
  ): BiChartPoint => {
    const grossProfitTotal = grossProfit - overhead;
    return {
      label,
      revenue,
      grossProfit,
      grossProfitTotal,
      operatingProfit: grossProfitTotal - sga,
    };
  };

  if (granularity === "month") {
    return monthly.map((m, i) =>
      buildPoint(
        m.month,
        m.revenue,
        m.grossProfit,
        monthlyOverheadAllocations[i] ?? 0,
        monthlySgaAllocations[i] ?? 0
      )
    );
  }

  if (granularity === "quarter") {
    const quarters = ["Q1 (4-6月)", "Q2 (7-9月)", "Q3 (10-12月)", "Q4 (1-3月)"];
    return quarters.map((label, qi) => {
      const slice = monthly.slice(qi * 3, qi * 3 + 3);
      const overheadSlice = monthlyOverheadAllocations.slice(qi * 3, qi * 3 + 3);
      const sgaSlice = monthlySgaAllocations.slice(qi * 3, qi * 3 + 3);
      const revenue = slice.reduce((s, m) => s + m.revenue, 0);
      const grossProfit = slice.reduce((s, m) => s + m.grossProfit, 0);
      const overhead = overheadSlice.reduce((s, v) => s + v, 0);
      const sga = sgaSlice.reduce((s, v) => s + v, 0);
      return buildPoint(label, revenue, grossProfit, overhead, sga);
    });
  }

  const revenue = monthly.reduce((s, m) => s + m.revenue, 0);
  const grossProfit = monthly.reduce((s, m) => s + m.grossProfit, 0);
  const overhead = monthlyOverheadAllocations.reduce((s, v) => s + v, 0);
  const sga = monthlySgaAllocations.reduce((s, v) => s + v, 0);
  return [buildPoint("通期", revenue, grossProfit, overhead, sga)];
}

export type BiDeptMonthlyPoint = {
  month: string;
  revenue: number;
  grossProfit: number;
  grossProfitTotal: number;
};

/** 部門別月次（製造間接費は当月全社売上構成比で按分 §3.3） */
export function buildDeptMonthlySeries(
  monthlyDeptRevenue: number[],
  monthlyDeptGrossProfit: number[],
  monthlyCompanyRevenue: number[],
  monthlyOverheadAllocations: number[],
  monthLabels: string[]
): BiDeptMonthlyPoint[] {
  return monthLabels.map((month, i) => {
    const share = monthlyCompanyRevenue[i] > 0
      ? monthlyDeptRevenue[i] / monthlyCompanyRevenue[i]
      : 0;
    const deptOverhead = Math.round(monthlyOverheadAllocations[i] * share);
    return {
      month,
      revenue: monthlyDeptRevenue[i],
      grossProfit: monthlyDeptGrossProfit[i],
      grossProfitTotal: monthlyDeptGrossProfit[i] - deptOverhead,
    };
  });
}
