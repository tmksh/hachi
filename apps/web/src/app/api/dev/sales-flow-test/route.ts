import { NextResponse } from "next/server";
import {
  processRecordingComplete,
  submitEstimateApproval,
  confirmDealWon,
  reviewStageProposal,
  getPendingStageProposals,
} from "@/lib/actions/sales-flow";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/** 開発環境のみ: Server Actions 営業フロー検証 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Missing Supabase env" }, { status: 500 });
  }

  const admin = createServiceClient(url, serviceKey, { auth: { persistSession: false } });
  const results: { ok: string[]; fail: string[] } = { ok: [], fail: [] };
  const pass = (m: string) => results.ok.push(m);
  const fail = (m: string) => results.fail.push(m);

  const { data: profile } = await admin.from("profiles").select("id, company_id").eq("email", "admin@example.com").single();
  if (!profile) return NextResponse.json({ error: "admin profile not found" }, { status: 500 });

  const ts = Date.now();
  const { data: customer } = await admin.from("customers").insert({
    company_id: profile.company_id,
    name: `DevAction_${ts}`,
    status: "active",
    email: `dev-action-${ts}@test.com`,
  }).select().single();

  const { data: deal } = await admin.from("deals").insert({
    company_id: profile.company_id,
    customer_id: customer!.id,
    title: `Dev商談_${ts}`,
    stage: "negotiation",
    value: 6000000,
    assigned_to: profile.id,
  }).select().single();

  const { count } = await admin.from("estimates").select("*", { count: "exact", head: true }).eq("company_id", profile.company_id);
  const subtotal = 4000000;
  const costTotal = 2800000;
  const { data: estimate } = await admin.from("estimates").insert({
    company_id: profile.company_id,
    customer_id: customer!.id,
    deal_id: deal!.id,
    estimate_no: `EST-DEV-${String((count ?? 0) + 1).padStart(4, "0")}`,
    title: "Dev見積",
    status: "draft",
    subtotal,
    tax: Math.floor(subtotal * 0.1),
    total: subtotal + Math.floor(subtotal * 0.1),
    cost_total: costTotal,
    gross_profit: subtotal - costTotal,
    gross_profit_rate: ((subtotal - costTotal) / subtotal) * 100,
    default_gross_profit_rate: 0.5,
    approval_status: "none",
  }).select().single();

  const { data: recording } = await admin.from("customer_recordings").insert({
    company_id: profile.company_id,
    customer_id: customer!.id,
    deal_id: deal!.id,
    title: "dev test",
    transcript: "見積書を来週提出します。契約に向けて進めます。",
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
    if (recResult.summary) pass(`processRecordingComplete: todos=${recResult.todosCreated}`);
    else fail("processRecordingComplete: no summary");

    const proposals = await getPendingStageProposals();
    const mine = proposals.filter((p) => p.deal_id === deal!.id);
    if (mine.length > 0) {
      pass(`getPendingStageProposals: ${mine.length}件`);
      await reviewStageProposal(mine[0].id, "approve");
      pass("reviewStageProposal: approved");
    } else fail("getPendingStageProposals: 0件");
  } catch (e) {
    fail(`1-3: ${e instanceof Error ? e.message : e}`);
  }

  const { data: approverProfile } = await admin.from("profiles").select("id").eq("company_id", profile.company_id).neq("id", profile.id).limit(1).maybeSingle();
  try {
    const approval = await submitEstimateApproval({
      estimateId: estimate!.id,
      comment: "Dev test approval",
      approverId: approverProfile?.id ?? profile.id,
    });
    if (approval.workflowRequestId) pass(`submitEstimateApproval: ${approval.workflowRequestId.slice(0, 8)}`);
    else fail("submitEstimateApproval: no workflow");
  } catch (e) {
    fail(`1-4/1-5: ${e instanceof Error ? e.message : e}`);
  }

  await admin.from("deals").update({ stage: "won" }).eq("id", deal!.id);
  try {
    const won = await confirmDealWon(deal!.id);
    if (won.contractId && won.redirectUrl.includes("/constructions/new")) pass(`confirmDealWon: ${won.contractNo}`);
    else fail("confirmDealWon: incomplete result");
  } catch (e) {
    fail(`1-6: ${e instanceof Error ? e.message : e}`);
  }

  return NextResponse.json({
    ok: results.fail.length === 0,
    passed: results.ok,
    failed: results.fail,
    ids: { customerId: customer!.id, dealId: deal!.id, estimateId: estimate!.id },
  });
}
