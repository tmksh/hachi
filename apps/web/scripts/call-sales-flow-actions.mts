/**
 * Server Actions (sales-flow.ts) を認証セッション付きで直接実行するテスト
 * Usage: NODE_OPTIONS='--import ./scripts/preload-mock.mjs' npx tsx scripts/call-sales-flow-actions.mts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const envPath = resolve(__dirname, "../.env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY!;

process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON_KEY;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function projectRef() {
  return new URL(SUPABASE_URL).hostname.split(".")[0];
}

function authCookieName() {
  return `sb-${projectRef()}-auth-token`;
}

async function signIn(email: string, password: string) {
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session!;
}

// next/headers の cookies() をモック（preload-mock.mjs で register 済み）
const cookieStore = new Map<string, string>();

const session = await signIn("admin@example.com", "admin2026");
const cookieValue = encodeURIComponent(JSON.stringify({
  access_token: session.access_token,
  refresh_token: session.refresh_token,
  expires_at: session.expires_at,
  expires_in: session.expires_in,
  token_type: session.token_type,
  user: session.user,
}));
cookieStore.set(authCookieName(), cookieValue);

// Export for mock
(globalThis as unknown as { __testCookies: Map<string, string> }).__testCookies = cookieStore;

const results: { ok: string[]; fail: string[] } = { ok: [], fail: [] };
const pass = (m: string) => { results.ok.push(m); console.log(`  ✅ ${m}`); };
const fail = (m: string) => { results.fail.push(m); console.log(`  ❌ ${m}`); };

async function main() {
  console.log("=== Server Actions 直接実行テスト ===");

  const { data: profile } = await admin.from("profiles").select("id, company_id").eq("email", "admin@example.com").single();
  if (!profile) throw new Error("profile not found");

  const ts = Date.now();
  const { data: customer } = await admin.from("customers").insert({
    company_id: profile.company_id,
    name: `ActionTest_${ts}`,
    status: "active",
    email: `action-${ts}@test.com`,
  }).select().single();

  const { data: deal } = await admin.from("deals").insert({
    company_id: profile.company_id,
    customer_id: customer!.id,
    title: `Action商談_${ts}`,
    stage: "negotiation",
    value: 5000000,
    assigned_to: profile.id,
  }).select().single();

  const { count } = await admin.from("estimates").select("*", { count: "exact", head: true }).eq("company_id", profile.company_id);
  const { data: estimate } = await admin.from("estimates").insert({
    company_id: profile.company_id,
    customer_id: customer!.id,
    deal_id: deal!.id,
    estimate_no: `EST-ACT-${String((count ?? 0) + 1).padStart(4, "0")}`,
    title: "Action見積",
    status: "draft",
    subtotal: 3000000,
    tax: 300000,
    total: 3300000,
    cost_total: 2200000,
    gross_profit: 800000,
    gross_profit_rate: 26.67,
    default_gross_profit_rate: 0.5,
    approval_status: "none",
  }).select().single();

  // Dynamic import server actions AFTER mock registered
  const {
    processRecordingComplete,
    submitEstimateApproval,
    confirmDealWon,
    reviewStageProposal,
    getPendingStageProposals,
  } = await import("../src/lib/actions/sales-flow");

  // 1-3 processRecordingComplete
  const { data: recording } = await admin.from("customer_recordings").insert({
    company_id: profile.company_id,
    customer_id: customer!.id,
    deal_id: deal!.id,
    title: "test",
    transcript: "見積書を提出します。契約に向けて進めます。",
    status: "completed",
    created_by: profile.id,
  }).select().single();

  try {
    const recResult = await processRecordingComplete({
      customerId: customer!.id,
      recordingId: recording!.id,
      dealId: deal!.id,
      transcript: recording!.transcript,
    });
    if (recResult.summary) pass(`processRecordingComplete: summary=${recResult.summary.slice(0, 30)}… todos=${recResult.todosCreated}`);
    else fail("processRecordingComplete: no summary");

    const proposals = await getPendingStageProposals();
    const mine = proposals.filter((p) => p.deal_id === deal!.id);
    if (mine.length > 0) {
      pass(`getPendingStageProposals: ${mine.length}件`);
      await reviewStageProposal(mine[0].id, "approve");
      const { data: d } = await admin.from("deals").select("stage").eq("id", deal!.id).single();
      if (d?.stage !== "negotiation") pass(`reviewStageProposal: stage=${d?.stage}`);
      else fail("reviewStageProposal: stage unchanged");
    } else {
      fail("getPendingStageProposals: 0件");
    }
  } catch (e) {
    fail(`processRecordingComplete: ${e instanceof Error ? e.message : e}`);
  }

  // 1-4/1-5 submitEstimateApproval
  const { data: approverProfile } = await admin.from("profiles").select("id").eq("company_id", profile.company_id).neq("id", profile.id).limit(1).maybeSingle();
  const approverId = approverProfile?.id ?? profile.id;

  try {
    const approval = await submitEstimateApproval({
      estimateId: estimate!.id,
      comment: "競合対抗値引きのため",
      approverId,
    });
    if (approval.workflowRequestId) pass(`submitEstimateApproval: wf=${approval.workflowRequestId.slice(0, 8)}…`);
    else fail("submitEstimateApproval: no workflow id");

    const { data: est } = await admin.from("estimates").select("approval_status").eq("id", estimate!.id).single();
    if (est?.approval_status === "pending") pass("estimate approval_status=pending");
    else fail(`estimate approval_status=${est?.approval_status}`);
  } catch (e) {
    fail(`submitEstimateApproval: ${e instanceof Error ? e.message : e}`);
  }

  // 1-6 confirmDealWon
  await admin.from("deals").update({ stage: "won" }).eq("id", deal!.id);
  try {
    const won = await confirmDealWon(deal!.id);
    if (won.contractId && won.redirectUrl.includes("/constructions/new")) {
      pass(`confirmDealWon: contract=${won.contractNo} redirect OK`);
    } else fail("confirmDealWon: missing contract or redirect");

    const { data: c } = await admin.from("contracts").select("deal_id, estimate_id").eq("id", won.contractId).single();
    if (c?.deal_id === deal!.id) pass("contract.deal_id 紐付け OK");
    else fail("contract.deal_id 不一致");
  } catch (e) {
    fail(`confirmDealWon: ${e instanceof Error ? e.message : e}`);
  }

  console.log(`\n=== 結果: ✅ ${results.ok.length} / ❌ ${results.fail.length} ===`);
  if (results.fail.length) {
    results.fail.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
