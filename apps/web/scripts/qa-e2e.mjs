#!/usr/bin/env node
/**
 * BRIDGE E2E QA: ロール権限 / リードフロー / Webhook・アプリ連携
 * Usage: node scripts/qa-e2e.mjs
 */
import { createServer } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runDispatchWebhook } from "./dispatch-runner.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const PASSWORD = "Bridge2024!";
const PASSWORDS = {
  "admin@example.com": "admin2026",
  "hqadmin@bridge.test": PASSWORD,
  "contractor@bridge.test": PASSWORD,
  "employee@bridge.test": PASSWORD,
};

const ACCOUNTS = [
  { email: "admin@example.com", role: "owner", label: "オーナー" },
  { email: "hqadmin@bridge.test", role: "hq_admin", label: "本部管理者" },
  { email: "contractor@bridge.test", role: "contractor_admin", label: "施工店管理者" },
  { email: "employee@bridge.test", role: "employee", label: "社員" },
];

const ROUTE_ROLES = {
  "/bi": ["owner", "hq_admin", "contractor_admin"],
  "/crm": ["owner", "hq_admin", "contractor_admin"],
  "/deals": ["owner", "hq_admin", "contractor_admin"],
  "/quotes": ["owner", "hq_admin", "contractor_admin"],
  "/craftsmen": ["owner", "hq_admin", "contractor_admin"],
  "/contracts": ["owner", "hq_admin", "contractor_admin"],
  "/invoices": ["owner", "hq_admin", "contractor_admin"],
  "/budget": ["owner", "hq_admin"],
  "/marketing/roi": ["owner", "hq_admin"],
};

const PORTAL_ROUTES = [
  "/dashboard",
  "/attendance",
  "/workflow",
  "/circulation",
  "/calendar",
  "/mail",
  "/documents",
  "/settings",
];

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = { ok: [], warn: [], fail: [] };

function pass(section, msg) {
  results.ok.push({ section, msg });
  console.log(`  ✅ ${msg}`);
}
function warn(section, msg) {
  results.warn.push({ section, msg });
  console.log(`  ⚠️  ${msg}`);
}
function fail(section, msg) {
  results.fail.push({ section, msg });
  console.log(`  ❌ ${msg}`);
}

function projectRef() {
  return new URL(SUPABASE_URL).hostname.split(".")[0];
}

function sessionCookie(session) {
  const name = `sb-${projectRef()}-auth-token`;
  const value = encodeURIComponent(
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: session.token_type,
      user: session.user,
    })
  );
  return `${name}=${value}`;
}

async function signIn(email) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORDS[email] ?? PASSWORD });
  if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
  return data.session;
}

async function fetchRoute(session, path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    redirect: "manual",
    headers: { Cookie: sessionCookie(session) },
  });
  const location = res.headers.get("location") || "";
  return { status: res.status, location, finalPath: location.includes("/unauthorized") ? "/unauthorized" : path };
}

function expectedAccess(role, path) {
  const matched = Object.keys(ROUTE_ROLES).find((p) => path.startsWith(p));
  if (!matched) return true;
  return ROUTE_ROLES[matched].includes(role);
}

async function getCompanyId() {
  const { data } = await admin.from("profiles").select("company_id").eq("email", "admin@example.com").single();
  return data.company_id;
}

// ── 1. ロール権限マトリクス ─────────────────────────────────────
async function testRoleMatrix() {
  console.log("\n=== 1. ロール権限マトリクス ===");
  const protectedRoutes = Object.keys(ROUTE_ROLES);

  for (const account of ACCOUNTS) {
    const session = await signIn(account.email);
    console.log(`\n[${account.label}] ${account.email}`);

    for (const route of protectedRoutes) {
      const expectOk = expectedAccess(account.role, route);
      const { status, location } = await fetchRoute(session, route);
      const unauthorized = status === 307 || status === 308 ? location.includes("/unauthorized") : false;
      const allowed = !unauthorized && (status === 200 || (status >= 300 && status < 400 && !location.includes("/unauthorized")));

      if (expectOk && allowed) pass("role", `${account.label} → ${route} 許可`);
      else if (!expectOk && unauthorized) pass("role", `${account.label} → ${route} 拒否 (/unauthorized)`);
      else fail("role", `${account.label} → ${route} 期待=${expectOk ? "許可" : "拒否"} 実際 status=${status} loc=${location}`);
    }

    for (const route of PORTAL_ROUTES) {
      const { status, location } = await fetchRoute(session, route);
      const unauthorized = location.includes("/unauthorized");
      if (!unauthorized && (status === 200 || (status >= 300 && status < 400))) {
        pass("role", `${account.label} → ${route} ポータル OK`);
      } else {
        fail("role", `${account.label} → ${route} ポータル NG status=${status}`);
      }
    }
  }
}

// ── 2. リードフロー E2E ─────────────────────────────────────────
async function testLeadFlow() {
  console.log("\n=== 2. リードフロー E2E ===");
  const session = await signIn("admin@example.com");
  const companyId = await getCompanyId();
  const ts = Date.now();
  const customerName = `QA顧客_${ts}`;
  const dealTitle = `QA商談_${ts}`;

  const { data: customer, error: cErr } = await admin
    .from("customers")
    .insert({
      company_id: companyId,
      name: customerName,
      status: "active",
      phone: "090-0000-0000",
      email: `qa-${ts}@example.com`,
    })
    .select()
    .single();
  if (cErr) throw cErr;
  pass("lead", `Step1 顧客登録: ${customer.name} (${customer.id})`);

  const { data: deal, error: dErr } = await admin
    .from("deals")
    .insert({
      company_id: companyId,
      customer_id: customer.id,
      title: dealTitle,
      stage: "inquiry",
      value: 5000000,
      priority: "medium",
    })
    .select()
    .single();
  if (dErr) throw dErr;
  pass("lead", `Step2 商談追加: ${deal.title} stage=${deal.stage}`);

  const { count } = await admin.from("estimates").select("*", { count: "exact", head: true });
  const estimateNo = `EST-QA-${String((count || 0) + 1).padStart(4, "0")}`;
  const subtotal = 4500000;
  const tax = Math.floor(subtotal * 0.1);
  const { data: estimate, error: eErr } = await admin
    .from("estimates")
    .insert({
      company_id: companyId,
      customer_id: customer.id,
      estimate_no: estimateNo,
      title: `QA見積_${ts}`,
      status: "draft",
      subtotal,
      tax,
      total: subtotal + tax,
      cost_total: 2500000,
      gross_profit: 2000000,
      gross_profit_rate: 44.4,
    })
    .select()
    .single();
  if (eErr) throw eErr;
  pass("lead", `Step3 見積作成: ${estimate.estimate_no} ¥${estimate.total.toLocaleString()}`);

  const { data: wonDeal, error: wErr } = await admin
    .from("deals")
    .update({ stage: "won", value: estimate.total })
    .eq("id", deal.id)
    .select()
    .single();
  if (wErr) throw wErr;
  pass("lead", `Step4 受注確定: stage=${wonDeal.stage} ¥${wonDeal.value.toLocaleString()}`);

  const { count: cCount } = await admin.from("constructions").select("*", { count: "exact", head: true });
  const constructionNo = `CON-QA-${String((cCount || 0) + 1).padStart(4, "0")}`;
  const { data: construction, error: conErr } = await admin
    .from("constructions")
    .insert({
      company_id: companyId,
      customer_id: customer.id,
      construction_no: constructionNo,
      title: `QA工事_${ts}`,
      status: "preparing",
      order_amount: estimate.total,
      budget_cost: estimate.cost_total,
      progress: 0,
    })
    .select()
    .single();
  if (conErr) throw conErr;
  pass("lead", `Step5 工事登録: ${construction.construction_no} ¥${construction.order_amount.toLocaleString()}`);

  const { data: verifyCustomer } = await admin.from("customers").select("name").eq("id", customer.id).single();
  const { data: verifyDeal } = await admin.from("deals").select("title, stage").eq("id", deal.id).single();
  const { data: verifyEstimate } = await admin.from("estimates").select("estimate_no, total").eq("id", estimate.id).single();
  const { data: verifyConstruction } = await admin.from("constructions").select("construction_no, order_amount").eq("id", construction.id).single();

  if (verifyCustomer?.name === customerName) pass("lead", `DB確認 顧客: ${verifyCustomer.name}`);
  else fail("lead", "DB確認 顧客 NG");

  if (verifyDeal?.stage === "won") pass("lead", `DB確認 商談: ${verifyDeal.title} stage=won`);
  else fail("lead", "DB確認 商談 NG");

  if (verifyEstimate?.estimate_no === estimateNo) pass("lead", `DB確認 見積: ${verifyEstimate.estimate_no}`);
  else fail("lead", "DB確認 見積 NG");

  if (verifyConstruction?.construction_no === constructionNo) pass("lead", `DB確認 工事: ${verifyConstruction.construction_no}`);
  else fail("lead", "DB確認 工事 NG");

  for (const route of ["/crm", "/deals", "/quotes", "/constructions"]) {
    const { status } = await fetch(`${BASE_URL}${route}`, { headers: { Cookie: sessionCookie(session) } });
    if (status === 200) pass("lead", `画面 GET ${route} → 200`);
    else fail("lead", `画面 GET ${route} → ${status}`);
  }

  return { companyId, dealId: deal.id, customerId: customer.id };
}

// ── 3. Webhook / アプリ連携 ─────────────────────────────────────
async function testWebhooksAndIntegrations({ companyId, dealId }) {
  console.log("\n=== 3. Webhook / アプリ連携 ===");

  const received = [];
  const server = createServer((req, res) => {
    if (req.method === "POST") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        received.push({ url: req.url, headers: req.headers, body });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve, reject) => {
    server.listen(9876, "127.0.0.1", resolve);
    server.on("error", reject);
  });
  pass("webhook", "ローカル受信サーバー起動 :9876");

  const webhookUrl = "http://127.0.0.1:9876/bridge-webhook";
  const slackWebhookUrl = "http://127.0.0.1:9876/slack-webhook";
  const secret = "qa-secret-" + Date.now();

  const { data: endpoint, error: epErr } = await admin
    .from("webhook_endpoints")
    .insert({
      company_id: companyId,
      url: webhookUrl,
      secret,
      events: ["deal.updated", "deal.stage_changed"],
      description: "QA E2E webhook",
      is_active: true,
    })
    .select()
    .single();
  if (epErr) throw epErr;

  await admin.from("app_integrations").upsert(
    {
      company_id: companyId,
      provider: "slack",
      credentials: { webhook_url: slackWebhookUrl },
      settings: {},
      events: ["deal.updated", "deal.stage_changed"],
      is_active: true,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "company_id,provider" }
  );

  const dispatchResult = await runDispatchWebhook(env, companyId, "deal.updated", {
    id: dealId,
    title: "QA商談",
    stage: "won",
  });
  pass("webhook", "dispatchWebhook 相当処理 実行完了");

  await new Promise((r) => setTimeout(r, 1000));

  const bridgeHits = received.filter((r) => r.url.includes("bridge-webhook"));
  const slackHits = received.filter((r) => r.url.includes("slack-webhook"));

  if (bridgeHits.length > 0) {
    const parsed = JSON.parse(bridgeHits[0].body);
    if (parsed.event === "deal.updated" && parsed.data?.id === dealId) {
      pass("webhook", `Webhook 実配信 OK event=${parsed.event}`);
    } else fail("webhook", "Webhook ペイロード不正");
  } else {
    fail("webhook", "Webhook 未受信");
  }

  if (slackHits.length > 0) pass("webhook", "アプリ連携通知 実配信 OK");
  else fail("webhook", "アプリ連携通知 未受信");

  const { data: logs } = await admin
    .from("webhook_logs")
    .select("success, response_status")
    .eq("endpoint_id", endpoint.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (logs?.[0]?.success) pass("webhook", `webhook_logs 記録 OK status=${logs[0].response_status}`);
  else if (dispatchResult.logSuccess) pass("webhook", "webhook_logs 成功記録（dispatch 返却値）");
  else fail("webhook", `webhook_logs 未記録 success=${logs?.[0]?.success}`);

  server.close();
  await admin.from("webhook_endpoints").delete().eq("id", endpoint.id);
}

async function main() {
  console.log("BRIDGE QA E2E —", BASE_URL);
  try {
    await testRoleMatrix();
    const flow = await testLeadFlow();
    await testWebhooksAndIntegrations(flow);
  } catch (e) {
    fail("fatal", e.message);
    console.error(e);
  }

  console.log("\n=== サマリー ===");
  console.log(`OK: ${results.ok.length}  WARN: ${results.warn.length}  FAIL: ${results.fail.length}`);
  if (results.fail.length) {
    console.log("\n失敗:");
    results.fail.forEach((f) => console.log(`  [${f.section}] ${f.msg}`));
    process.exit(1);
  }
}

main();
