"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentFiscalYear, DEFAULT_DEPARTMENTS, buildFiscalMonthLabels, normalizeBudgetMan } from "@/lib/bi-utils";
import { getCompanyFiscalMonthStart } from "@/lib/actions/profiles";
import type {
  BiAnnualSettings,
  BiBudgetChangeLog,
  BiActuals,
  BiDeptActual,
  BiMonthlyActual,
  BiForecastTierActual,
  BiDeptMonthlySeries,
  BiOverheadItem,
  BiDepartmentTarget,
} from "@/lib/bi-types";
import {
  aggregateForecastTiers,
  buildDeptMonthlySeries,
  buildMonthlyOverheadAllocations,
  buildMonthlyBudgetAllocations,
  applyRevenueShareOverhead,
  DEFAULT_BI_COMPANY_CONFIG,
  fiscalMonthIndex,
  matchesFilter,
  mergeBiCompanyConfig,
  resolveDepartmentName,
  deptLabel,
  type BiBudgetChangeEntry,
  type BiCompanyConfig,
  type BiDataSourceFilter,
  type BiForecastTierConfig,
  type BiMetricRecord,
} from "@/lib/bi-config";

function fiscalYearRange(year: number, startMonth = 4) {
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

function toManYen(v: number) {
  return Math.round(v / 10000);
}

async function getCompanyId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, companyId: null as string | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  return { supabase, companyId: profile?.company_id ?? null };
}

/**
 * 予備費の設定・決算戻しを操作できるロールか判定する。
 * 会社設定(companies.settings.role_permissions.reserve_fee)の許可ロール配列で制御し、
 * 未設定の場合は本部管理者(hq_admin)のみを既定とする。
 */
async function roleCanManageReserve(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  role: string | null | undefined,
): Promise<boolean> {
  if (!role) return false;
  const { data: company } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .maybeSingle();
  const perms = (company?.settings as { role_permissions?: Record<string, string[]> } | null)?.role_permissions;
  const allowed = perms?.reserve_fee ?? ["hq_admin"];
  return allowed.includes(role);
}

// ── 会社別 BI 分析設定 ────────────────────────────────────────────────
export async function getBiCompanyConfig(): Promise<BiCompanyConfig> {
  const { supabase, companyId } = await getCompanyId();
  if (!companyId) return DEFAULT_BI_COMPANY_CONFIG;

  const { data } = await supabase
    .from("bi_company_config")
    .select("config")
    .eq("company_id", companyId)
    .maybeSingle();

  return mergeBiCompanyConfig(data?.config);
}

export async function saveBiCompanyConfig(config: BiCompanyConfig): Promise<{ ok: boolean; error?: string }> {
  const { supabase, companyId } = await getCompanyId();
  if (!companyId) return { ok: false, error: "認証が必要です" };

  const { error } = await supabase
    .from("bi_company_config")
    .upsert({
      company_id: companyId,
      config: mergeBiCompanyConfig(config),
      updated_at: new Date().toISOString(),
    }, { onConflict: "company_id" });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── 現在の年度設定を取得 ─────────────────────────────────────────────
export async function getBiSettings(fiscalYear?: number): Promise<BiAnnualSettings | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const fiscalMonthStart = await getCompanyFiscalMonthStart();
  const year = fiscalYear ?? getCurrentFiscalYear(fiscalMonthStart);

  const { data, error } = await supabase
    .from("bi_annual_settings")
    .select(`
      *,
      overhead_items:bi_overhead_items(id, name, amount, sort_order, is_custom),
      department_targets:bi_department_targets(id, department_name, target_revenue, target_gross_profit, sort_order)
    `)
    .eq("fiscal_year", year)
    .single();

  if (error || !data) return null;

  return {
    ...data,
    target_revenue: normalizeBudgetMan(Number(data.target_revenue)),
    target_gross_profit: normalizeBudgetMan(Number(data.target_gross_profit)),
    overhead_budget: normalizeBudgetMan(Number(data.overhead_budget)),
    sga_budget: normalizeBudgetMan(Number(data.sga_budget)),
    reserve_fee_rate: Number(data.reserve_fee_rate ?? 0),
    reserve_released: Boolean(data.reserve_released ?? false),
    reserve_released_at: data.reserve_released_at ?? null,
    base_gross_profit_rate: Number(data.base_gross_profit_rate ?? 0.5),
    overhead_items: (data.overhead_items ?? [])
      .map((item: BiOverheadItem) => ({
        ...item,
        amount: normalizeBudgetMan(Number(item.amount)),
      }))
      .sort((a: BiOverheadItem, b: BiOverheadItem) => a.sort_order - b.sort_order),
    department_targets: (data.department_targets ?? [])
      .map((dept: BiDepartmentTarget) => ({
        ...dept,
        target_revenue: normalizeBudgetMan(Number(dept.target_revenue)),
        target_gross_profit: normalizeBudgetMan(Number(dept.target_gross_profit)),
      }))
      .sort((a: BiDepartmentTarget, b: BiDepartmentTarget) => a.sort_order - b.sort_order),
  } as BiAnnualSettings;
}

// ── 設定を保存（upsert） ─────────────────────────────────────────────
const BUDGET_TRACKED_FIELDS = [
  "overhead_budget",
  "sga_budget",
  "target_revenue",
  "target_gross_profit",
] as const;

export async function getBiBudgetChangeLog(fiscalYear?: number): Promise<BiBudgetChangeLog[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const year = fiscalYear ?? getCurrentFiscalYear();
  const { data, error } = await supabase
    .from("bi_budget_change_log")
    .select("id, field_name, old_value, new_value, effective_from, note, created_at")
    .eq("fiscal_year", year)
    .order("effective_from", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => ({
    ...row,
    old_value: Number(row.old_value),
    new_value: Number(row.new_value),
  })) as BiBudgetChangeLog[];
}

export async function saveBiSettings(input: {
  fiscal_year: number;
  target_revenue: number;
  target_gross_profit: number;
  overhead_budget: number;
  sga_budget: number;
  overhead_mode: "breakdown" | "lump_sum";
  overhead_items: Array<{ name: string; amount: number; sort_order: number; is_custom: boolean }>;
  department_targets: Array<{ department_name: string; target_revenue: number; target_gross_profit: number; sort_order: number }>;
  /** 予備費率（0〜1）。管理者(hq_admin)のみ変更が反映される */
  reserve_fee_rate?: number;
  /** 会社指定粗利率（0〜1）。管理者のみ変更が反映される */
  base_gross_profit_rate?: number;
  budget_change?: {
    effective_from?: string;
    note?: string;
  };
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "認証が必要です" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single();
  if (!profile) return { ok: false, error: "プロフィールが見つかりません" };

  const { company_id } = profile;
  const isAdmin = await roleCanManageReserve(supabase, company_id, profile.role);

  const budget = {
    target_revenue: normalizeBudgetMan(input.target_revenue),
    target_gross_profit: normalizeBudgetMan(input.target_gross_profit),
    overhead_budget: normalizeBudgetMan(input.overhead_budget),
    sga_budget: normalizeBudgetMan(input.sga_budget),
  };

  const { data: existing } = await supabase
    .from("bi_annual_settings")
    .select("id, target_revenue, target_gross_profit, overhead_budget, sga_budget, reserve_fee_rate, base_gross_profit_rate")
    .eq("company_id", company_id)
    .eq("fiscal_year", input.fiscal_year)
    .maybeSingle();

  // 予備費率・会社指定粗利率は管理者のみ変更可。非管理者の保存では既存値を保持する
  const existingReserve = Number(existing?.reserve_fee_rate ?? 0);
  const reserveRate = isAdmin && input.reserve_fee_rate != null
    ? Math.min(1, Math.max(0, input.reserve_fee_rate))
    : existingReserve;
  const existingBase = Number(existing?.base_gross_profit_rate ?? 0.5);
  const baseRate = isAdmin && input.base_gross_profit_rate != null
    ? Math.min(1, Math.max(0, input.base_gross_profit_rate))
    : existingBase;

  const { data: setting, error: settingErr } = await supabase
    .from("bi_annual_settings")
    .upsert({
      company_id,
      fiscal_year: input.fiscal_year,
      target_revenue: budget.target_revenue,
      target_gross_profit: budget.target_gross_profit,
      overhead_budget: budget.overhead_budget,
      sga_budget: budget.sga_budget,
      overhead_mode: input.overhead_mode,
      reserve_fee_rate: reserveRate,
      base_gross_profit_rate: baseRate,
      updated_at: new Date().toISOString(),
    }, { onConflict: "company_id,fiscal_year" })
    .select()
    .single();

  if (settingErr || !setting) return { ok: false, error: settingErr?.message };

  const effectiveFrom = input.budget_change?.effective_from || new Date().toISOString().slice(0, 10);
  const changeNote = input.budget_change?.note?.trim() || null;
  const nextValues = {
    overhead_budget: budget.overhead_budget,
    sga_budget: budget.sga_budget,
    target_revenue: budget.target_revenue,
    target_gross_profit: budget.target_gross_profit,
  };

  const changeRows: Array<{
    company_id: string;
    setting_id: string;
    fiscal_year: number;
    field_name: typeof BUDGET_TRACKED_FIELDS[number];
    old_value: number;
    new_value: number;
    effective_from: string;
    note: string | null;
    changed_by: string;
  }> = [];

  for (const field of BUDGET_TRACKED_FIELDS) {
    const oldValue = normalizeBudgetMan(Number(existing?.[field] ?? 0));
    const newValue = Number(nextValues[field]);
    if (existing && oldValue !== newValue) {
      changeRows.push({
        company_id,
        setting_id: setting.id,
        fiscal_year: input.fiscal_year,
        field_name: field,
        old_value: oldValue,
        new_value: newValue,
        effective_from: effectiveFrom,
        note: changeNote,
        changed_by: user.id,
      });
    }
  }

  if (changeRows.length > 0) {
    const { error: logErr } = await supabase.from("bi_budget_change_log").insert(changeRows);
    if (logErr) return { ok: false, error: logErr.message };
  }

  await supabase.from("bi_overhead_items").delete().eq("setting_id", setting.id);
  await supabase.from("bi_department_targets").delete().eq("setting_id", setting.id);

  if (input.overhead_items.length > 0) {
    const { error: itemsErr } = await supabase.from("bi_overhead_items").insert(
      input.overhead_items.map((item) => ({
        company_id,
        setting_id: setting.id,
        name: item.name,
        amount: normalizeBudgetMan(item.amount),
        sort_order: item.sort_order,
        is_custom: item.is_custom,
      }))
    );
    if (itemsErr) return { ok: false, error: itemsErr.message };
  }

  if (input.department_targets.length > 0) {
    const { error: deptErr } = await supabase.from("bi_department_targets").insert(
      input.department_targets.map((dept) => ({
        company_id,
        setting_id: setting.id,
        department_name: dept.department_name,
        target_revenue: normalizeBudgetMan(dept.target_revenue),
        target_gross_profit: normalizeBudgetMan(dept.target_gross_profit),
        sort_order: dept.sort_order,
      }))
    );
    if (deptErr) return { ok: false, error: deptErr.message };
  }

  return { ok: true };
}

// ── 決算：予備費を利益に戻す／取り消す（管理者のみ） ──────────────────
export async function releaseReserve(
  fiscalYear: number,
  release: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "認証が必要です" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single();
  if (!profile) return { ok: false, error: "プロフィールが見つかりません" };
  if (!(await roleCanManageReserve(supabase, profile.company_id, profile.role))) {
    return { ok: false, error: "予備費の決算戻しを操作する権限がありません" };
  }

  const { error } = await supabase
    .from("bi_annual_settings")
    .update({
      reserve_released: release,
      reserve_released_at: release ? new Date().toISOString() : null,
      reserve_released_by: release ? user.id : null,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", profile.company_id)
    .eq("fiscal_year", fiscalYear);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── 実績データ集計 ────────────────────────────────────────────────────
function constructionMetrics(
  row: { order_amount?: number | null; actual_cost?: number | null; budget_cost?: number | null },
  invoiceRate: number
) {
  const revenue = Number(row.order_amount ?? 0);
  const cost = Number(row.actual_cost ?? row.budget_cost ?? 0);
  const grossProfit = revenue > 0 && cost > 0 ? revenue - cost : revenue * invoiceRate;
  return { revenue, grossProfit };
}

function dealMetrics(
  row: { value?: number | null },
  dealRate: number
) {
  const revenue = Number(row.value ?? 0);
  return { revenue, grossProfit: revenue * dealRate };
}

function contractMetrics(
  row: { amount?: number | null },
  dealRate: number
) {
  const revenue = Number(row.amount ?? 0);
  return { revenue, grossProfit: revenue * dealRate };
}

function invoiceMetrics(
  row: { total?: number | null },
  invoiceRate: number
) {
  const revenue = Number(row.total ?? 0);
  return { revenue, grossProfit: revenue * invoiceRate };
}

function shouldSkipLinkedInvoice(
  inv: { construction_id?: string | null },
  data: Parameters<typeof recordsFromSource>[1],
  sources: BiDataSourceFilter[],
  dateField: "actual" | "forecast",
  fiscalStart: string,
  fiscalEnd: string
): boolean {
  if (!inv.construction_id) return false;
  const constructionSource = sources.find((s) => s.type === "constructions");
  if (!constructionSource) return false;

  const linked = data.constructionById.get(inv.construction_id);
  if (!linked || !matchesFilter((linked as { status?: string }).status, constructionSource.statuses)) {
    return false;
  }

  const c = data.constructions.find((row) => row.id === inv.construction_id);
  if (!c) return false;

  const cDate = dateField === "actual" ? c.end_date : c.end_date ?? c.start_date;
  if (!cDate || cDate < fiscalStart || cDate > fiscalEnd) return false;

  return true;
}

function recordsFromSource(
  source: BiDataSourceFilter,
  data: {
    constructions: Array<{ id: string; department_name?: string | null; status: string; order_amount?: number | null; actual_cost?: number | null; budget_cost?: number | null; end_date?: string | null; start_date?: string | null }>;
    deals: Array<{ id: string; department_name?: string | null; stage: string; value?: number | null; expected_close_date?: string | null }>;
    contracts: Array<{ id: string; department_name?: string | null; status: string; amount?: number | null; contract_date?: string | null; end_date?: string | null }>;
    invoices: Array<{ id: string; total?: number | null; status: string; paid_at?: string | null; construction_id?: string | null }>;
    constructionById: Map<string, { department_name?: string | null; actual_cost?: number | null; budget_cost?: number | null; order_amount?: number | null; status?: string }>;
  },
  config: BiCompanyConfig,
  dateField: "actual" | "forecast",
  sources: BiDataSourceFilter[],
  fiscalStart: string,
  fiscalEnd: string
): BiMetricRecord[] {
  const records: BiMetricRecord[] = [];

  if (source.type === "constructions") {
    for (const c of data.constructions) {
      if (!matchesFilter(c.status, source.statuses)) continue;
      const { revenue, grossProfit } = constructionMetrics(c, config.invoice_gross_profit_rate);
      const date = dateField === "actual" ? c.end_date : c.end_date ?? c.start_date;
      records.push({
        key: `construction:${c.id}`,
        departmentName: c.department_name ?? null,
        revenue,
        grossProfit,
        date: date ?? null,
      });
    }
  }

  if (source.type === "deals") {
    for (const d of data.deals) {
      if (!matchesFilter(d.stage, source.stages)) continue;
      const { revenue, grossProfit } = dealMetrics(d, config.deal_gross_profit_rate);
      records.push({
        key: `deal:${d.id}`,
        departmentName: d.department_name ?? null,
        revenue,
        grossProfit,
        date: d.expected_close_date ?? null,
      });
    }
  }

  if (source.type === "contracts") {
    for (const c of data.contracts) {
      if (!matchesFilter(c.status, source.statuses)) continue;
      const { revenue, grossProfit } = contractMetrics(c, config.deal_gross_profit_rate);
      records.push({
        key: `contract:${c.id}`,
        departmentName: c.department_name ?? null,
        revenue,
        grossProfit,
        date: c.contract_date ?? c.end_date ?? null,
      });
    }
  }

  if (source.type === "invoices") {
    for (const inv of data.invoices) {
      if (!matchesFilter(inv.status, source.statuses)) continue;
      if (shouldSkipLinkedInvoice(inv, data, sources, dateField, fiscalStart, fiscalEnd)) continue;
      let { revenue, grossProfit } = invoiceMetrics(inv, config.invoice_gross_profit_rate);
      const linked = inv.construction_id ? data.constructionById.get(inv.construction_id) : undefined;
      if (linked) {
        const linkedMetrics = constructionMetrics(linked, config.invoice_gross_profit_rate);
        const rate = linkedMetrics.revenue > 0 ? linkedMetrics.grossProfit / linkedMetrics.revenue : config.invoice_gross_profit_rate;
        grossProfit = revenue * rate;
      }
      records.push({
        key: `invoice:${inv.id}`,
        departmentName: linked?.department_name ?? null,
        revenue,
        grossProfit,
        date: inv.paid_at ?? null,
      });
    }
  }

  return records;
}

function collectRecords(
  sources: BiDataSourceFilter[],
  data: Parameters<typeof recordsFromSource>[1],
  config: BiCompanyConfig,
  dateField: "actual" | "forecast",
  fiscalStart: string,
  fiscalEnd: string
): BiMetricRecord[] {
  const seen = new Set<string>();
  const out: BiMetricRecord[] = [];

  for (const source of sources) {
    for (const record of recordsFromSource(
      source,
      data,
      config,
      dateField,
      sources,
      fiscalStart,
      fiscalEnd
    )) {
      if (seen.has(record.key)) continue;
      seen.add(record.key);

      if (record.date && (record.date < fiscalStart || record.date > fiscalEnd)) continue;
      out.push(record);
    }
  }

  return out;
}

export async function getBiActuals(fiscalYear?: number): Promise<BiActuals | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const fiscalMonthStart = await getCompanyFiscalMonthStart();
  const MONTH_LABELS = buildFiscalMonthLabels(fiscalMonthStart);

  const year = fiscalYear ?? getCurrentFiscalYear(fiscalMonthStart);
  const { start, end } = fiscalYearRange(year, fiscalMonthStart);
  const companyConfig = await getBiCompanyConfig();

  const [{ data: constructions }, { data: deals }, { data: contracts }, { data: invoices }, { data: settings }, { data: changeLogs }] = await Promise.all([
    supabase
      .from("constructions")
      .select("id, department_name, status, order_amount, actual_cost, budget_cost, end_date, start_date"),
    supabase
      .from("deals")
      .select("id, department_name, stage, value, expected_close_date"),
    supabase
      .from("contracts")
      .select("id, department_name, status, amount, contract_date, end_date"),
    supabase
      .from("invoices")
      .select("id, total, status, paid_at, construction_id")
      .gte("paid_at", start)
      .lte("paid_at", end),
    supabase
      .from("bi_annual_settings")
      .select("overhead_budget, sga_budget, department_targets:bi_department_targets(department_name, sort_order)")
      .eq("fiscal_year", year)
      .maybeSingle(),
    supabase
      .from("bi_budget_change_log")
      .select("field_name, old_value, new_value, effective_from")
      .eq("fiscal_year", year)
      .order("effective_from", { ascending: true }),
  ]);

  const constructionById = new Map(
    (constructions ?? []).map((c) => [c.id, c])
  );

  const dataBundle = {
    constructions: constructions ?? [],
    deals: deals ?? [],
    contracts: contracts ?? [],
    invoices: invoices ?? [],
    constructionById,
  };

  const deptNames = (settings?.department_targets ?? [])
    .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
    .map((d: { department_name: string }) => d.department_name);

  const departments = deptNames.length > 0 ? deptNames : ["一般住宅", "新築", "公共工事", "リフォーム"];
  const unassigned = companyConfig.unassigned_department_label;

  const deptMap = new Map<string, BiDeptActual>();
  for (let i = 0; i < departments.length; i++) {
    deptMap.set(departments[i], {
      name: departments[i],
      label: deptLabel(i),
      revenue: 0,
      grossProfit: 0,
    });
  }
  if (!deptMap.has(unassigned)) {
    deptMap.set(unassigned, {
      name: unassigned,
      label: "—",
      revenue: 0,
      grossProfit: 0,
    });
  }

  const monthlyMap = new Map<number, BiMonthlyActual>();
  const deptMonthlyRevenue = new Map<string, number[]>();
  const deptMonthlyGrossProfit = new Map<string, number[]>();
  for (let i = 0; i < 12; i++) {
    monthlyMap.set(i, { month: MONTH_LABELS[i], revenue: 0, grossProfit: 0 });
  }
  for (const deptName of deptMap.keys()) {
    deptMonthlyRevenue.set(deptName, Array(12).fill(0));
    deptMonthlyGrossProfit.set(deptName, Array(12).fill(0));
  }

  const budgetChanges: BiBudgetChangeEntry[] = (changeLogs ?? []).map((c) => ({
    field_name: c.field_name as BiBudgetChangeEntry["field_name"],
    old_value: normalizeBudgetMan(Number(c.old_value)),
    new_value: normalizeBudgetMan(Number(c.new_value)),
    effective_from: c.effective_from,
  }));

  const baselineOverhead = normalizeBudgetMan(
    budgetChanges.find((c) => c.field_name === "overhead_budget")?.old_value
      ?? Number(settings?.overhead_budget ?? 0)
  );
  const baselineSga = normalizeBudgetMan(
    budgetChanges.find((c) => c.field_name === "sga_budget")?.old_value
      ?? Number(settings?.sga_budget ?? 0)
  );
  let monthlyOverheadAllocations = buildMonthlyOverheadAllocations(year, baselineOverhead, budgetChanges, fiscalMonthStart);
  const monthlySgaAllocations = buildMonthlyBudgetAllocations(year, "sga_budget", baselineSga, budgetChanges, fiscalMonthStart);

  const actualRecords = collectRecords(
    companyConfig.actual_sources,
    dataBundle,
    companyConfig,
    "actual",
    start,
    end
  );

  for (const record of actualRecords) {
    const deptName = resolveDepartmentName(record.departmentName, departments, unassigned);
    const dept = deptMap.get(deptName) ?? deptMap.get(unassigned)!;
    dept.revenue += toManYen(record.revenue);
    dept.grossProfit += toManYen(record.grossProfit);

    if (record.date) {
      const monthIndex = fiscalMonthIndex(record.date, fiscalMonthStart);
      const m = monthlyMap.get(monthIndex)!;
      const rev = toManYen(record.revenue);
      const gp = toManYen(record.grossProfit);
      m.revenue += rev;
      m.grossProfit += gp;
      const deptRev = deptMonthlyRevenue.get(deptName) ?? deptMonthlyRevenue.get(unassigned)!;
      const deptGp = deptMonthlyGrossProfit.get(deptName) ?? deptMonthlyGrossProfit.get(unassigned)!;
      deptRev[monthIndex] += rev;
      deptGp[monthIndex] += gp;
    }
  }

  const recordsByTier = new Map<string, BiMetricRecord[]>();
  for (const tier of companyConfig.forecast_tiers) {
    if (!tier.enabled) continue;
    recordsByTier.set(
      tier.id,
      collectRecords(tier.sources, dataBundle, companyConfig, "forecast", start, end)
    );
  }

  const forecastTiers = aggregateForecastTiers(companyConfig.forecast_tiers, recordsByTier);
  const monthly = Array.from(monthlyMap.values());

  if (companyConfig.monthly_overhead_mode === "revenue_share") {
    monthlyOverheadAllocations = applyRevenueShareOverhead(
      monthly.map((m) => m.revenue),
      monthlyOverheadAllocations
    );
  }

  const companyMonthlyRevenue = monthly.map((m) => m.revenue);

  const monthlyByDept = Array.from(deptMap.values())
    .filter((d) => d.name !== unassigned || d.revenue > 0 || d.grossProfit > 0)
    .map((d) => ({
      name: d.name,
      label: d.label,
      months: buildDeptMonthlySeries(
        deptMonthlyRevenue.get(d.name) ?? Array(12).fill(0),
        deptMonthlyGrossProfit.get(d.name) ?? Array(12).fill(0),
        companyMonthlyRevenue,
        monthlyOverheadAllocations,
        MONTH_LABELS
      ),
    }));

  const sparklines = {
    revenue: monthly.map((m) => m.revenue),
    grossProfitRate: monthly.map((m) => (m.revenue > 0 ? Math.round((m.grossProfit / m.revenue) * 1000) / 10 : 0)),
    grossProfitTotal: monthly.map((m, i) => m.grossProfit - monthlyOverheadAllocations[i]),
    operatingProfit: monthly.map((m, i) => m.grossProfit - monthlyOverheadAllocations[i] - monthlySgaAllocations[i]),
  };

  const last = monthly[monthly.length - 1];
  const prev = monthly[monthly.length - 2];
  const lastRate = last.revenue > 0 ? (last.grossProfit / last.revenue) * 100 : 0;
  const prevRate = prev.revenue > 0 ? (prev.grossProfit / prev.revenue) * 100 : 0;

  const hasData = actualRecords.length > 0;

  return {
    deptActuals: Array.from(deptMap.values()).filter((d) => d.name !== unassigned || d.revenue > 0 || d.grossProfit > 0),
    monthly,
    monthlyByDept,
    monthlyOverheadAllocations,
    monthlySgaAllocations,
    forecastTiers,
    hasData,
    fiscalMonthStart,
    sparklines,
    deltas: {
      grossProfitRatePt: hasData && prev.revenue > 0 ? Math.round((lastRate - prevRate) * 10) / 10 : null,
      revenueAchievePct: null,
    },
  };
}

export async function getBiDepartmentNames(fiscalYear?: number): Promise<string[]> {
  const settings = await getBiSettings(fiscalYear);
  if (settings?.department_targets?.length) {
    return settings.department_targets.map((d) => d.department_name);
  }
  return [...DEFAULT_DEPARTMENTS];
}

// ── 見込度（A/B/C）別の見込み売上 ＋ 特需 ────────────────────────────
export type BiProspectGradeSummary = {
  grade: "A" | "B" | "C";
  /** 会社設定の確度%（0〜100） */
  rate: number;
  customerCount: number;
  /** 見込み金額の合計（万円）。進行中商談の金額、なければ顧客の予算上限 */
  baseRevenue: number;
  /** 確度%を掛けた期待値（万円） */
  weightedRevenue: number;
};

export type BiSpecialProspectSummary = {
  customerCount: number;
  baseRevenue: number;
  weightedRevenue: number;
};

export type BiProspectSummary = {
  rows: BiProspectGradeSummary[];
  /** 特需（大型案件）— 独自確度%を使用。BI上で含め/除外を切替 */
  special: BiSpecialProspectSummary;
  totalBase: number;
  totalWeighted: number;
  totalBaseWithSpecial: number;
  totalWeightedWithSpecial: number;
  hasData: boolean;
  hasSpecial: boolean;
};

export async function getBiProspectSummary(): Promise<BiProspectSummary> {
  const { supabase, companyId } = await getCompanyId();
  const config = await getBiCompanyConfig();
  const rates = config.prospect_grade_rates;

  const emptySpecial: BiSpecialProspectSummary = { customerCount: 0, baseRevenue: 0, weightedRevenue: 0 };
  const empty: BiProspectSummary = {
    rows: (["A", "B", "C"] as const).map((grade) => ({
      grade, rate: rates[grade], customerCount: 0, baseRevenue: 0, weightedRevenue: 0,
    })),
    special: emptySpecial,
    totalBase: 0,
    totalWeighted: 0,
    totalBaseWithSpecial: 0,
    totalWeightedWithSpecial: 0,
    hasData: false,
    hasSpecial: false,
  };
  if (!companyId) return empty;

  const { data: customers } = await supabase
    .from("customers")
    .select("id, prospect_grade, budget_max, is_special_demand, special_probability")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .or("prospect_grade.in.(A,B,C),is_special_demand.eq.true");

  if (!customers?.length) return empty;

  const customerIds = customers.map((c) => c.id);
  const { data: deals } = await supabase
    .from("deals")
    .select("customer_id, stage, value")
    .in("customer_id", customerIds)
    .not("stage", "in", "(won,lost)");

  const dealSumByCustomer = new Map<string, number>();
  for (const d of deals ?? []) {
    dealSumByCustomer.set(d.customer_id, (dealSumByCustomer.get(d.customer_id) ?? 0) + Number(d.value ?? 0));
  }

  const byGrade = new Map<"A" | "B" | "C", { count: number; base: number }>();
  let specialCount = 0;
  let specialBase = 0;
  let specialWeighted = 0;

  for (const c of customers) {
    const baseYen = dealSumByCustomer.get(c.id) ?? Number(c.budget_max ?? 0);
    if (c.is_special_demand) {
      const rate = Math.min(100, Math.max(0, Number(c.special_probability ?? 0)));
      specialCount += 1;
      specialBase += baseYen;
      specialWeighted += baseYen * rate / 100;
      continue;
    }
    if (c.prospect_grade !== "A" && c.prospect_grade !== "B" && c.prospect_grade !== "C") continue;
    const grade = c.prospect_grade;
    const entry = byGrade.get(grade) ?? { count: 0, base: 0 };
    entry.count += 1;
    entry.base += baseYen;
    byGrade.set(grade, entry);
  }

  const rows: BiProspectGradeSummary[] = (["A", "B", "C"] as const).map((grade) => {
    const entry = byGrade.get(grade) ?? { count: 0, base: 0 };
    const baseRevenue = toManYen(entry.base);
    return {
      grade,
      rate: rates[grade],
      customerCount: entry.count,
      baseRevenue,
      weightedRevenue: Math.round(baseRevenue * rates[grade] / 100),
    };
  });

  const special: BiSpecialProspectSummary = {
    customerCount: specialCount,
    baseRevenue: toManYen(specialBase),
    weightedRevenue: toManYen(specialWeighted),
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
    hasData: rows.some((r) => r.customerCount > 0) || special.customerCount > 0,
    hasSpecial: special.customerCount > 0,
  };
}
