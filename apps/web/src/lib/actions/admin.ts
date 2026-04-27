"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const SUPER_ADMIN_EMAIL = "admin@example.com";

/**
 * 認証チェック専用: 通常のサーバークライアントで auth.user を確認し、
 * SUPER_ADMIN_EMAIL 以外なら例外を投げる。
 *
 * データアクセス自体は service_role キーを使う `createAdminClient()` で
 * RLS をバイパスして行う（複数テナント横断）。
 */
async function assertSuperAdmin() {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user || user.email !== SUPER_ADMIN_EMAIL) {
    throw new Error("Unauthorized");
  }
  return createAdminClient();
}

/* ─────────────────────── 既存: 統計・企業・ユーザー一覧 ─────────────────────── */

export async function getAdminStats() {
  const supabase = await assertSuperAdmin();

  const [
    { count: companyCount },
    { count: userCount },
    { count: constructionCount },
    { count: contractCount },
  ] = await Promise.all([
    supabase.from("companies").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("constructions").select("*", { count: "exact", head: true }),
    supabase.from("contracts").select("*", { count: "exact", head: true }),
  ]);

  return {
    companyCount: companyCount ?? 0,
    userCount: userCount ?? 0,
    constructionCount: constructionCount ?? 0,
    contractCount: contractCount ?? 0,
  };
}

export async function getAdminCompanies() {
  const supabase = await assertSuperAdmin();

  const { data, error } = await supabase
    .from("companies")
    .select("id, name, settings, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((c) => {
    const settings = (c.settings ?? {}) as Record<string, unknown>;
    const plan =
      typeof settings.plan === "string" && settings.plan.length > 0
        ? (settings.plan as string)
        : null;
    return { id: c.id, name: c.name, plan, created_at: c.created_at };
  });
}

export async function getAdminUsers() {
  const supabase = await assertSuperAdmin();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, role, company_id, created_at, companies!profiles_company_id_fkey(name)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as unknown as Array<{
    id: string;
    display_name: string;
    email: string;
    role: string;
    company_id: string;
    created_at: string;
    companies: { name: string } | null;
  }>;
}

/* ─────────────────────── BI: 全国加盟店横断ダッシュボード ─────────────────────── */

type ConstructionRow = {
  id: string;
  company_id: string;
  status: string;
  order_amount: number | null;
  order_cost: number | null;
  budget_cost: number | null;
  actual_cost: number | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

type CompanyRow = { id: string; name: string };

async function fetchAllConstructions(supabase: ReturnType<typeof createAdminClient>) {
  const { data, error } = await supabase
    .from("constructions")
    .select(
      "id, company_id, status, order_amount, order_cost, budget_cost, actual_cost, start_date, end_date, created_at",
    );
  if (error) throw error;
  return (data ?? []) as ConstructionRow[];
}

async function fetchAllCompanies(supabase: ReturnType<typeof createAdminClient>) {
  const { data, error } = await supabase.from("companies").select("id, name");
  if (error) throw error;
  return (data ?? []) as CompanyRow[];
}

/**
 * 全社合計 KPI（運営ダッシュボードの最上段）
 */
export async function getAdminBiOverview() {
  const supabase = await assertSuperAdmin();

  const [companies, constructions, { count: userCount }, { count: customerCount }] =
    await Promise.all([
      fetchAllCompanies(supabase),
      fetchAllConstructions(supabase),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("customers").select("*", { count: "exact", head: true }),
    ]);

  const companyCount = companies.length;

  // 直近30日内に工事が created/updated された会社を「アクティブ」と定義
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const activeCompanyIds = new Set(
    constructions.filter((c) => new Date(c.created_at) >= since).map((c) => c.company_id),
  );
  const activeCompanyCount = activeCompanyIds.size;

  const totalRevenue = constructions.reduce((s, c) => s + (c.order_amount ?? 0), 0);
  const totalCost = constructions.reduce((s, c) => s + (c.actual_cost ?? c.budget_cost ?? c.order_cost ?? 0), 0);
  const totalGross = totalRevenue - totalCost;
  const grossRateWeighted = totalRevenue > 0 ? totalGross / totalRevenue : 0;

  // 単純平均（社別粗利率の単純平均）
  const perCompanyRates: number[] = [];
  for (const co of companies) {
    const rows = constructions.filter((c) => c.company_id === co.id);
    const rev = rows.reduce((s, c) => s + (c.order_amount ?? 0), 0);
    const cost = rows.reduce((s, c) => s + (c.actual_cost ?? c.budget_cost ?? c.order_cost ?? 0), 0);
    if (rev > 0) perCompanyRates.push((rev - cost) / rev);
  }
  const grossRateAvg =
    perCompanyRates.length > 0
      ? perCompanyRates.reduce((s, x) => s + x, 0) / perCompanyRates.length
      : 0;

  const constructionCount = constructions.length;
  const avgUnitPrice = constructionCount > 0 ? totalRevenue / constructionCount : 0;

  const inProgressCount = constructions.filter((c) => c.status === "in_progress").length;
  const completedCount = constructions.filter((c) => c.status === "completed").length;
  const delayedCount = constructions.filter((c) => c.status === "delayed").length;

  return {
    companyCount,
    activeCompanyCount,
    userCount: userCount ?? 0,
    customerCount: customerCount ?? 0,
    constructionCount,
    totalRevenue,
    totalCost,
    totalGross,
    grossRateWeighted, // 加重平均 (= 全体粗利率)
    grossRateAvg,      // 単純平均 (= 各社粗利率の平均)
    avgUnitPrice,
    inProgressCount,
    completedCount,
    delayedCount,
  };
}

/**
 * 企業別ランキング（受注額・粗利・工事数・粗利率・平均単価）
 */
async function computeCompanyRanking(
  companies: { id: string; name: string }[],
  constructions: ConstructionRow[],
) {
  return companies
    .map((co) => {
      const rows = constructions.filter((c) => c.company_id === co.id);
      const constructionCount = rows.length;
      const revenue = rows.reduce((s, c) => s + (c.order_amount ?? 0), 0);
      const cost = rows.reduce(
        (s, c) => s + (c.actual_cost ?? c.budget_cost ?? c.order_cost ?? 0),
        0,
      );
      const gross = revenue - cost;
      const grossRate = revenue > 0 ? gross / revenue : 0;
      const avgUnitPrice = constructionCount > 0 ? revenue / constructionCount : 0;
      const completed = rows.filter((c) => c.status === "completed").length;
      return {
        companyId: co.id,
        companyName: co.name,
        constructionCount,
        completedCount: completed,
        revenue,
        cost,
        gross,
        grossRate,
        avgUnitPrice,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export async function getAdminBiCompanyRanking() {
  const supabase = await assertSuperAdmin();
  const [companies, constructions] = await Promise.all([
    fetchAllCompanies(supabase),
    fetchAllConstructions(supabase),
  ]);
  return computeCompanyRanking(companies, constructions);
}

/**
 * 月次トレンド（直近12ヶ月の合計受注/粗利/件数）
 */
export async function getAdminBiMonthlyTrend() {
  const supabase = await assertSuperAdmin();
  const constructions = await fetchAllConstructions(supabase);

  const now = new Date();
  const months: { key: string; label: string; revenue: number; gross: number; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${d.getMonth() + 1}月`;
    months.push({ key, label, revenue: 0, gross: 0, count: 0 });
  }
  const idx = new Map(months.map((m, i) => [m.key, i]));

  for (const c of constructions) {
    const dateStr = c.start_date ?? c.created_at;
    if (!dateStr) continue;
    const d = new Date(dateStr);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const i = idx.get(key);
    if (i === undefined) continue;
    const rev = c.order_amount ?? 0;
    const cost = c.actual_cost ?? c.budget_cost ?? c.order_cost ?? 0;
    months[i].revenue += rev;
    months[i].gross += rev - cost;
    months[i].count += 1;
  }
  return months;
}

/**
 * 工事ステータス別の件数分布
 */
export async function getAdminBiStatusBreakdown() {
  const supabase = await assertSuperAdmin();
  const constructions = await fetchAllConstructions(supabase);
  const buckets: Record<string, number> = {
    preparing: 0,
    in_progress: 0,
    completed: 0,
    suspended: 0,
    delayed: 0,
  };
  for (const c of constructions) {
    const k = c.status as keyof typeof buckets;
    if (k in buckets) buckets[k] += 1;
  }
  return buckets;
}

/**
 * 粗利率レンジ別の社数分布（運営ヘルス指標）
 */
export async function getAdminBiGrossRateDistribution() {
  const supabase = await assertSuperAdmin();
  const [companies, constructions] = await Promise.all([
    fetchAllCompanies(supabase),
    fetchAllConstructions(supabase),
  ]);
  const ranking = await computeCompanyRanking(companies, constructions);
  const buckets = [
    { key: "<10", label: "粗利率 〜10%", min: -Infinity, max: 0.1, count: 0 },
    { key: "10-20", label: "10〜20%", min: 0.1, max: 0.2, count: 0 },
    { key: "20-30", label: "20〜30%", min: 0.2, max: 0.3, count: 0 },
    { key: "30+", label: "30%↑", min: 0.3, max: Infinity, count: 0 },
  ];
  for (const r of ranking) {
    if (r.revenue <= 0) continue;
    for (const b of buckets) {
      if (r.grossRate >= b.min && r.grossRate < b.max) {
        b.count += 1;
        break;
      }
    }
  }
  return buckets;
}

/* ─────────────────────── 企業追加（オーナーアカウント込み） ─────────────────────── */

export async function createAdminCompany(input: {
  companyName: string;
  plan: string | null;
  slug: string | null;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
}) {
  const supabase = await assertSuperAdmin();

  // 1. 企業レコード作成
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({
      name: input.companyName,
      slug: input.slug || null,
      settings: input.plan ? { plan: input.plan } : {},
    })
    .select("id")
    .single();
  if (companyError) throw companyError;

  // 2. Auth ユーザー作成（Service Role 経由で email 確認不要）
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: input.ownerEmail,
    password: input.ownerPassword,
    email_confirm: true,
  });
  if (authError) {
    // ユーザー作成失敗時は企業レコードも削除してロールバック
    await supabase.from("companies").delete().eq("id", company.id);
    throw authError;
  }

  // 3. プロフィールレコード作成
  const { error: profileError } = await supabase.from("profiles").insert({
    id: authData.user.id,
    company_id: company.id,
    display_name: input.ownerName,
    email: input.ownerEmail,
    role: "owner",
  });
  if (profileError) {
    // プロフィール作成失敗時はユーザーと企業を削除してロールバック
    await supabase.auth.admin.deleteUser(authData.user.id);
    await supabase.from("companies").delete().eq("id", company.id);
    throw profileError;
  }

  return { companyId: company.id, userId: authData.user.id };
}

export async function deleteAdminCompany(companyId: string) {
  const supabase = await assertSuperAdmin();

  // プロフィール → Auth ユーザーを先に削除してから企業削除（CASCADE があるので companies 削除で連鎖するが念のため）
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("company_id", companyId);

  for (const p of profiles ?? []) {
    await supabase.auth.admin.deleteUser(p.id);
  }

  const { error } = await supabase.from("companies").delete().eq("id", companyId);
  if (error) throw error;
}
