#!/usr/bin/env node
/**
 * 認証付き UI コンテンツ検証（営業フロー 1-3〜1-7）
 * Usage: node scripts/sales-flow-ui-test.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "../.env.local"), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const PASSWORD = "admin2026";

const results = { ok: [], fail: [] };
const pass = (m) => { results.ok.push(m); console.log(`  ✅ ${m}`); };
const fail = (m) => { results.fail.push(m); console.log(`  ❌ ${m}`); };

function projectRef() {
  return new URL(SUPABASE_URL).hostname.split(".")[0];
}

function sessionCookie(session) {
  const name = `sb-${projectRef()}-auth-token`;
  const value = encodeURIComponent(JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user,
  }));
  return `${name}=${value}`;
}

async function signIn(email) {
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Login failed: ${error.message}`);
  return data.session;
}

async function fetchPage(session, path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Cookie: sessionCookie(session) },
    redirect: "manual",
  });
  const text = await res.text();
  return { status: res.status, text, location: res.headers.get("location") };
}

async function assertPage(session, path, label) {
  const { status, text, location } = await fetchPage(session, path);
  if (status === 307 || status === 302) {
    if ((location ?? "").includes("/login")) {
      fail(`${path} → ログインリダイレクト`);
      return;
    }
  }
  if (status !== 200) {
    fail(`${path} → HTTP ${status}`);
    return;
  }
  const errors = ["顧客が見つかりません", "見積が見つかりません", "statusCode\":404", "statusCode\":500", "Application error"];
  const hit = errors.find((e) => text.includes(e));
  if (hit) fail(`${path}: エラー検出 (${hit})`);
  else pass(`${path}: ${label} (HTTP 200)`);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function setupFreshFlowData(companyId, ownerId) {
  const ts = Date.now();
  const { data: customer } = await admin.from("customers").insert({
    company_id: companyId,
    name: `UI確認_${ts}`,
    company_name: `UIテスト工務店`,
    email: `ui-flow-${ts}@example.com`,
    status: "active",
  }).select().single();

  const { data: deal } = await admin.from("deals").insert({
    company_id: companyId,
    customer_id: customer.id,
    title: `UI商談_${ts}`,
    stage: "quote_submitted",
    value: 5500000,
    assigned_to: ownerId,
  }).select().single();

  const { count } = await admin.from("estimates").select("*", { count: "exact", head: true }).eq("company_id", companyId);
  const subtotal = 5000000;
  const costTotal = 3250000;
  const { data: estimate } = await admin.from("estimates").insert({
    company_id: companyId,
    customer_id: customer.id,
    deal_id: deal.id,
    estimate_no: `EST-UI-${String((count ?? 0) + 1).padStart(4, "0")}`,
    title: `UI見積_${ts}`,
    status: "draft",
    subtotal,
    tax: Math.floor(subtotal * 0.1),
    total: subtotal + Math.floor(subtotal * 0.1),
    cost_total: costTotal,
    gross_profit: subtotal - costTotal,
    gross_profit_rate: ((subtotal - costTotal) / subtotal) * 100,
    default_gross_profit_rate: 0.5,
    approval_status: "pending",
  }).select().single();

  const { data: proposal } = await admin.from("deal_stage_proposals").insert({
    company_id: companyId,
    deal_id: deal.id,
    customer_id: customer.id,
    current_stage: "negotiation",
    proposed_stage: "quote_submitted",
    reason: "見積提出の言及あり",
    confidence: 0.8,
    status: "pending",
  }).select().single();

  return { ts, customer, deal, estimate, proposal };
}

async function main() {
  console.log("=== 営業フロー UI 検証 ===");
  console.log(`Base URL: ${BASE_URL}\n`);

  const { data: profile } = await admin.from("profiles").select("id, company_id, display_name").eq("email", "admin@example.com").single();
  if (!profile) throw new Error("admin@example.com not found");

  const session = await signIn("admin@example.com");
  pass(`ログイン: admin@example.com (${profile.display_name})`);

  const mock = await setupFreshFlowData(profile.company_id, profile.id);
  pass(`テストデータ: 顧客=${mock.customer.name}, 見積=${mock.estimate.estimate_no}`);

  const constructionUrl = `/constructions/new?deal_id=${mock.deal.id}&customer_id=${mock.customer.id}&estimate_id=${mock.estimate.id}`;

  // クライアントレンダリングのため HTML 内テキストではなく HTTP 200 + エラーなしを確認
  await assertPage(session, `/crm/${mock.customer.id}`, "CRM顧客詳細");
  await assertPage(session, `/crm/${mock.customer.id}?tab=recording`, "録音タブ");
  await assertPage(session, `/quotes/${mock.estimate.id}`, "見積詳細");
  await assertPage(session, "/deals", "商談パイプライン");
  await assertPage(session, "/workflow", "ワークフロー");
  await assertPage(session, constructionUrl, "工事登録（受注フロー）");
  await assertPage(session, "/contracts", "契約一覧");

  // getCustomerRelated が正しく動くか API 相当チェック
  const authed = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
  const { data: relatedEstimates, error: relErr } = await authed
    .from("estimates")
    .select("id, estimate_no, title, total, status")
    .eq("customer_id", mock.customer.id);
  if (relErr) fail(`getCustomerRelated 相当クエリ: ${relErr.message}`);
  else if ((relatedEstimates ?? []).some((e) => e.id === mock.estimate.id)) pass("getCustomerRelated: estimates.total カラム OK");
  else fail("getCustomerRelated: 見積が取得できません");

  // Server Actions 実コード検証（開発 API）
  console.log("\n=== Server Actions 検証 ===");
  const actionRes = await fetch(`${BASE_URL}/api/dev/sales-flow-test`, {
    method: "POST",
    headers: { Cookie: sessionCookie(session) },
  });
  if (actionRes.ok) {
    const body = await actionRes.json();
    for (const p of body.passed ?? []) pass(`Server Action: ${p}`);
    for (const f of body.failed ?? []) fail(`Server Action: ${f}`);
    if (body.ok) pass("Server Actions 一括検証 OK");
  } else {
    fail(`Server Actions API → HTTP ${actionRes.status}`);
  }

  console.log("\n=== 結果 ===");
  console.log(`✅ ${results.ok.length} 件成功`);
  console.log(`❌ ${results.fail.length} 件失敗`);
  console.log("\nテスト用URL:");
  console.log(`  CRM:     ${BASE_URL}/crm/${mock.customer.id}`);
  console.log(`  見積:    ${BASE_URL}/quotes/${mock.estimate.id}`);
  console.log(`  工事登録: ${BASE_URL}${constructionUrl}`);

  if (results.fail.length) {
    results.fail.forEach((f) => console.log(`   - ${f}`));
    process.exit(1);
  }
  console.log("\n🎉 UI 検証すべて成功");
}

main().catch((e) => { console.error(e); process.exit(1); });
