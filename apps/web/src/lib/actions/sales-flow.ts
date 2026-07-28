"use server";

import { createClient } from "@/lib/supabase/server";
import { dispatchWebhook } from "@/lib/webhooks";
import {
  proposeStageTransition,
  recommendFieldAssignee,
  summarizeMeetingRecording,
  sanitizeMeetingTitle,
  estimateConstructionDuration,
  resolveLinqAiConfig,
} from "@/lib/integrations/linq-ai";
import { createWorkflowRequest } from "@/lib/actions/workflow";
import { toMarginThresholdPercent } from "@/lib/estimate-margin";
import { isWorkflowRemanded } from "@/lib/status-config";

async function getCompanyContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id, role").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");
  return { supabase, company_id: profile.company_id, user_id: user.id, role: profile.role };
}

/**
 * 会社指定の予備費率（%）を取得。BI期首設定(bi_annual_settings)の最新年度の
 * reserve_fee_rate（0〜1）をパーセントに変換して返す。未設定なら 0。
 * 見積・実行予算の承認判定では「会社指定粗利＋予備費」を満たす必要がある。
 */
async function getCompanyReservePercent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
): Promise<number> {
  const { data } = await supabase
    .from("bi_annual_settings")
    .select("reserve_fee_rate")
    .eq("company_id", companyId)
    .order("fiscal_year", { ascending: false })
    .limit(1)
    .maybeSingle();
  const rate = Number(data?.reserve_fee_rate ?? 0);
  return rate > 0 ? rate * 100 : 0;
}

/**
 * 会社指定粗利率（%）を取得。BI期首設定(bi_annual_settings)の最新年度の
 * base_gross_profit_rate（0〜1 または %）をパーセントに変換して返す。
 * 未設定（行なし/0以下）なら null を返し、呼び出し側で個別のフォールバックを使う。
 */
async function getCompanyBaseMarginPercent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
): Promise<number | null> {
  const { data } = await supabase
    .from("bi_annual_settings")
    .select("base_gross_profit_rate")
    .eq("company_id", companyId)
    .order("fiscal_year", { ascending: false })
    .limit(1)
    .maybeSingle();
  const raw = Number(data?.base_gross_profit_rate ?? NaN);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return raw > 1 ? raw : raw * 100;
}

/** 3経路通知（他モジュールからも利用） */
export type SalesFlowNotifyInput = {
  title: string;
  description?: string;
  href?: string;
  customerId?: string;
  dealId?: string;
  urgent?: boolean;
  /** true のとき ToDo は作らずお知らせのみ（既存 ToDo の通知用） */
  skipTodo?: boolean;
  /** ToDo tags に追加（例: construction） */
  extraTags?: string[];
};

export type SalesFlowNotifyResult = {
  todoCreated: boolean;
  announcementCreated: boolean;
};

/**
 * 営業フロー3経路通知（バナー / お知らせ / ToDoフラグ）。
 * 失敗時は握りつぶさず結果を返し、呼び出し側で検知できるようにする。
 */
export async function notifySalesFlowUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  userId: string,
  input: SalesFlowNotifyInput,
  fromUserId?: string,
): Promise<SalesFlowNotifyResult> {
  return notifyUser(supabase, companyId, userId, input, fromUserId);
}

async function notifyUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  userId: string,
  input: SalesFlowNotifyInput,
  fromUserId?: string,
): Promise<SalesFlowNotifyResult> {
  const { tokyoDateString } = await import("@/lib/tokyo-date");
  const today = tokyoDateString();
  const result: SalesFlowNotifyResult = { todoCreated: false, announcementCreated: false };

  const detailLine = input.href ? `詳細: ${input.href}` : null;
  const description = [input.description, detailLine].filter(Boolean).join("\n\n") || null;
  const body = description || input.title;
  const tags = [
    ...(input.urgent ? ["urgent", "sales_flow", "notify_flag"] : ["sales_flow"]),
    ...(input.extraTags ?? []),
  ];

  if (!input.skipTodo) {
    const todoBase = {
      company_id: companyId,
      assigned_to: userId,
      title: input.title,
      description,
      status: "pending" as const,
      priority: input.urgent ? "high" : "medium",
      due_date: input.urgent ? today : null,
      tags,
      source: "sales_flow",
    };

    // customer_id / deal_id の FK 失敗で ToDo 全体が落ちないよう段階リトライ（No.18）
    const todoAttempts: Array<{ customer_id: string | null; deal_id: string | null }> = [
      { customer_id: input.customerId ?? null, deal_id: input.dealId ?? null },
      { customer_id: input.customerId ?? null, deal_id: null },
      { customer_id: null, deal_id: null },
    ];
    let lastTodoErr: { message?: string } | null = null;
    for (const attempt of todoAttempts) {
      const { error: todoErr } = await supabase.from("todos").insert({ ...todoBase, ...attempt });
      if (!todoErr) {
        result.todoCreated = true;
        lastTodoErr = null;
        break;
      }
      lastTodoErr = todoErr;
    }
    if (lastTodoErr) {
      console.error("[notifyUser] todo insert failed", lastTodoErr);
    }
  } else {
    result.todoCreated = true;
  }

  const authorId = fromUserId ?? userId;
  const annFull = {
    company_id: companyId,
    author_id: authorId,
    title: input.title,
    body,
    is_urgent: input.urgent ?? false,
    target_type: "individuals" as const,
    target_user_ids: [userId],
    published_at: new Date().toISOString(),
  };
  const { error: annErr } = await supabase.from("announcements").insert(annFull);
  if (!annErr) {
    result.announcementCreated = true;
  } else {
    // target_user_ids 未マイグレーション環境向けフォールバック
    const { target_user_ids: _ids, ...annBasic } = annFull;
    const { error: annRetryErr } = await supabase.from("announcements").insert({
      ...annBasic,
      target_type: "all",
      body: `${body}\n\n（宛先: 担当者通知）`,
    });
    if (!annRetryErr) {
      result.announcementCreated = true;
    } else {
      console.error("[notifyUser] announcement insert failed", annErr, annRetryErr);
    }
  }

  void dispatchWebhook(companyId, "sales_flow.notification", {
    user_id: userId,
    title: input.title,
    href: input.href,
    urgent: input.urgent ?? false,
    todo_created: result.todoCreated,
    announcement_created: result.announcementCreated,
  });

  if (!result.todoCreated && !result.announcementCreated) {
    throw new Error("担当者への通知（バナー・お知らせ・ToDo）の作成に失敗しました");
  }

  return result;
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

  // AI 提案は遷移をブロックしない（契約作成後すぐ返す）。工期は裏で契約へ反映。
  const customerAddress = (deal.customer as { address?: string })?.address;
  void (async () => {
    try {
      const aiConfig = await resolveLinqAiConfig();
      const [duration, profilesRes, activeRes] = await Promise.all([
        estimateConstructionDuration("", Number(amount), aiConfig),
        supabase
          .from("profiles")
          .select("id, display_name, department")
          .eq("company_id", company_id)
          .in("role", ["field_manager", "employee", "sales", "admin"]),
        supabase
          .from("constructions")
          .select("assigned_to")
          .in("status", ["preparing", "in_progress"])
          .not("assigned_to", "is", null),
      ]);

      if (duration.startDate && duration.endDate) {
        await supabase.from("contracts").update({
          start_date: duration.startDate,
          end_date: duration.endDate,
          updated_at: new Date().toISOString(),
        }).eq("id", contract.id);
      }

      const countByAssignee = new Map<string, number>();
      for (const c of activeRes.data ?? []) {
        if (!c.assigned_to) continue;
        countByAssignee.set(c.assigned_to, (countByAssignee.get(c.assigned_to) ?? 0) + 1);
      }
      await recommendFieldAssignee(
        (profilesRes.data ?? []).map((p) => ({
          id: p.id,
          displayName: p.display_name,
          activeConstructions: countByAssignee.get(p.id) ?? 0,
          department: p.department ?? undefined,
        })),
        { customerAddress },
        aiConfig,
      );
    } catch {
      // AI 失敗でも契約作成・遷移は成功扱い
    }
  })();

  const params = new URLSearchParams({
    deal_id: dealId,
    contract_id: contract.id,
    customer_id: deal.customer_id,
    title,
    order_amount: String(amount),
  });
  if (latestEstimate?.id) params.set("estimate_id", latestEstimate.id);

  return {
    contractId: contract.id,
    contractNo,
    dealId,
    customerId: deal.customer_id,
    estimateId: latestEstimate?.id ?? null,
    redirectUrl: `/constructions/new?${params.toString()}`,
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
  const { actionOk, actionFail } = await import("@/lib/action-result");
  try {
    const { supabase, company_id, user_id } = await getCompanyContext();

    const { data: estimate, error } = await supabase
      .from("estimates")
      .select("*, customer:customers(name, company_name)")
      .eq("id", input.estimateId)
      .single();
    if (error || !estimate) {
      return actionFail(error, "見積が見つかりません");
    }

    try {
      assertReserveFeesSecured(estimate);
    } catch (e) {
      return actionFail(e, "予備費を計上してから申請してください");
    }

    const baseThreshold = (await getCompanyBaseMarginPercent(supabase, company_id))
      ?? toMarginThresholdPercent(estimate.default_gross_profit_rate);
    const reservePercent = await getCompanyReservePercent(supabase, company_id);
    // 会社指定粗利＋予備費を満たす必要がある
    const threshold = baseThreshold + reservePercent;
    if ((estimate.gross_profit_rate ?? 0) >= threshold) {
      return actionFail(
        `粗利率が基準(${threshold.toFixed(0)}%=会社指定${baseThreshold.toFixed(0)}%+予備費${reservePercent.toFixed(0)}%)以上のため承認申請は不要です`,
        "承認申請は不要です",
      );
    }

    let { data: wfType } = await supabase
      .from("workflow_types")
      .select("id, approval_route")
      .eq("company_id", company_id)
      .eq("key", "estimate_margin")
      .maybeSingle();

    // 未設定の場合は自動作成する（既存会社向けフォールバック）
    if (!wfType) {
      const { data: created, error: createTypeErr } = await supabase
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
      if (!created) {
        return actionFail(createTypeErr, "見積承認ワークフロー種別の自動作成に失敗しました");
      }
      wfType = created;
    }

    const approvalRoute = (wfType.approval_route ?? []) as Array<{ approver_id: string; step_order?: number }>;
    // ルート未設定時はダイアログで選んだ承認者を使う
    const routeIds = approvalRoute.length > 0
      ? approvalRoute
        .sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0))
        .map((s) => s.approver_id)
        .filter(Boolean)
      : [];
    const approverIds = routeIds.length > 0
      ? routeIds
      : [input.approverId].filter(Boolean);
    if (approverIds.length === 0) {
      return actionFail(
        "承認者が設定されていません。承認者を選択するか、設定 › ワークフローでルートを登録してください",
        "承認者が設定されていません",
      );
    }

    const customerLabel = (estimate.customer as { company_name?: string; name?: string })?.company_name
      ?? (estimate.customer as { name?: string })?.name
      ?? "";

    const uniqueApproverIds = [...new Set(approverIds.filter(Boolean))];
    const created = await createWorkflowRequest({
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
      approver_ids: uniqueApproverIds,
    });
    if (!created.ok) {
      return actionFail(created.error, "見積承認ワークフローの作成に失敗しました");
    }
    const request = { id: created.id };

    const { error: commentErr } = await supabase.from("workflow_comments").insert({
      company_id,
      request_id: request.id,
      user_id,
      message: input.comment,
    });
    if (commentErr) {
      console.error("[submitEstimateApproval] comment insert failed", commentErr);
    }

    const { error: estErr } = await supabase.from("estimates").update({
      approval_status: "pending",
      workflow_request_id: request.id,
      updated_at: new Date().toISOString(),
    }).eq("id", input.estimateId);
    if (estErr) {
      return actionFail(estErr, "見積の承認状態更新に失敗しました");
    }

    for (const approverId of uniqueApproverIds.slice(0, 1)) {
      try {
        await notifyUser(supabase, company_id, approverId, {
          title: `見積承認依頼: ${estimate.estimate_no}`,
          description: input.comment,
          href: `/workflow/${request.id}`,
          customerId: estimate.customer_id ?? undefined,
          urgent: true,
        }, user_id);
      } catch (e) {
        console.error("[submitEstimateApproval] notify failed", e);
      }
    }

    void dispatchWebhook(company_id, "estimate.approval_requested", {
      estimate_id: input.estimateId,
      workflow_request_id: request.id,
      gross_profit_rate: estimate.gross_profit_rate,
    });

    return actionOk({ workflowRequestId: request.id });
  } catch (e) {
    console.error("[submitEstimateApproval] unexpected", e);
    return actionFail(e, "承認申請に失敗しました");
  }
}

export async function getEstimateMarginThreshold(estimateId: string) {
  let supabase: Awaited<ReturnType<typeof getCompanyContext>>["supabase"];
  let company_id: string;
  try {
    ({ supabase, company_id } = await getCompanyContext());
  } catch (e) {
    console.error("[getEstimateMarginThreshold] auth", e);
    return null;
  }
  const { data } = await supabase
    .from("estimates")
    .select("gross_profit_rate, default_gross_profit_rate, approval_status, workflow_request_id, status")
    .eq("id", estimateId)
    .single();
  if (!data) return null;
  const baseThreshold = (await getCompanyBaseMarginPercent(supabase, company_id))
    ?? toMarginThresholdPercent(data.default_gross_profit_rate);
  const reservePercent = await getCompanyReservePercent(supabase, company_id);
  // 会社指定粗利＋予備費を満たす必要がある
  const threshold = baseThreshold + reservePercent;

  // 差戻し/却下済みWFに紐づいたまま pending が残っている場合は補正（再申請ボタンが出ない不具合の自己修復）
  let approvalStatus = (data.approval_status ?? "none") as string;
  let remandComment: string | null = null;
  const workflowRequestId = data.workflow_request_id as string | null;
  if (workflowRequestId && (approvalStatus === "pending" || approvalStatus === "returned" || approvalStatus === "rejected")) {
    const { data: wf } = await supabase
      .from("workflow_requests")
      .select("status, payload")
      .eq("id", workflowRequestId)
      .single();
    const payload = (wf?.payload ?? {}) as Record<string, unknown>;
    const isRemand = isWorkflowRemanded(wf?.status ?? "", payload);
    if (typeof payload.remand_comment === "string" && payload.remand_comment.trim()) {
      remandComment = payload.remand_comment.trim();
    } else if (typeof payload.reject_comment === "string" && payload.reject_comment.trim()) {
      remandComment = payload.reject_comment.trim();
    }
    if (wf?.status === "rejected") {
      const expected = isRemand ? "returned" : "rejected";
      // pending 残留、または差戻し/却下の取り違えを自己修復
      if (approvalStatus !== expected) {
        approvalStatus = expected;
        await supabase.from("estimates").update({
          approval_status: expected,
          updated_at: new Date().toISOString(),
        }).eq("id", estimateId);
      }
    }
    if (wf?.status === "rejected" && !remandComment) {
      const { data: step } = await supabase
        .from("workflow_steps")
        .select("comment")
        .eq("request_id", workflowRequestId)
        .eq("status", "rejected")
        .order("decided_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (step?.comment?.trim()) remandComment = step.comment.trim();
    }
  }

  return {
    grossProfitRate: data.gross_profit_rate ?? 0,
    threshold,
    baseThreshold,
    reservePercent,
    needsApproval: (data.gross_profit_rate ?? 0) < threshold,
    approvalStatus,
    workflowRequestId,
    status: data.status as string | null,
    remandComment,
  };
}

/** 粗利率が基準以上の見積を確定（発行済み）にする（No.38） */
/** 予備費未計上での確定・提出を防ぐ（議事録: 予備費確保文化） */
function assertReserveFeesSecured(estimate: {
  reserve_fee_1_amount?: number | null;
  reserve_fee_2_amount?: number | null;
}) {
  const r1 = Number(estimate.reserve_fee_1_amount ?? 0);
  const r2 = Number(estimate.reserve_fee_2_amount ?? 0);
  if (r1 <= 0 || r2 <= 0) {
    throw new Error(
      "予備費・予備予備費をサマリー欄に計上してから確定・提出してください（未計上のまま提出できません）",
    );
  }
}

export async function confirmEstimateIssued(estimateId: string) {
  const { actionOk, actionFail } = await import("@/lib/action-result");
  try {
    const { supabase, company_id } = await getCompanyContext();
    const { data: estimate, error } = await supabase
      .from("estimates")
      .select("gross_profit_rate, default_gross_profit_rate, status, reserve_fee_1_amount, reserve_fee_2_amount")
      .eq("id", estimateId)
      .single();
    if (error || !estimate) return actionFail(error, "見積が見つかりません");

    try {
      assertReserveFeesSecured(estimate);
    } catch (e) {
      return actionFail(e, "予備費を計上してから確定してください");
    }

    // 明細から再計算して最新粗利率で判定（画面上の調整と一致させる）
    const { data: items } = await supabase
      .from("estimate_items")
      .select("selling_amount, cost_amount")
      .eq("estimate_id", estimateId);
    const { calcGrossProfitRatePercent } = await import("@/lib/estimate-margin");
    const liveRate = calcGrossProfitRatePercent(items ?? []);
    const rate = liveRate > 0 ? liveRate : (estimate.gross_profit_rate ?? 0);

    const baseThreshold = (await getCompanyBaseMarginPercent(supabase, company_id))
      ?? toMarginThresholdPercent(estimate.default_gross_profit_rate);
    const reservePercent = await getCompanyReservePercent(supabase, company_id);
    const threshold = baseThreshold + reservePercent;
    if (rate < threshold) {
      return actionFail(
        `粗利率が基準(${threshold.toFixed(0)}%=会社指定${baseThreshold.toFixed(0)}%+予備費${reservePercent.toFixed(0)}%)未満のため、上長承認が必要です`,
        "上長承認が必要です",
      );
    }

    const { error: updErr } = await supabase.from("estimates").update({
      status: "issued",
      approval_status: "approved",
      gross_profit_rate: rate,
      updated_at: new Date().toISOString(),
    }).eq("id", estimateId);
    if (updErr) return actionFail(updErr, "見積の確定に失敗しました");

    return actionOk({ status: "issued" as const });
  } catch (e) {
    console.error("[confirmEstimateIssued] unexpected", e);
    return actionFail(e, "見積の確定に失敗しました");
  }
}

// ---------------------------------------------------------------------------
// 実行予算（工事台帳）粗利未達 → 上長承認
// ---------------------------------------------------------------------------

/**
 * 工事の会社指定粗利率（%）を取得。優先順位:
 * ① BI設定の会社指定粗利率 → ② 紐づく見積の基準率 → ③ 既定50%
 */
async function getConstructionBaseThreshold(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  constructionId: string,
): Promise<number> {
  const companyBase = await getCompanyBaseMarginPercent(supabase, companyId);
  if (companyBase != null) return companyBase;
  const { data: est } = await supabase
    .from("estimates")
    .select("default_gross_profit_rate")
    .eq("construction_id", constructionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return toMarginThresholdPercent(est?.default_gross_profit_rate);
}

export async function getConstructionMarginThreshold(constructionId: string) {
  const { supabase, company_id } = await getCompanyContext();
  const baseThreshold = await getConstructionBaseThreshold(supabase, company_id, constructionId);
  const reservePercent = await getCompanyReservePercent(supabase, company_id);
  const threshold = baseThreshold + reservePercent;

  const { data: budget } = await supabase
    .from("construction_cost_budgets")
    .select("approval_status, workflow_request_id")
    .eq("construction_id", constructionId)
    .maybeSingle();

  return {
    baseThreshold,
    reservePercent,
    threshold,
    approvalStatus: (budget?.approval_status ?? "none") as string,
    workflowRequestId: (budget?.workflow_request_id ?? null) as string | null,
  };
}

export async function submitBudgetApproval(input: {
  constructionId: string;
  comment: string;
  approverId: string;
  /** 画面で計算した工事粗利率（暫定, %） */
  grossProfitRate: number;
}) {
  const { actionOk, actionFail } = await import("@/lib/action-result");
  try {
    const { supabase, company_id, user_id } = await getCompanyContext();

    const baseThreshold = await getConstructionBaseThreshold(supabase, company_id, input.constructionId);
    const reservePercent = await getCompanyReservePercent(supabase, company_id);
    const threshold = baseThreshold + reservePercent;
    if (input.grossProfitRate >= threshold) {
      return actionFail(
        `工事粗利率が基準(${threshold.toFixed(0)}%=会社指定${baseThreshold.toFixed(0)}%+予備費${reservePercent.toFixed(0)}%)以上のため承認申請は不要です`,
        "承認申請は不要です",
      );
    }

    const { data: construction } = await supabase
      .from("constructions")
      .select("title, construction_no, customer_id")
      .eq("id", input.constructionId)
      .maybeSingle();

    let { data: wfType } = await supabase
      .from("workflow_types")
      .select("id, approval_route")
      .eq("company_id", company_id)
      .eq("key", "budget_margin")
      .maybeSingle();

    if (!wfType) {
      const { data: created, error: createTypeErr } = await supabase
        .from("workflow_types")
        .insert({
          company_id,
          key: "budget_margin",
          name: "規定粗利未達 実行予算承認",
          description: "実行予算で会社指定粗利＋予備費に達しない場合の上長承認",
          fields_schema: [],
          approval_route: [],
          sort_order: 0,
        })
        .select("id, approval_route")
        .single();
      if (!created) return actionFail(createTypeErr, "実行予算承認ワークフロー種別の自動作成に失敗しました");
      wfType = created;
    }

    const approvalRoute = (wfType.approval_route ?? []) as Array<{ approver_id: string; step_order?: number }>;
    const approverIds = approvalRoute.length > 0
      ? approvalRoute.sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0)).map((s) => s.approver_id)
      : [input.approverId];

    const created = await createWorkflowRequest({
      type_id: wfType.id,
      title: `実行予算承認: ${construction?.construction_no ?? ""} ${construction?.title ?? ""}（工事粗利率 ${input.grossProfitRate.toFixed(1)}%）`,
      is_urgent: true,
      payload: {
        construction_id: input.constructionId,
        gross_profit_rate: input.grossProfitRate,
        base_threshold: baseThreshold,
        reserve_percent: reservePercent,
        application_comment: input.comment,
      },
      approver_ids: [...new Set(approverIds.filter(Boolean))],
    });
    if (!created.ok) {
      return actionFail(created.error, "実行予算承認ワークフローの作成に失敗しました");
    }
    const request = { id: created.id };

    await supabase.from("workflow_comments").insert({
      company_id,
      request_id: request.id,
      user_id,
      message: input.comment,
    });

    await supabase.from("construction_cost_budgets").upsert({
      company_id,
      construction_id: input.constructionId,
      approval_status: "pending",
      workflow_request_id: request.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "construction_id" });

    for (const approverId of [...new Set(approverIds.filter(Boolean))].slice(0, 1)) {
      try {
        await notifyUser(supabase, company_id, approverId, {
          title: `実行予算承認依頼: ${construction?.construction_no ?? ""}`,
          description: input.comment,
          href: `/workflow/${request.id}`,
          customerId: construction?.customer_id ?? undefined,
          urgent: true,
        }, user_id);
      } catch (e) {
        console.error("[submitBudgetMarginApproval] notify failed", e);
      }
    }

    void dispatchWebhook(company_id, "budget.approval_requested", {
      construction_id: input.constructionId,
      workflow_request_id: request.id,
      gross_profit_rate: input.grossProfitRate,
    });

    return actionOk({ workflowRequestId: request.id });
  } catch (e) {
    console.error("[submitBudgetApproval] unexpected", e);
    return actionFail(e, "実行予算の承認申請に失敗しました");
  }
}

// ---------------------------------------------------------------------------
// 1-3 録音完了 → 要約・ToDo・ステージ提案
// ---------------------------------------------------------------------------

type RecordingSummaryLike = {
  source: string;
  title: string;
  summary: string;
  keyPoints: string[];
  todos: Array<{ title: string; dueDate?: string; priority: "high" | "medium" | "low" }>;
  customerUpdates: Array<{ field: string; value: string; reason: string }>;
};

function toCustomerUpdatesArray(updates: Record<string, string | null> | undefined): RecordingSummaryLike["customerUpdates"] {
  return Object.entries(updates ?? {})
    .filter((e): e is [string, string] => typeof e[1] === "string" && e[1].trim() !== "" && e[1] !== "null")
    .map(([field, value]) => ({ field, value, reason: "録音から抽出" }));
}

export async function processRecordingComplete(input: {
  customerId: string;
  recordingId: string;
  dealId?: string;
  transcript: string;
  memo?: string;
  /** 文字起こしAPI側で生成済みの要約。指定すると二重のLLM呼び出しを回避する */
  precomputed?: {
    title: string;
    summary: string;
    keyPoints: string[];
    todos: Array<{ title: string; priority: "high" | "medium" | "low"; dueDate?: string }>;
    customerUpdates: Record<string, string | null>;
  };
}) {
  const { supabase, company_id, user_id } = await getCompanyContext();
  const aiConfig = await resolveLinqAiConfig();

  let summaryResult: RecordingSummaryLike;
  if (input.precomputed?.summary) {
    summaryResult = {
      source: "linq",
      title: sanitizeMeetingTitle(input.precomputed.title),
      summary: input.precomputed.summary,
      keyPoints: input.precomputed.keyPoints ?? [],
      todos: input.precomputed.todos ?? [],
      customerUpdates: toCustomerUpdatesArray(input.precomputed.customerUpdates),
    };
  } else {
    try {
      summaryResult = await summarizeMeetingRecording({
        customerId: input.customerId,
        dealId: input.dealId,
        transcript: input.transcript,
        memo: input.memo,
      }, aiConfig);
    } catch (err) {
      // 要約に失敗しても商談自動登録（No.15）は必ず実行する
      console.error("[processRecordingComplete] summarize failed", err);
      const text = [input.transcript, input.memo].filter(Boolean).join("\n").trim();
      const d = new Date();
      summaryResult = {
        source: "fallback",
        title: `商談 ${d.getMonth() + 1}/${d.getDate()}`,
        summary: text.slice(0, 200),
        keyPoints: [],
        todos: [],
        customerUpdates: [],
      };
    }
  }

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

  // 商談が未紐付けなら新規作成して紐付け（No.15: 録音停止→商談自動登録）
  let dealId = input.dealId ?? null;
  if (!dealId) {
    const { data: customer } = await supabase
      .from("customers")
      .select("name, assigned_to")
      .eq("id", input.customerId)
      .single();
    const { data: newDeal, error: dealError } = await supabase.from("deals").insert({
      company_id,
      customer_id: input.customerId,
      title: summaryResult.title || `${customer?.name ?? "顧客"} 様 商談`,
      stage: "first_meeting",
      summary: summaryResult.summary,
      assigned_to: customer?.assigned_to ?? user_id,
    }).select("id").single();

    if (dealError) {
      console.error("[processRecordingComplete] deal insert failed", dealError);
    }
    dealId = newDeal?.id ?? null;

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
      category: "sales",
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
