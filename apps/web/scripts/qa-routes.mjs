#!/usr/bin/env node
/**
 * 全機能ルート QA（owner ログイン・GET 200 確認）
 * Usage: node scripts/qa-routes.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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

const BASE_URL = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = { ok: [], fail: [] };

function pass(msg) {
  results.ok.push(msg);
  console.log(`  ✅ ${msg}`);
}
function fail(msg) {
  results.fail.push(msg);
  console.log(`  ❌ ${msg}`);
}

function projectRef() {
  return new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
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

async function signIn() {
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: "admin@example.com",
    password: "admin2026",
  });
  if (error) throw new Error(`Login failed: ${error.message}`);
  return data.session;
}

async function fetchPage(session, path) {
  let url = `${BASE_URL}${path}`;
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { Cookie: sessionCookie(session) },
    });
    if (res.status === 200) return { ok: true, status: 200, path };
    const loc = res.headers.get("location") || "";
    if ((res.status === 307 || res.status === 308) && loc.includes("/login")) {
      return { ok: false, status: res.status, path, reason: "→ /login" };
    }
    if ((res.status === 307 || res.status === 308) && loc.includes("/unauthorized")) {
      return { ok: false, status: res.status, path, reason: "→ /unauthorized" };
    }
    if ((res.status === 307 || res.status === 308) && loc.startsWith("/")) {
      url = `${BASE_URL}${loc}`;
      continue;
    }
    return { ok: false, status: res.status, path, reason: loc || `HTTP ${res.status}` };
  }
  return { ok: false, status: 0, path, reason: "redirect loop" };
}

const STATIC_ROUTES = [
  { group: "ダッシュボード", path: "/dashboard" },
  { group: "ダッシュボード", path: "/bi" },
  { group: "ダッシュボード", path: "/bi/settings" },
  { group: "リード", path: "/crm" },
  { group: "リード", path: "/crm/new" },
  { group: "リード", path: "/deals" },
  { group: "リード", path: "/quotes" },
  { group: "リード", path: "/quotes/new" },
  { group: "リード", path: "/leads" },
  { group: "リード", path: "/craftsmen" },
  { group: "リード", path: "/craftsmen/new" },
  { group: "生産", path: "/contracts" },
  { group: "生産", path: "/contracts/new" },
  { group: "生産", path: "/constructions" },
  { group: "生産", path: "/constructions/new" },
  { group: "生産", path: "/invoices" },
  { group: "生産", path: "/invoices/new" },
  { group: "生産", path: "/budget" },
  { group: "ポータル", path: "/calendar" },
  { group: "ポータル", path: "/calendar/new" },
  { group: "ポータル", path: "/mail" },
  { group: "ポータル", path: "/mail/compose" },
  { group: "ポータル", path: "/attendance" },
  { group: "ポータル", path: "/workflow" },
  { group: "ポータル", path: "/workflow/new" },
  { group: "ポータル", path: "/circulation" },
  { group: "ポータル", path: "/circulation/new" },
  { group: "ポータル", path: "/documents" },
  { group: "システム", path: "/settings" },
  { group: "マーケ", path: "/marketing/email" },
  { group: "マーケ", path: "/marketing/email/new" },
  { group: "マーケ", path: "/marketing/sns" },
  { group: "マーケ", path: "/marketing/roi" },
  { group: "マーケ", path: "/marketing/creative" },
  { group: "マーケ", path: "/marketing/creative/new" },
];

async function loadSampleIds(companyId) {
  const q = (table, cols = "id") =>
    admin.from(table).select(cols).eq("company_id", companyId).limit(1).maybeSingle();

  const [
    customer,
    estimate,
    craftsman,
    contract,
    construction,
    invoice,
    workflow,
    announcement,
    emailThread,
  ] = await Promise.all([
    q("customers"),
    q("estimates"),
    q("craftsmen"),
    q("contracts"),
    q("constructions"),
    q("invoices"),
    q("workflow_requests"),
    q("announcements"),
    q("email_threads"),
  ]);

  return {
    customerId: customer.data?.id,
    estimateId: estimate.data?.id,
    craftsmanId: craftsman.data?.id,
    contractId: contract.data?.id,
    constructionId: construction.data?.id,
    invoiceId: invoice.data?.id,
    workflowId: workflow.data?.id,
    announcementId: announcement.data?.id,
    emailThreadId: emailThread.data?.id,
  };
}

function dynamicRoutes(ids) {
  const routes = [];
  const add = (group, path, id, label) => {
    if (id) routes.push({ group, path, label });
  };
  add("リード", `/crm/${ids.customerId}`, ids.customerId, "顧客詳細");
  add("リード", `/crm/${ids.customerId}/edit`, ids.customerId, "顧客編集");
  add("リード", `/quotes/${ids.estimateId}`, ids.estimateId, "見積詳細");
  add("リード", `/quotes/${ids.estimateId}/edit`, ids.estimateId, "見積編集");
  add("リード", `/craftsmen/${ids.craftsmanId}`, ids.craftsmanId, "職人詳細");
  add("リード", `/craftsmen/${ids.craftsmanId}/edit`, ids.craftsmanId, "職人編集");
  add("生産", `/contracts/${ids.contractId}`, ids.contractId, "契約詳細");
  add("生産", `/contracts/${ids.contractId}/edit`, ids.contractId, "契約編集");
  add("生産", `/constructions/${ids.constructionId}`, ids.constructionId, "工事詳細");
  add("生産", `/constructions/${ids.constructionId}/edit`, ids.constructionId, "工事編集");
  add("生産", `/invoices/${ids.invoiceId}`, ids.invoiceId, "請求詳細");
  add("ポータル", `/workflow/${ids.workflowId}`, ids.workflowId, "ワークフロー詳細");
  add("ポータル", `/circulation/${ids.announcementId}`, ids.announcementId, "回覧詳細");
  add("マーケ", `/marketing/email/${ids.emailThreadId}`, ids.emailThreadId, "メール施策詳細");
  return routes;
}

async function testApiEndpoints() {
  console.log("\n=== REST API（未認証） ===");
  for (const path of [
    "/api/v1/customers",
    "/api/v1/deals",
    "/api/v1/estimates",
    "/api/v1/constructions",
    "/api/v1/invoices",
    "/api/v1/contracts",
  ]) {
    const res = await fetch(`${BASE_URL}${path}`);
    if (res.status === 401) pass(`${path} → 401`);
    else fail(`${path} → ${res.status}（期待: 401）`);
  }
}

async function main() {
  console.log("BRIDGE 全ルート QA —", BASE_URL);
  const session = await signIn();
  pass("ログイン admin@example.com");

  const { data: profile } = await admin
    .from("profiles")
    .select("company_id")
    .eq("email", "admin@example.com")
    .single();
  const ids = await loadSampleIds(profile.company_id);
  const dynamic = dynamicRoutes(ids);

  console.log("\n=== 静的ルート ===");
  for (const { group, path } of STATIC_ROUTES) {
    const r = await fetchPage(session, path);
    if (r.ok) pass(`[${group}] ${path}`);
    else fail(`[${group}] ${path} — ${r.reason}`);
  }

  console.log("\n=== 動的ルート（DB サンプル ID） ===");
  for (const { group, path, label } of dynamic) {
    const r = await fetchPage(session, path);
    if (r.ok) pass(`[${group}] ${label} ${path}`);
    else fail(`[${group}] ${label} ${path} — ${r.reason}`);
  }

  const skipped = [
    ["顧客", !ids.customerId],
    ["見積", !ids.estimateId],
    ["職人", !ids.craftsmanId],
    ["契約", !ids.contractId],
    ["工事", !ids.constructionId],
    ["請求", !ids.invoiceId],
    ["WF", !ids.workflowId],
    ["回覧", !ids.announcementId],
    ["メール施策", !ids.emailThreadId],
  ].filter(([, s]) => s);
  if (skipped.length) {
    console.log("\n=== スキップ（データなし） ===");
    skipped.forEach(([name]) => console.log(`  ⏭  ${name} — サンプル ID なし`));
  }

  await testApiEndpoints();

  console.log("\n=== サマリー ===");
  console.log(`OK: ${results.ok.length}  FAIL: ${results.fail.length}`);
  if (results.fail.length) {
    console.log("\n失敗一覧:");
    results.fail.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
