#!/usr/bin/env node
/**
 * コア機能 全画面 UAT E2E 検証
 *
 * 目的: AI・外部連携を除く「コア機能」が実際にレンダリング/疎通できるかを網羅検証する。
 *   - コア      : このスクリプトで HTTP 200 + エラーなしを確認（= 動作確認できる状態）
 *   - AI依存    : 本物AIは要APIキー。ルールベースで代替中 → このスクリプトの対象外（保留）
 *   - 外部連携  : CloudSign/Google/Webhook 等。要キー/OAuth/審査 → 対象外（保留）
 *
 * Usage: node scripts/core-uat-e2e.mjs
 * 前提: dev server (npm run dev) が localhost:3000 で起動していること。
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

const results = { ok: [], fail: [], skip: [] };
const pass = (m) => { results.ok.push(m); console.log(`  ✅ ${m}`); };
const fail = (m) => { results.fail.push(m); console.log(`  ❌ ${m}`); };
const skip = (m) => { results.skip.push(m); console.log(`  ⏭️  ${m}`); };

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
  if (error) throw new Error(`Login failed (${email}): ${error.message}`);
  return data.session;
}

// Next.js dev は not-found / error テキストをクライアントバンドルに常時含むため、
// 本文マーカーは「実際にクラッシュした時だけ出る決定的文言」に限定する。
// 404/500 等は HTTP ステータスで判定する（notFound() は 404 を返す）。
const ERROR_MARKERS = [
  "Application error: a client-side exception",
];

async function assertPage(session, path, label, no) {
  const tag = no ? `[No.${no}] ` : "";
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { Cookie: sessionCookie(session) },
      redirect: "manual",
    });
  } catch (e) {
    fail(`${tag}${label} (${path}) → fetch失敗: ${e.message}`);
    return;
  }
  const status = res.status;
  if (status === 307 || status === 302) {
    const loc = res.headers.get("location") ?? "";
    if (loc.includes("/login") || loc.includes("/unauthorized")) {
      fail(`${tag}${label} (${path}) → ${status} リダイレクト ${loc}`);
      return;
    }
    pass(`${tag}${label} (${path}) → ${status} (許容リダイレクト)`);
    return;
  }
  if (status !== 200) {
    fail(`${tag}${label} (${path}) → HTTP ${status}`);
    return;
  }
  const text = await res.text();
  const hit = ERROR_MARKERS.find((e) => text.includes(e));
  if (hit) fail(`${tag}${label} (${path}): エラー検出 "${hit}"`);
  else pass(`${tag}${label} (${path}) → 200`);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function firstId(table, companyId, extra = (q) => q) {
  const q = extra(admin.from(table).select("id").eq("company_id", companyId).limit(1));
  const { data } = await q;
  return data?.[0]?.id ?? null;
}

async function setupCoreData(companyId, ownerId) {
  const ts = Date.now();
  const { data: customer } = await admin.from("customers").insert({
    company_id: companyId, name: `CoreUAT_${ts}`, company_name: "コア検証工務店",
    email: `core-${ts}@example.com`, phone: "03-0000-0000", status: "active",
    inquiry_content: "コア機能UAT用データ",
  }).select().single();

  const { data: deal } = await admin.from("deals").insert({
    company_id: companyId, customer_id: customer.id, title: `Coreフロー商談_${ts}`,
    stage: "negotiation", value: 7700000, assigned_to: ownerId, priority: "high",
  }).select().single();

  const { count } = await admin.from("estimates").select("*", { count: "exact", head: true }).eq("company_id", companyId);
  const subtotal = 7000000, costTotal = 4550000;
  const { data: estimate } = await admin.from("estimates").insert({
    company_id: companyId, customer_id: customer.id, deal_id: deal.id,
    estimate_no: `EST-CORE-${String((count ?? 0) + 1).padStart(4, "0")}`,
    title: `Coreコア見積_${ts}`, status: "draft",
    subtotal, tax: Math.floor(subtotal * 0.1), total: subtotal + Math.floor(subtotal * 0.1),
    cost_total: costTotal, gross_profit: subtotal - costTotal,
    gross_profit_rate: ((subtotal - costTotal) / subtotal) * 100,
    default_gross_profit_rate: 0.5, approval_status: "none",
  }).select().single();

  const { count: ccount } = await admin.from("contracts").select("*", { count: "exact", head: true }).eq("company_id", companyId);
  const { data: contract } = await admin.from("contracts").insert({
    company_id: companyId, contract_no: `CON-CORE-${String((ccount ?? 0) + 1).padStart(4, "0")}`,
    title: deal.title, customer_id: customer.id, deal_id: deal.id, estimate_id: estimate.id,
    amount: estimate.total, assigned_to: ownerId, status: "preparing",
  }).select().single();

  const { count: cstcount } = await admin.from("constructions").select("*", { count: "exact", head: true }).eq("company_id", companyId);
  const { data: construction } = await admin.from("constructions").insert({
    company_id: companyId, construction_no: `CST-CORE-${String((cstcount ?? 0) + 1).padStart(4, "0")}`,
    title: deal.title, customer_id: customer.id, contract_id: contract.id, deal_id: deal.id,
    estimate_id: estimate.id, assigned_to: ownerId, order_amount: estimate.total,
    budget_cost: estimate.cost_total, status: "preparing",
  }).select().single();

  return { ts, customer, deal, estimate, contract, construction };
}

async function main() {
  console.log("=== コア機能 全画面 UAT E2E ===");
  console.log(`Base URL: ${BASE_URL}\n`);

  const { data: owner } = await admin.from("profiles").select("id, company_id, display_name").eq("email", "admin@example.com").single();
  if (!owner) throw new Error("admin@example.com not found");

  const session = await signIn("admin@example.com");
  pass(`ログイン: admin@example.com (${owner.display_name})`);

  const mock = await setupCoreData(owner.company_id, owner.id);
  pass(`テストデータ: 顧客=${mock.customer.name} / 契約=${mock.contract.contract_no} / 工事=${mock.construction.construction_no}`);

  // 既存デモデータから詳細ページ用 ID を拾う（無ければ skip）
  const craftId = await firstId("craftsmen", owner.company_id);
  const invoiceId = await firstId("invoices", owner.company_id);
  const circId = await firstId("announcements", owner.company_id);

  console.log("\n=== 1-1 ログイン・勤怠 (コア) ===");
  await assertPage(session, "/dashboard", "ダッシュボード(勤怠打刻)", "4-8");
  await assertPage(session, "/attendance", "勤怠管理", "93,94");

  console.log("\n=== 1-2/1-3 問い合わせ・商談進捗 (コア) ===");
  await assertPage(session, "/crm", "顧客・商談管理", "64,65,70");
  await assertPage(session, "/crm/new", "顧客手動登録", "10");
  await assertPage(session, "/crm?view=pipeline", "商談パイプライン", "68,69");
  await assertPage(session, `/crm/${mock.customer.id}`, "顧客詳細", "66,67");
  await assertPage(session, `/crm/${mock.customer.id}?tab=recording`, "録音タブ", "15");
  await assertPage(session, `/crm/${mock.customer.id}?tab=scheduling`, "スケジューリング(ルールベース)", "13,14");

  console.log("\n=== 1-4 見積 (コア) ===");
  await assertPage(session, "/quotes", "見積管理", "71");
  await assertPage(session, "/quotes/new", "新規見積", "24");
  await assertPage(session, `/quotes/${mock.estimate.id}`, "見積詳細(粗利計算)", "26-31,72");
  await assertPage(session, `/quotes/${mock.estimate.id}/edit`, "見積編集", "26");

  console.log("\n=== 1-5 承認WF (コア) ===");
  await assertPage(session, "/workflow", "ワークフロー", "32,36,38,95,96");
  await assertPage(session, "/workflow/new", "ワークフロー申請", "33");

  console.log("\n=== 1-6/1-7 受注・契約・工事 (コア) ===");
  await assertPage(session, "/deals", "商談一覧/パイプライン", "40,41");
  await assertPage(session, "/contracts", "契約管理", "77,79");
  await assertPage(session, `/contracts/${mock.contract.id}`, "契約詳細(書類作成/承認WF)", "48-50,52,53,54,57,78");
  await assertPage(session, "/constructions", "工事管理", "80");
  await assertPage(session, `/constructions/new?deal_id=${mock.deal.id}&customer_id=${mock.customer.id}&estimate_id=${mock.estimate.id}`, "工事登録(受注転記)", "44");
  await assertPage(session, `/constructions/${mock.construction.id}`, "工事詳細(工程表/台帳/発注/請求)", "81,83,84,85");

  console.log("\n=== B. 生産・ポータル・職人 (コア) ===");
  await assertPage(session, "/craftsmen", "職人管理", "74,75");
  if (craftId) await assertPage(session, `/craftsmen/${craftId}`, "職人詳細", "76");
  else skip("職人詳細 (No.76): 既存データなし");
  await assertPage(session, "/invoices", "請求管理", "86,87");
  if (invoiceId) await assertPage(session, `/invoices/${invoiceId}`, "請求詳細", "86");
  else skip("請求詳細 (No.86): 既存データなし");
  await assertPage(session, "/budget", "予算管理", "88");
  await assertPage(session, "/calendar", "カレンダー(アプリ内)", "89");
  await assertPage(session, "/circulation", "回覧・お知らせ", "97,98");
  if (circId) await assertPage(session, `/circulation/${circId}`, "回覧詳細", "98");
  else skip("回覧詳細 (No.98): 既存データなし");
  await assertPage(session, "/documents", "文書管理", "99,100");

  console.log("\n=== ダッシュボード/BI (コア) ===");
  await assertPage(session, "/bi", "BIダッシュボード", "60-62");
  await assertPage(session, "/bi/settings", "BI期首設定", "63");

  console.log("\n=== テナント設定 (コア) ===");
  await assertPage(session, "/settings", "設定(プロフィール/会社/メンバー/マスタ)", "104-112");

  console.log("\n=== C. 運営管理画面 (コア) ===");
  try {
    const adminSession = await signIn("super-admin@example.com");
    pass("ログイン: super-admin@example.com");
    await assertPage(adminSession, "/admin", "運営管理コンソール", "116-124,128");
  } catch (e) {
    fail(`運営ログイン: ${e.message}`);
  }

  console.log("\n=== 結果 ===");
  console.log(`✅ 成功 ${results.ok.length} 件`);
  console.log(`⏭️  スキップ ${results.skip.length} 件`);
  console.log(`❌ 失敗 ${results.fail.length} 件`);
  if (results.fail.length) {
    console.log("\n失敗一覧:");
    results.fail.forEach((f) => console.log(`   - ${f}`));
    process.exit(1);
  }
  console.log("\n🎉 コア機能 全画面 UAT すべて成功");
}

main().catch((e) => { console.error(e); process.exit(1); });
