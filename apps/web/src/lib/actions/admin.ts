"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPlatformLinqAiPublicConfig,
  savePlatformLinqAiConfig,
  resolveLinqAiConfig,
} from "@/lib/integrations/linq-ai/platform-config";

const SUPER_ADMIN_EMAIL = "super-admin@example.com";

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

export async function getAdminCompanies(): Promise<
  { id: string; name: string; slug: string | null; plan: string | null; created_at: string }[]
> {
  const supabase = await assertSuperAdmin();

  const { data, error } = await supabase
    .from("companies")
    .select("id, name, slug, settings, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((c: any) => {
    const settings = (c.settings ?? {}) as Record<string, unknown>;
    const plan =
      typeof settings.plan === "string" && settings.plan.length > 0
        ? (settings.plan as string)
        : null;
    return {
      id: c.id as string,
      name: c.name as string,
      slug: (c.slug ?? null) as string | null,
      plan,
      created_at: c.created_at as string,
    };
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

/* ─────────────────────── Netlify ドメインエイリアス自動管理 ──────────────────────── */

async function netlifyAddDomain(slug: string): Promise<string> {
  const token = process.env.NETLIFY_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN;
  const missing = [
    !token && "NETLIFY_TOKEN",
    !siteId && "NETLIFY_SITE_ID",
    !appDomain && "NEXT_PUBLIC_APP_DOMAIN",
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(`Netlify 環境変数が未設定です: ${missing.join(", ")}`);
  }

  const domain = `${slug}.${appDomain}`;

  const getRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!getRes.ok) {
    throw new Error(`Netlify サイト取得失敗 (${getRes.status})`);
  }

  const site = await getRes.json() as { domain_aliases?: string[] };
  const existing: string[] = site.domain_aliases ?? [];
  if (existing.includes(domain)) return domain;

  const patchRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ domain_aliases: [...existing, domain] }),
  });
  if (!patchRes.ok) {
    const body = await patchRes.text();
    throw new Error(`Netlify ドメイン追加失敗 (${patchRes.status}): ${body}`);
  }

  return domain;
}

async function netlifyRemoveDomain(slug: string): Promise<void> {
  const token = process.env.NETLIFY_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN;
  if (!token || !siteId || !appDomain) return;

  const domain = `${slug}.${appDomain}`;

  const getRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!getRes.ok) return;

  const site = await getRes.json() as { domain_aliases?: string[] };
  const existing: string[] = site.domain_aliases ?? [];
  const updated = existing.filter((d) => d !== domain);
  if (updated.length === existing.length) return;

  await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ domain_aliases: updated }),
  });
}

/* ─────────────────────── 既存企業 更新 ─────────────────────── */

export async function updateAdminCompany(input: {
  id: string;
  name: string;
  slug: string | null;
  plan: string | null;
}) {
  const supabase = await assertSuperAdmin();

  const normalizedSlug = input.slug
    ? input.slug.toLowerCase().replace(/[^a-z0-9-]/g, "") || null
    : null;

  // slug 重複チェック
  if (normalizedSlug) {
    const { data: existing } = await supabase
      .from("companies")
      .select("id")
      .eq("slug", normalizedSlug)
      .neq("id", input.id)
      .maybeSingle();
    if (existing) throw new Error(`slug「${normalizedSlug}」はすでに別の企業で使われています`);
  }

  // 既存 slug を取得（Netlify 操作に使う）
  const { data: before } = await supabase
    .from("companies")
    .select("slug, settings")
    .eq("id", input.id)
    .single();

  const prevSlug = before?.slug as string | null ?? null;
  const prevSettings = (before?.settings ?? {}) as Record<string, unknown>;

  const newSettings = input.plan
    ? { ...prevSettings, plan: input.plan }
    : (({ plan: _p, ...rest }) => rest)(prevSettings as Record<string, unknown> & { plan?: unknown });

  const { error } = await supabase
    .from("companies")
    .update({ name: input.name, slug: normalizedSlug, settings: newSettings })
    .eq("id", input.id);
  if (error) throw error;

  // Netlify ドメイン変更
  let netlifyError: string | null = null;
  try {
    if (prevSlug && prevSlug !== normalizedSlug) {
      await netlifyRemoveDomain(prevSlug).catch(() => {});
    }
    if (normalizedSlug && normalizedSlug !== prevSlug) {
      await netlifyAddDomain(normalizedSlug);
    }
  } catch (e) {
    netlifyError = e instanceof Error ? e.message : String(e);
  }

  return { slug: normalizedSlug, netlifyError };
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
    role: "hq_admin",
  });
  if (profileError) {
    // プロフィール作成失敗時はユーザーと企業を削除してロールバック
    await supabase.auth.admin.deleteUser(authData.user.id);
    await supabase.from("companies").delete().eq("id", company.id);
    throw profileError;
  }

  // 4. 必須ワークフロー種別を自動シード（失敗してもロールバックしない）
  const defaultWorkflowTypes = [
    {
      key: "estimate_margin",
      name: "見積承認（粗利率未達）",
      description: "粗利率が基準を下回る見積を上長が承認するフロー",
    },
    {
      key: "contract_08",
      name: "契約書承認",
      description: "契約書の社内承認フロー",
    },
  ];
  for (const wf of defaultWorkflowTypes) {
    const { data: existing } = await supabase
      .from("workflow_types")
      .select("id")
      .eq("company_id", company.id)
      .eq("key", wf.key)
      .maybeSingle();
    if (!existing) {
      const { error: wfErr } = await supabase.from("workflow_types").insert({
        company_id: company.id,
        key: wf.key,
        name: wf.name,
        description: wf.description,
        fields_schema: [],
        approval_route: [],
        sort_order: 0,
      });
      if (wfErr) console.error(`[seedWorkflowType] ${wf.key}`, wfErr);
    }
  }

  // 5. slug が設定されていれば Netlify にドメインエイリアスを追加（失敗しても登録自体はロールバックしない）
  let netlifyDomain: string | null = null;
  let netlifyError: string | null = null;
  if (input.slug) {
    try {
      netlifyDomain = await netlifyAddDomain(input.slug);
    } catch (e) {
      netlifyError = e instanceof Error ? e.message : String(e);
      console.error("[netlifyAddDomain]", e);
    }
  }

  return { companyId: company.id, userId: authData.user.id, netlifyDomain, netlifyError };
}

/** 既存企業に slug を設定し Netlify にドメインエイリアスを追加する */
export async function setAdminCompanySlug(companyId: string, slug: string) {
  const supabase = await assertSuperAdmin();

  const normalized = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!normalized) throw new Error("有効な slug を入力してください（半角英数字・ハイフンのみ）");

  // 重複チェック
  const { data: existing } = await supabase
    .from("companies")
    .select("id")
    .eq("slug", normalized)
    .neq("id", companyId)
    .maybeSingle();
  if (existing) throw new Error(`slug「${normalized}」はすでに別の企業で使われています`);

  // DB 更新
  const { error } = await supabase
    .from("companies")
    .update({ slug: normalized })
    .eq("id", companyId);
  if (error) throw error;

  // Netlify ドメイン追加（失敗してもエラーは返すが DB は維持）
  let netlifyDomain: string | null = null;
  let netlifyError: string | null = null;
  try {
    netlifyDomain = await netlifyAddDomain(normalized);
  } catch (e) {
    netlifyError = e instanceof Error ? e.message : String(e);
  }

  return { slug: normalized, netlifyDomain, netlifyError };
}

/** 既存企業のサブドメインを Netlify に再同期する */
export async function syncAdminCompanyDomain(companyId: string) {
  await assertSuperAdmin();
  const supabase = createAdminClient();
  const { data: company, error } = await supabase
    .from("companies")
    .select("slug")
    .eq("id", companyId)
    .single();
  if (error || !company?.slug) throw new Error("slug が設定された企業が見つかりません");

  const domain = await netlifyAddDomain(company.slug);
  return { domain };
}

export async function deleteAdminCompany(companyId: string) {
  const supabase = await assertSuperAdmin();

  // slug を取得（Netlify からドメインを削除するため）
  const { data: companyData } = await supabase
    .from("companies")
    .select("slug")
    .eq("id", companyId)
    .single();

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

  // Netlify からドメインエイリアスを削除（失敗しても無視）
  if (companyData?.slug) {
    await netlifyRemoveDomain(companyData.slug).catch(() => {});
  }
}

/* ─────────────────────── プラットフォーム AI（全テナント共通） ─────────────────────── */

export async function getAdminLinqAiSettings() {
  await assertSuperAdmin();
  return getPlatformLinqAiPublicConfig();
}

export async function updateAdminLinqAiSettings(input: {
  enabled: boolean;
  provider?: "openai" | "anthropic" | "google" | "azure";
  model?: string;
  apiKey?: string;
  sttProvider?: "whisper" | "google_speech" | "web_speech";
}) {
  await assertSuperAdmin();
  await savePlatformLinqAiConfig(input, undefined);
  return getPlatformLinqAiPublicConfig();
}

export async function testAdminLinqAiConnection() {
  await assertSuperAdmin();
  const config = await resolveLinqAiConfig();
  if (!config.apiKey) {
    return { ok: false, message: "API キーが未設定です" };
  }

  const provider = config.provider ?? "openai";

  try {
    if (provider === "openai" || provider === "azure") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model ?? "gpt-4o-mini",
          messages: [{ role: "user", content: "「OK」とだけ返してください" }],
          max_tokens: 16,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { ok: false, message: `OpenAI API エラー (${res.status}): ${body.slice(0, 200)}` };
      }
      return { ok: true, message: `接続成功 — OpenAI (${config.model})` };
    }

    if (provider === "google") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "OK とだけ返してください" }] }],
            generationConfig: { maxOutputTokens: 16 },
          }),
        },
      );
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { ok: false, message: `Gemini API エラー (${res.status}): ${body.slice(0, 200)}` };
      }
      return { ok: true, message: `接続成功 — Google Gemini (${config.model})` };
    }

    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: config.model ?? "claude-3-5-haiku-20241022",
          max_tokens: 16,
          messages: [{ role: "user", content: "「OK」とだけ返してください" }],
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { ok: false, message: `Anthropic API エラー (${res.status}): ${body.slice(0, 200)}` };
      }
      return { ok: true, message: `接続成功 — Anthropic Claude (${config.model})` };
    }

    return { ok: false, message: `未対応のプロバイダーです: ${provider}` };
  } catch (e) {
    return { ok: false, message: `接続エラー: ${e instanceof Error ? e.message : String(e)}` };
  }
}
