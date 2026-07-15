"use server";

import { createClient } from "@/lib/supabase/server";
import { dispatchWebhook } from "@/lib/webhooks";
import {
  proposeStageTransition,
  recommendFieldAssignee,
  summarizeMeetingRecording,
  estimateConstructionDuration,
  resolveLinqAiConfig,
} from "@/lib/integrations/linq-ai";
import { createWorkflowRequest } from "@/lib/actions/workflow";
import { toMarginThresholdPercent } from "@/lib/estimate-margin";

async function getCompanyContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id, role").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");
  return { supabase, company_id: profile.company_id, user_id: user.id, role: profile.role };
}

/** 3経路通知（他モジュールからも利用） */
export async function notifySalesFlowUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  userId: string,
  input: {
    title: string;
    description?: string;
    href?: string;
    customerId?: string;
    dealId?: string;
    urgent?: boolean;
    /** true のとき ToDo は作らずお知らせのみ（既存 ToDo の通知用） */
    skipTodo?: boolean;
  },
  fromUserId?: string,
) {
  await notifyUser(supabase, companyId, userId, input, fromUserId);
}

async function notifyUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  userId: string,
  input: {
    title: string;
    description?: string;
    href?: string;
    customerId?: string;
    dealId?: string;
    urgent?: boolean;
    skipTodo?: boolean;
  },
  fromUserId?: string,
) {
  const { tokyoDateString } = await import("@/lib/tokyo-date");
  const today = tokyoDateString();

  if (!input.skipTodo) {
    const { error: todoErr } = await supabase.from("todos").insert({
      company_id: companyId,
      assigned_to: userId,
      customer_id: input.customerId ?? null,
      deal_id: input.dealId ?? null,
      title: input.title,
      description: input.description ?? null,
      status: "pending",
      priority: input.urgent ? "high" : "medium",
      due_date: input.urgent ? today : null,
      tags: input.urgent ? ["urgent", "sales_flow", "notify_flag"] : ["sales_flow"],
      source: "sales_flow",
    });
    if (todoErr) console.error("[notifyUser] todo insert failed", todoErr);
  }

  const body = [
    input.description,
    input.href ? `詳細: ${input.href}` : null,
  ].filter(Boolean).join("\n\n") || input.title;

  const { error: annErr } = await supabase.from("announcements").insert({
    company_id: companyId,
    author_id: fromUserId ?? userId,
    title: input.title,
    body,
    is_urgent: input.urgent ?? false,
    target_type: "individuals",
    target_user_ids: [userId],
    published_at: new Date().toISOString(),
  });
  if (annErr) console.error("[notifyUser] announcement insert failed", annErr);

  void dispatchWebhook(companyId, "sales_flow.notification", {
    user_id: userId,
    title: input.title,
    href: input.href,
    urgent: input.urgent ?? false,
  });
}

// ---------------------------------------------------------------------------
// 1-6 受注確定 → 契約自動登録 → 工事登録へ
// ---------------------------------------------------------------------------

export type ConfirmDealWonResult = {
  contractId: string;
  contractNo: string;
  dealId: string;
  customerId: string;
  estimateId: string | null;
  redirectUrl: string;
  durationSuggestion?: { startDate: string; endDate: string; reason: string };
  assigneeSuggestion?: { profileId: string; displayName: string; score: number } | null;
};

export async function confirmDealWon(dealId: string): Promise<ConfirmDealWonResult> {
  const { supabase, company_id, user_id } = await getCompanyContext();

  const { data: deal, error: dealErr } = await supabase
    .from("deals")
    .select("*, customer:customers(id, name, company_name, address, email)")
    .eq("id", dealId)
    .single();
  if (dealErr || !deal) throw new Error("商談が見つかりません");

  const { data: latestEstimate } = await supabase
    .from("estimates")
    .select("id, total, title, estimate_no")
    .eq("company_id", company_id)
    .eq("customer_id", deal.customer_id)
    .in("status", ["accepted", "sent", "issued", "draft"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const amount = deal.value ?? latestEstimate?.total ?? 0;
  const title = deal.title || latestEstimate?.title || "工事";

  const { count } = await supabase.from("contracts").select("*", { count: "exact", head: true }).eq("company_id", company_id);
  const contractNo = `CON-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const { data: contract, error: contractErr } = await supabase
    .from("contracts")
    .insert({
      company_id,
      contract_no: contractNo,
      title,
      customer_id: deal.customer_id,
      deal_id: dealId,
      estimate_id: latestEstimate?.id ?? null,
      amount,
      assigned_to: deal.assigned_to ?? user_id,
      status: "preparing",
      notes: JSON.stringify({ source: "deal_won", deal_id: dealId }),
    })
    .select()
    .single();
  if (contractErr) throw contractErr;

  void dispatchWebhook(company_id, "contract.created", {
    id: contract.id,
    contract_no: contractNo,
    deal_id: dealId,
    source: "deal_won",
  });

  const duration = await estimateConstructionDuration("", Number(amount), await resolveLinqAiConfig());
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, department")
    .eq("company_id", company_id)
    .in("role", ["field_manager", "employee", "sales", "admin"]);

  const constructionCounts = await Promise.all(
    (profiles ?? []).map(async (p) => {
      const { count: c } = await supabase
        .from("constructions")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", p.id)
        .in("status", ["preparing", "in_progress"]);
      return { ...p, activeConstructions: c ?? 0 };
    }),
  );

  const assigneeRec = await recommendFieldAssignee(
    constructionCounts.map((p) => ({
      id: p.id,
      displayName: p.display_name,
      activeConstructions: p.activeConstructions,
      department: p.department ?? undefined,
    })),
    { customerAddress: (deal.customer as { address?: string })?.address },
    await resolveLinqAiConfig(),
  );

  const params = new URLSearchParams({
    deal_id: dealId,
    contract_id: contract.id,
    customer_id: deal.customer_id,
    title,
    order_amount: String(amount),
  });
  if (latestEstimate?.id) params.set("estimate_id", latestEstimate.id);
  if (duration.startDate) params.set("start_date", duration.startDate);
  if (duration.endDate) params.set("end_date", duration.endDate);
  if (assigneeRec.recommendedId) params.set("assigned_to", assigneeRec.recommendedId);
  if (assigneeRec.candidates.length > 0) {
    params.set(
      "assignee_candidates",
      encodeURIComponent(JSON.stringify(
        assigneeRec.candidates.slice(0, 5).map((c) => ({
          profileId: c.profileId,
          displayName: c.displayName,
          score: c.score,
        })),
      )),
    );
  }

  return {
    contractId: contract.id,
    contractNo,
    dealId,
    customerId: deal.customer_id,
    estimateId: latestEstimate?.id ?? null,
    redirectUrl: `/constructions/new?${params.toString()}`,
    durationSuggestion: {
      startDate: duration.startDate,
      endDate: duration.endDate,
      reason: duration.reason,
    },
    assigneeSuggestion: assigneeRec.recommendedId
      ? {
          profileId: assigneeRec.recommendedId,
          displayName: assigneeRec.candidates.find((c) => c.profileId === assigneeRec.recommendedId)?.displayName ?? "",
          score: assigneeRec.candidates.find((c) => c.profileId === assigneeRec.recommendedId)?.score ?? 0,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// 1-4/1-5 見積粗利未達 → 上長承認
// ---------------------------------------------------------------------------

export async function submitEstimateApproval(input: {
  estimateId: string;
  comment: string;
  approverId: string;
}) {
  const { supabase, company_id, user_id } = await getCompanyContext();

  const { data: estimate, error } = await supabase
    .from("estimates")
    .select("*, customer:customers(name, company_name)")
    .eq("id", input.estimateId)
    .single();
  if (error || !estimate) throw new Error("見積が見つかりません");

  const threshold = toMarginThresholdPercent(estimate.default_gross_profit_rate);
  if ((estimate.gross_profit_rate ?? 0) >= threshold) {
    throw new Error(`粗利率が基準(${threshold.toFixed(0)}%)以上のため承認申請は不要です`);
  }

  let { data: wfType } = await supabase
    .from("workflow_types")
    .select("id, approval_route")
    .eq("company_id", company_id)
    .eq("key", "estimate_margin")
    .maybeSingle();

  // 未設定の場合は自動作成する（既存会社向けフォールバック）
  if (!wfType) {
    const { data: created } = await supabase
      .from("workflow_types")
      .insert({
        company_id,
        key: "estimate_margin",
        name: "見積承認（粗利率未達）",
        description: "粗利率が基準を下回る見積を上長が承認するフロー",
        fields_schema: [],
        approval_route: [],
        sort_order: 0,
      })
      .select("id, approval_route")
      .single();
    if (!created) throw new Error("見積承認ワークフロー種別の自動作成に失敗しました");
    wfType = created;
  }

  const approvalRoute = (wfType.approval_route ?? []) as Array<{ approver_id: string; step_order?: number }>;
  const approverIds = approvalRoute.length > 0
    ? approvalRoute.sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0)).map((s) => s.approver_id)
    : [input.approverId];

  const customerLabel = (estimate.customer as { company_name?: string; name?: string })?.company_name
    ?? (estimate.customer as { name?: string })?.name
    ?? "";

  const request = await createWorkflowRequest({
    type_id: wfType.id,
    title: `見積承認: ${estimate.estimate_no} ${estimate.title ?? ""}（粗利率 ${(estimate.gross_profit_rate ?? 0).toFixed(1)}%）`,
    amount: Number(estimate.total ?? 0),
    is_urgent: true,
    payload: {
      estimate_id: input.estimateId,
      gross_profit_rate: estimate.gross_profit_rate,
      application_comment: input.comment,
      customer_name: customerLabel,
    },
    approver_ids: approverIds,
  });

  await supabase.from("workflow_comments").insert({
    company_id,
    request_id: request.id,
    user_id,
    message: input.comment,
  });

  await supabase.from("estimates").update({
    approval_status: "pending",
    workflow_request_id: request.id,
    updated_at: new Date().toISOString(),
  }).eq("id", input.estimateId);

  for (const approverId of approverIds.slice(0, 1)) {
    await notifyUser(supabase, company_id, approverId, {
      title: `見積承認依頼: ${estimate.estimate_no}`,
      description: input.comment,
      href: `/workflow/${request.id}`,
      customerId: estimate.customer_id ?? undefined,
      urgent: true,
    }, user_id);
  }

  void dispatchWebhook(company_id, "estimate.approval_requested", {
    estimate_id: input.estimateId,
    workflow_request_id: request.id,
    gross_profit_rate: estimate.gross_profit_rate,
  });

  return { workflowRequestId: request.id };
}

export async function getEstimateMarginThreshold(estimateId: string) {
  const { supabase } = await getCompanyContext();
  const { data } = await supabase
    .from("estimates")
    .select("gross_profit_rate, default_gross_profit_rate, approval_status, workflow_request_id, status")
    .eq("id", estimateId)
    .single();
  if (!data) return null;
  const threshold = toMarginThresholdPercent(data.default_gross_profit_rate);
  return {
    grossProfitRate: data.gross_profit_rate ?? 0,
    threshold,
    needsApproval: (data.gross_profit_rate ?? 0) < threshold,
    approvalStatus: data.approval_status ?? "none",
    workflowRequestId: data.workflow_request_id,
    status: data.status as string | null,
  };
}

/** 粗利率が基準以上の見積を確定（発行済み）にする（No.38） */
export async function confirmEstimateIssued(estimateId: string) {
  const { supabase } = await getCompanyContext();
  const { data: estimate, error } = await supabase
    .from("estimates")
    .select("gross_profit_rate, default_gross_profit_rate, status")
    .eq("id", estimateId)
    .single();
  if (error || !estimate) throw new Error("見積が見つかりません");

  // 明細から再計算して最新粗利率で判定（画面上の調整と一致させる）
  const { data: items } = await supabase
    .from("estimate_items")
    .select("selling_amount, cost_amount")
    .eq("estimate_id", estimateId);
  const { calcGrossProfitRatePercent } = await import("@/lib/estimate-margin");
  const liveRate = calcGrossProfitRatePercent(items ?? []);
  const rate = liveRate > 0 ? liveRate : (estimate.gross_profit_rate ?? 0);

  const threshold = toMarginThresholdPercent(estimate.default_gross_profit_rate);
  if (rate < threshold) {
    throw new Error(`粗利率が基準(${threshold.toFixed(0)}%)未満のため、上長承認が必要です`);
  }

  const { error: updErr } = await supabase.from("estimates").update({
    status: "issued",
    approval_status: "approved",
    gross_profit_rate: rate,
    updated_at: new Date().toISOString(),
  }).eq("id", estimateId);
  if (updErr) throw updErr;

  return { status: "issued" as const };
}

// ---------------------------------------------------------------------------
// 1-3 録音完了 → 要約・ToDo・ステージ提案
// ---------------------------------------------------------------------------

export async function processRecordingComplete(input: {
  customerId: string;
  recordingId: string;
  dealId?: string;
  transcript: string;
  memo?: string;
}) {
  const { supabase, company_id, user_id } = await getCompanyContext();
  const aiConfig = await resolveLinqAiConfig();

  const summaryResult = await summarizeMeetingRecording({
    customerId: input.customerId,
    dealId: input.dealId,
    transcript: input.transcript,
    memo: input.memo,
  }, aiConfig);

  await supabase.from("customer_recordings").update({
    summary: summaryResult.summary,
    title: summaryResult.title,
    updated_at: new Date().toISOString(),
  }).eq("id", input.recordingId);

  const customerPatch: Record<string, string | number> = {};
  for (const update of summaryResult.customerUpdates) {
    if (update.field === "budget_min" || update.field === "budget_max") {
      const n = Number(update.value.replace(/[^\d]/g, ""));
      if (!Number.isNaN(n) && n > 0) customerPatch[update.field] = n;
    } else if (update.field === "phone" || update.field === "email" || update.field === "address") {
      customerPatch[update.field] = update.value;
    } else if (update.field === "notes") {
      customerPatch.notes = update.value;
    }
  }
  if (Object.keys(customerPatch).length > 0) {
    await supabase.from("customers").update({
      ...customerPatch,
      updated_at: new Date().toISOString(),
    }).eq("id", input.customerId);
  }

  // 商談が未紐付けなら自動作成・紐付け（No.15）
  let dealId = input.dealId ?? null;
  if (!dealId) {
    const { data: existingDeal } = await supabase
      .from("deals")
      .select("id")
      .eq("customer_id", input.customerId)
      .in("stage", ["inquiry", "first_meeting", "materials_sent", "quote_submitted", "negotiation", "closing"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingDeal) {
      dealId = existingDeal.id;
    } else {
      const { data: customer } = await supabase
        .from("customers")
        .select("name, assigned_to")
        .eq("id", input.customerId)
        .single();
      const { data: newDeal } = await supabase.from("deals").insert({
        company_id,
        customer_id: input.customerId,
        title: summaryResult.title || `${customer?.name ?? "顧客"} 様 商談`,
        stage: "first_meeting",
        summary: summaryResult.summary,
        assigned_to: customer?.assigned_to ?? user_id,
      }).select("id").single();
      dealId = newDeal?.id ?? null;
    }

    if (dealId) {
      await supabase.from("customer_recordings").update({
        deal_id: dealId,
        updated_at: new Date().toISOString(),
      }).eq("id", input.recordingId);
    }
  }

  if (dealId && summaryResult.summary) {
    await supabase.from("deals").update({
      summary: summaryResult.summary,
      updated_at: new Date().toISOString(),
    }).eq("id", dealId);
  }

  for (const todo of summaryResult.todos) {
    await supabase.from("todos").insert({
      company_id,
      customer_id: input.customerId,
      deal_id: dealId,
      assigned_to: user_id,
      title: todo.title,
      due_date: todo.dueDate ?? null,
      priority: todo.priority,
      status: "pending",
      source: "linq_recording",
      tags: todo.priority === "high" ? ["urgent", "sales_flow"] : ["sales_flow"],
    });
  }

  let calendarEventId: string | null = null;
  const nextMeetingTodo = summaryResult.todos.find(
    (t) => t.dueDate && /次回|再来|商談|面談|フォロー/.test(t.title),
  );
  if (nextMeetingTodo?.dueDate) {
    const startAt = new Date(`${nextMeetingTodo.dueDate}T10:00:00`);
    const endAt = new Date(startAt.getTime() + 60 * 60_000);
    const { data: calEvent } = await supabase.from("calendar_events").insert({
      company_id,
      title: `次回商談: ${summaryResult.title}`,
      description: summaryResult.summary,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      customer_id: input.customerId,
      assigned_to: user_id,
      created_by: user_id,
      category: "meeting",
    }).select("id").single();
    calendarEventId = calEvent?.id ?? null;
  }

  let stageProposalId: string | null = null;
  if (dealId) {
    const { data: deal } = await supabase.from("deals").select("stage").eq("id", dealId).single();
    if (deal) {
      const proposal = await proposeStageTransition(deal.stage, summaryResult.summary, aiConfig);
      if (proposal.proposedStage !== deal.stage) {
        const { data: inserted } = await supabase.from("deal_stage_proposals").insert({
          company_id,
          deal_id: dealId,
          customer_id: input.customerId,
          recording_id: input.recordingId,
          current_stage: deal.stage,
          proposed_stage: proposal.proposedStage,
          reason: proposal.reason,
          confidence: proposal.confidence,
          status: "pending",
        }).select("id").single();
        stageProposalId = inserted?.id ?? null;

        await notifyUser(supabase, company_id, user_id, {
          title: `ステージ変更提案: ${proposal.currentStage} → ${proposal.proposedStage}`,
          description: proposal.reason,
          href: `/crm/${input.customerId}?tab=deals`,
          customerId: input.customerId,
          dealId,
          urgent: proposal.confidence >= 0.7,
        }, user_id);
      }
    }
  }

  if (dealId) {
    await supabase.from("deal_activities").insert({
      company_id,
      deal_id: dealId,
      type: "meeting",
      title: summaryResult.title,
      description: summaryResult.summary,
      performed_by: user_id,
      performed_at: new Date().toISOString(),
    });
  }

  return {
    summary: summaryResult.summary,
    title: summaryResult.title,
    todosCreated: summaryResult.todos.length,
    stageProposalId,
    calendarEventId,
    customerFieldsUpdated: Object.keys(customerPatch).length,
    dealId,
    source: summaryResult.source,
  };
}

export async function sendRecordingSummaryEmail(input: {
  customerId: string;
  recordingId: string;
}) {
  const { supabase, company_id, user_id } = await getCompanyContext();

  const { data: customer } = await supabase
    .from("customers")
    .select("name, email, company_name")
    .eq("id", input.customerId)
    .single();
  if (!customer?.email?.trim()) {
    throw new Error("顧客のメールアドレスが登録されていません");
  }

  const { data: recording } = await supabase
    .from("customer_recordings")
    .select("title, summary, recorded_at")
    .eq("id", input.recordingId)
    .eq("customer_id", input.customerId)
    .single();
  if (!recording?.summary?.trim()) {
    throw new Error("要約がまだ生成されていません。先に保存してください");
  }

  const [{ data: company }, { data: sender }] = await Promise.all([
    supabase.from("companies").select("name").eq("id", company_id).single(),
    supabase.from("profiles").select("display_name").eq("id", user_id).single(),
  ]);

  const customerName = customer.company_name?.trim() || customer.name;
  const companyName = company?.name ?? "BRIDGE";
  const senderName = sender?.display_name ?? companyName;
  const recordedAt = new Date(recording.recorded_at).toLocaleString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const { getResend, CUSTOMER_FROM_EMAIL, buildRecordingSummaryEmailHtml } = await import("@/lib/resend");
  const html = buildRecordingSummaryEmailHtml({
    customerName,
    companyName,
    senderName,
    title: recording.title,
    summary: recording.summary,
    recordedAt,
  });
  const text = [
    `${customerName} 様`,
    "",
    "先日はお時間をいただき、誠にありがとうございました。",
    "商談内容を整理いたしましたので、ご確認ください。",
    "",
    `■ ${recording.title}`,
    recordedAt,
    "",
    recording.summary,
    "",
    "ご不明な点がございましたら、お気軽にお問い合わせください。",
    "引き続きよろしくお願いいたします。",
    "",
    companyName,
    senderName,
  ].join("\n");

  const { error: mailError } = await getResend().emails.send({
    from: CUSTOMER_FROM_EMAIL,
    to: customer.email.trim(),
    subject: `【${companyName}】商談内容のご共有`,
    html,
    text,
  });
  if (mailError) {
    throw new Error(`メール送信に失敗しました: ${mailError.message}`);
  }

  return { sentTo: customer.email.trim() };
}

// ---------------------------------------------------------------------------
// 1-2 問い合わせ: AI担当者提案 / 1-4 見積AIドラフト
// ---------------------------------------------------------------------------

export async function suggestLeadAssignee(inquiryContent?: string) {
  const { supabase, company_id } = await getCompanyContext();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("company_id", company_id);

  const { data: dealCounts } = await supabase
    .from("deals")
    .select("assigned_to")
    .eq("company_id", company_id)
    .in("stage", ["inquiry", "first_meeting", "materials_sent", "quote_submitted", "negotiation", "closing"]);

  const loadMap = new Map<string, number>();
  for (const d of dealCounts ?? []) {
    if (d.assigned_to) loadMap.set(d.assigned_to, (loadMap.get(d.assigned_to) ?? 0) + 1);
  }

  const { assignLeadToSalesperson, resolveLinqAiConfig } = await import("@/lib/integrations/linq-ai");
  return assignLeadToSalesperson(
    (profiles ?? []).map((p) => ({
      id: p.id,
      displayName: p.display_name,
      role: p.role,
      activeDeals: loadMap.get(p.id) ?? 0,
    })),
    inquiryContent ?? "",
    await resolveLinqAiConfig(),
  );
}

export async function generateEstimateDraftForCustomer(customerId: string) {
  const { supabase } = await getCompanyContext();
  const { data: customer } = await supabase
    .from("customers")
    .select("name, inquiry_content")
    .eq("id", customerId)
    .single();
  if (!customer) throw new Error("顧客が見つかりません");

  const { data: recordings } = await supabase
    .from("customer_recordings")
    .select("transcript, summary, memo")
    .eq("customer_id", customerId)
    .order("recorded_at", { ascending: false })
    .limit(5);

  const texts = (recordings ?? []).flatMap((r) => [r.summary, r.transcript, r.memo].filter(Boolean) as string[]);

  const { generateEstimateDraft, resolveLinqAiConfig } = await import("@/lib/integrations/linq-ai");
  return generateEstimateDraft(
    {
      customerName: customer.name,
      recordings: texts,
      inquiryContent: customer.inquiry_content ?? undefined,
    },
    await resolveLinqAiConfig(),
  );
}

export async function importInboundLead(input: {
  name: string;
  email?: string;
  phone?: string;
  source?: string;
  inquiry_content?: string;
  inquiry_category?: string;
}) {
  const { supabase, company_id, user_id } = await getCompanyContext();
  const assign = await suggestLeadAssignee(input.inquiry_content);

  const { findExistingCustomer } = await import("@/lib/actions/customers");
  const existing = await findExistingCustomer(supabase, company_id, {
    email: input.email,
    phone: input.phone,
    name: input.name,
  });

  let customerId: string;
  let linkedExisting = false;

  if (existing) {
    linkedExisting = true;
    customerId = existing.id;
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      assigned_to: assign.recommendedId ?? existing.assigned_to,
    };
    if (input.inquiry_content?.trim()) {
      const prev = existing.inquiry_content ? `${existing.inquiry_content}\n\n---\n` : "";
      patch.inquiry_content = `${prev}${input.inquiry_content.trim()}`;
    }
    if (input.inquiry_category) patch.inquiry_category = input.inquiry_category;
    patch.inquiry_date = new Date().toISOString().slice(0, 10);
    if (input.source) patch.source = input.source;
    if (input.email && !existing.email) patch.email = input.email;
    if (input.phone && !existing.phone) patch.phone = input.phone;
    await supabase.from("customers").update(patch).eq("id", existing.id);
  } else {
    const { data: customer, error: custErr } = await supabase.from("customers").insert({
      company_id,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      source: input.source ?? "web_form",
      inquiry_content: input.inquiry_content ?? null,
      inquiry_category: input.inquiry_category ?? null,
      inquiry_date: new Date().toISOString().slice(0, 10),
      assigned_to: assign.recommendedId,
      status: "active",
    }).select().single();
    if (custErr) throw custErr;
    customerId = customer.id;
  }

  const { data: deal, error: dealErr } = await supabase.from("deals").insert({
    company_id,
    customer_id: customerId,
    title: `${input.name} 様 問い合わせ`,
    stage: "inquiry",
    assigned_to: assign.recommendedId,
  }).select().single();
  if (dealErr) throw dealErr;

  if (assign.recommendedId) {
    await notifyUser(supabase, company_id, assign.recommendedId, {
      title: linkedExisting
        ? `既存顧客への問い合わせ: ${input.name}`
        : `新規問い合わせ: ${input.name}`,
      description: input.inquiry_content?.slice(0, 200) ?? "問い合わせが自動登録されました",
      href: `/crm/${customerId}`,
      customerId,
      dealId: deal.id,
      urgent: true,
    }, user_id);
  }

  if (!linkedExisting) {
    void dispatchWebhook(company_id, "customer.created", {
      customer_id: customerId,
      deal_id: deal.id,
      source: input.source ?? "web_form",
    });
  } else {
    void dispatchWebhook(company_id, "customer.updated", {
      customer_id: customerId,
      deal_id: deal.id,
      linked_from_inquiry: true,
      source: input.source ?? "web_form",
    });
  }
  void dispatchWebhook(company_id, "deal.created", {
    id: deal.id,
    customer_id: customerId,
    title: deal.title,
  });

  return {
    customerId,
    dealId: deal.id,
    assigneeId: assign.recommendedId,
    linkedExisting,
  };
}

export type StageProposal = {
  id: string;
  deal_id: string;
  customer_id: string;
  current_stage: string;
  proposed_stage: string;
  reason: string | null;
  confidence: number | null;
  status: string;
  created_at: string;
  deal?: { title: string } | null;
};

export async function getPendingStageProposals(): Promise<StageProposal[]> {
  const { supabase, company_id, user_id } = await getCompanyContext();
  const { data } = await supabase
    .from("deal_stage_proposals")
    .select("*, deal:deals(title)")
    .eq("company_id", company_id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(20);

  const deals = await supabase.from("deals").select("id").eq("company_id", company_id).eq("assigned_to", user_id);
  const myDealIds = new Set((deals.data ?? []).map((d) => d.id));

  return ((data ?? []) as StageProposal[]).filter((p) => myDealIds.has(p.deal_id));
}

export async function reviewStageProposal(
  proposalId: string,
  action: "approve" | "reject" | "modify",
  modifiedStage?: string,
) {
  const { supabase, company_id, user_id } = await getCompanyContext();

  const { data: proposal } = await supabase
    .from("deal_stage_proposals")
    .select("*")
    .eq("id", proposalId)
    .single();
  if (!proposal) throw new Error("提案が見つかりません");

  const finalStage = action === "modify" && modifiedStage
    ? modifiedStage
    : action === "approve"
      ? proposal.proposed_stage
      : proposal.current_stage;

  await supabase.from("deal_stage_proposals").update({
    status: action === "reject" ? "rejected" : action === "modify" ? "modified" : "approved",
    reviewed_by: user_id,
    reviewed_at: new Date().toISOString(),
    final_stage: action === "reject" ? null : finalStage,
  }).eq("id", proposalId);

  if (action !== "reject") {
    await supabase.from("deals").update({ stage: finalStage }).eq("id", proposal.deal_id);
    void dispatchWebhook(company_id, "deal.stage_changed", {
      id: proposal.deal_id,
      previous_stage: proposal.current_stage,
      stage: finalStage,
      source: "stage_proposal",
    });
  }

  return { finalStage: action === "reject" ? null : finalStage };
}
