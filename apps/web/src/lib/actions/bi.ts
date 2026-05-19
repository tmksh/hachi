"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentFiscalYear } from "@/lib/bi-utils";

// ── 型定義 ────────────────────────────────────────────────────────────
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

// モードA の標準項目
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


// ── 現在の年度設定を取得 ─────────────────────────────────────────────
export async function getBiSettings(fiscalYear?: number): Promise<BiAnnualSettings | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const year = fiscalYear ?? getCurrentFiscalYear();

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
    overhead_items: (data.overhead_items ?? []).sort((a: BiOverheadItem, b: BiOverheadItem) => a.sort_order - b.sort_order),
    department_targets: (data.department_targets ?? []).sort((a: BiDepartmentTarget, b: BiDepartmentTarget) => a.sort_order - b.sort_order),
  } as BiAnnualSettings;
}

// ── 設定を保存（upsert） ─────────────────────────────────────────────
export async function saveBiSettings(input: {
  fiscal_year: number;
  target_revenue: number;
  target_gross_profit: number;
  overhead_budget: number;
  sga_budget: number;
  overhead_mode: "breakdown" | "lump_sum";
  overhead_items: Array<{ name: string; amount: number; sort_order: number; is_custom: boolean }>;
  department_targets: Array<{ department_name: string; target_revenue: number; target_gross_profit: number; sort_order: number }>;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "認証が必要です" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();
  if (!profile) return { ok: false, error: "プロフィールが見つかりません" };

  const { company_id } = profile;

  // 設定を upsert
  const { data: setting, error: settingErr } = await supabase
    .from("bi_annual_settings")
    .upsert({
      company_id,
      fiscal_year: input.fiscal_year,
      target_revenue: input.target_revenue,
      target_gross_profit: input.target_gross_profit,
      overhead_budget: input.overhead_budget,
      sga_budget: input.sga_budget,
      overhead_mode: input.overhead_mode,
      updated_at: new Date().toISOString(),
    }, { onConflict: "company_id,fiscal_year" })
    .select()
    .single();

  if (settingErr || !setting) return { ok: false, error: settingErr?.message };

  // 既存の内訳・部門目標を一旦削除して再挿入
  await supabase.from("bi_overhead_items").delete().eq("setting_id", setting.id);
  await supabase.from("bi_department_targets").delete().eq("setting_id", setting.id);

  if (input.overhead_items.length > 0) {
    const { error: itemsErr } = await supabase.from("bi_overhead_items").insert(
      input.overhead_items.map((item) => ({
        company_id,
        setting_id: setting.id,
        name: item.name,
        amount: item.amount,
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
        target_revenue: dept.target_revenue,
        target_gross_profit: dept.target_gross_profit,
        sort_order: dept.sort_order,
      }))
    );
    if (deptErr) return { ok: false, error: deptErr.message };
  }

  return { ok: true };
}


