"use server";

import { createClient } from "@/lib/supabase/server";
import { getCompanyFiscalMonthStart } from "@/lib/actions/profiles";
import { getCurrentFiscalYear, buildFiscalMonthLabels } from "@/lib/bi-utils";

export type PerformanceMonth = {
  month: string;
  plan: number;
  actual: number;
  /** 達成率%（計画0の場合は null） */
  rate: number | null;
};

export type PerformanceData = {
  fiscalYear: number;
  fiscalMonthStart: number;
  /** 目標が未設定で実績平均×1.1 の仮目標を使っている場合 true */
  isProvisionalTarget: boolean;
  annualPlan: number;
  totalActual: number;
  achievementRate: number | null;
  months: PerformanceMonth[];
  /** 部門フィルタ候補（profiles.department の distinct 値） */
  departments: string[];
};

function fiscalYearRange(year: number, startMonth: number) {
  const sm = String(startMonth).padStart(2, "0");
  const endMonth = startMonth === 1 ? 12 : startMonth - 1;
  const endYear = startMonth === 1 ? year : year + 1;
  const endDay = new Date(endYear, endMonth, 0).getDate();
  const em = String(endMonth).padStart(2, "0");
  return {
    start: `${year}-${sm}-01`,
    end: `${endYear}-${em}-${String(endDay).padStart(2, "0")}`,
  };
}

function fiscalMonthIndex(dateStr: string, startMonth: number): number {
  const month = Number(dateStr.slice(5, 7));
  return (month - startMonth + 12) % 12;
}

export async function getPerformanceData(input: {
  year?: number;
  department?: string;
}): Promise<PerformanceData | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();
  if (!profile?.company_id) return null;

  const fiscalMonthStart = await getCompanyFiscalMonthStart();
  const year = input.year ?? getCurrentFiscalYear(fiscalMonthStart);
  const { start, end } = fiscalYearRange(year, fiscalMonthStart);
  const monthLabels = buildFiscalMonthLabels(fiscalMonthStart);

  const [{ data: constructions }, { data: invoices }, { data: profiles }, { data: company }] = await Promise.all([
    supabase
      .from("constructions")
      .select("id, status, order_amount, start_date, end_date, assigned_to")
      .in("status", ["completed", "in_progress"]),
    supabase
      .from("invoices")
      .select("id, total, status, paid_at, construction_id")
      .eq("status", "paid")
      .gte("paid_at", start)
      .lte("paid_at", end),
    supabase
      .from("profiles")
      .select("id, department")
      .eq("company_id", profile.company_id),
    supabase
      .from("companies")
      .select("settings")
      .eq("id", profile.company_id)
      .single(),
  ]);

  const departments = [...new Set(
    (profiles ?? []).map((p) => p.department).filter((d): d is string => !!d?.trim()),
  )].sort();

  const departmentByProfile = new Map((profiles ?? []).map((p) => [p.id, p.department]));
  const matchesDept = (assignedTo: string | null) => {
    if (!input.department) return true;
    if (!assignedTo) return false;
    return departmentByProfile.get(assignedTo) === input.department;
  };

  // 実績: 工事の契約金額（完了・進行中）を月別集計
  const actuals = Array(12).fill(0) as number[];
  const countedConstructionIds = new Set<string>();
  for (const c of constructions ?? []) {
    const date = c.end_date ?? c.start_date;
    if (!date || date < start || date > end) continue;
    if (!matchesDept(c.assigned_to)) continue;
    countedConstructionIds.add(c.id);
    actuals[fiscalMonthIndex(date, fiscalMonthStart)] += Number(c.order_amount ?? 0);
  }

  // 実績: 入金済み請求。工事側で計上済みのものは二重計上を避けて除外
  const constructionById = new Map((constructions ?? []).map((c) => [c.id, c]));
  for (const inv of invoices ?? []) {
    if (!inv.paid_at) continue;
    if (inv.construction_id && countedConstructionIds.has(inv.construction_id)) continue;
    if (input.department) {
      // 部門は工事担当者から解決。工事に紐づかない請求は部門絞り込み時は対象外
      const linked = inv.construction_id ? constructionById.get(inv.construction_id) : undefined;
      if (!linked || !matchesDept(linked.assigned_to)) continue;
    }
    actuals[fiscalMonthIndex(inv.paid_at, fiscalMonthStart)] += Number(inv.total ?? 0);
  }

  // 計画: settings.monthly_target → annual_target / 12 → 実績平均×1.1（仮目標）
  const settings = (company?.settings ?? {}) as Record<string, unknown>;
  const monthlyTarget = typeof settings.monthly_target === "number" && settings.monthly_target > 0
    ? settings.monthly_target
    : null;
  const annualTarget = typeof settings.annual_target === "number" && settings.annual_target > 0
    ? settings.annual_target
    : null;

  let monthlyPlan: number;
  let isProvisionalTarget = false;
  if (monthlyTarget != null) {
    monthlyPlan = monthlyTarget;
  } else if (annualTarget != null) {
    monthlyPlan = Math.round(annualTarget / 12);
  } else {
    const activeMonths = actuals.filter((v) => v > 0);
    const avg = activeMonths.length > 0
      ? activeMonths.reduce((s, v) => s + v, 0) / activeMonths.length
      : 0;
    monthlyPlan = Math.round(avg * 1.1);
    isProvisionalTarget = true;
  }

  const months: PerformanceMonth[] = monthLabels.map((month, i) => ({
    month,
    plan: monthlyPlan,
    actual: actuals[i],
    rate: monthlyPlan > 0 ? Math.round((actuals[i] / monthlyPlan) * 1000) / 10 : null,
  }));

  const annualPlan = monthlyPlan * 12;
  const totalActual = actuals.reduce((s, v) => s + v, 0);

  return {
    fiscalYear: year,
    fiscalMonthStart,
    isProvisionalTarget,
    annualPlan,
    totalActual,
    achievementRate: annualPlan > 0 ? Math.round((totalActual / annualPlan) * 1000) / 10 : null,
    months,
    departments,
  };
}
