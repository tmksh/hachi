"use server";

import { createClient } from "@/lib/supabase/server";
import { dispatchWebhook } from "@/lib/webhooks";
import type { WorkflowRequest, WorkflowStep } from "@/lib/database.types";
import { STANDALONE_WORKFLOW_KEYS } from "@/lib/tenant-host";

/** PostgrestError を素のまま throw すると本番で Server Components render エラーに化ける */
function actionError(
  error: { message?: string; code?: string; details?: string | null; hint?: string | null } | null | undefined,
  fallback: string,
): Error {
  const msg = error?.message?.trim();
  const detail = [error?.details, error?.hint, error?.code ? `code=${error.code}` : null]
    .filter(Boolean)
    .join(" / ");
  if (msg && detail) return new Error(`${msg}（${detail}）`);
  return new Error(msg || fallback);
}

export async function getWorkflowRequests(status?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("workflow_requests")
    .select("*, requester:profiles!workflow_requests_requester_id_fkey(id, display_name), workflow_type:workflow_types!workflow_requests_type_id_fkey(id, key, name)")
    .order("created_at", { ascending: false })
    .limit(300);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw actionError(error, "ワークフロー一覧の取得に失敗しました");
  return data;
}

export async function getWorkflowRequest(id: string) {
  const supabase = await createClient();
  const [requestRes, stepsRes, commentsRes] = await Promise.all([
    supabase
      .from("workflow_requests")
      .select("*, requester:profiles!workflow_requests_requester_id_fkey(id, display_name, department), workflow_type:workflow_types!workflow_requests_type_id_fkey(id, key, name, fields_schema)")
      .eq("id", id)
      .single(),
    supabase
      .from("workflow_steps")
      .select("*, approver:profiles!workflow_steps_approver_id_fkey(id, display_name, role)")
      .eq("request_id", id)
      .order("step_order"),
    supabase
      .from("workflow_comments")
      .select("*, user:profiles!workflow_comments_user_id_fkey(id, display_name)")
      .eq("request_id", id)
      .order("created_at"),
  ]);
  if (requestRes.error) throw actionError(requestRes.error, "ワークフロー詳細の取得に失敗しました");

  return {
    ...requestRes.data,
    steps: stepsRes.data || [],
    comments: (commentsRes.data || []).map((c) => ({
      ...c,
      body: (c as { message?: string }).message ?? "",
    })),
  };
}

export async function createWorkflowRequest(input: {
  type_id: string;
  title: string;
  amount?: number;
  is_urgent?: boolean;
  due_date?: string;
  payload?: Record<string, unknown>;
  approver_ids?: string[];
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { actionOk, actionFail } = await import("@/lib/action-result");
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return actionFail("ログインが必要です", "ログインが必要です");
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
    if (!profile?.company_id) return actionFail("プロフィールが見つかりません", "プロフィールが見つかりません");

    const row = {
      company_id: profile.company_id,
      type_id: input.type_id,
      requester_id: user.id,
      title: input.title,
      amount: input.amount || null,
      is_urgent: input.is_urgent || false,
      due_date: input.due_date || null,
      // payload は要約のみを渡す前提（巨大 JSON で insert 失敗しないよう呼び出し側で制限）
      payload: input.payload || {},
      status: "submitted" as const,
      submitted_at: new Date().toISOString(),
    };

    // 1) 通常の RLS 付きクライアント
    let { data, error } = await supabase
      .from("workflow_requests")
      .insert(row)
      .select("id")
      .single();

    // 2) RLS / ポリシー起因で失敗したら service role で同一テナントのみ再試行
    if (error || !data) {
      console.error("[createWorkflowRequest] user insert failed", error);
      try {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const admin = createAdminClient();
        const retry = await admin.from("workflow_requests").insert(row).select("id").single();
        data = retry.data;
        error = retry.error;
      } catch (adminErr) {
        console.error("[createWorkflowRequest] admin fallback unavailable", adminErr);
        return actionFail(error, "ワークフロー申請の作成に失敗しました");
      }
    }
    if (error || !data) {
      return actionFail(error, "ワークフロー申請の作成に失敗しました");
    }

    const requestId = data.id as string;
    const approverIds = [...new Set((input.approver_ids ?? []).filter(Boolean))];
    if (approverIds.length > 0) {
      const steps = approverIds.map((approverId, i) => ({
        company_id: profile.company_id,
        request_id: requestId,
        step_order: i + 1,
        approver_id: approverId,
        status: "pending" as const,
      }));

      let stepsError = (await supabase.from("workflow_steps").insert(steps)).error;
      if (stepsError) {
        console.error("[createWorkflowRequest] steps insert failed", stepsError);
        try {
          const { createAdminClient } = await import("@/lib/supabase/admin");
          const admin = createAdminClient();
          stepsError = (await admin.from("workflow_steps").insert(steps)).error;
        } catch (adminErr) {
          console.error("[createWorkflowRequest] steps admin fallback unavailable", adminErr);
        }
      }
      if (stepsError) {
        // 申請本体だけ残ると「申請中だが承認者がいない」状態になるためロールバック
        await supabase.from("workflow_requests").delete().eq("id", requestId);
        try {
          const { createAdminClient } = await import("@/lib/supabase/admin");
          await createAdminClient().from("workflow_requests").delete().eq("id", requestId);
        } catch {
          /* ignore */
        }
        return actionFail(stepsError, "承認ステップの作成に失敗しました");
      }
    }

    return actionOk({ id: requestId });
  } catch (e) {
    console.error("[createWorkflowRequest] unexpected", e);
    return actionFail(e, "ワークフロー申請の作成に失敗しました");
  }
}

async function syncWorkflowPayloadSideEffects(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requestId: string,
  outcome: "approved" | "rejected" | "returned",
) {
  const { data: request } = await supabase
    .from("workflow_requests")
    .select("payload")
    .eq("id", requestId)
    .single();
  if (!request?.payload) return;

  const payload = request.payload as Record<string, unknown>;
  const estimateId = payload.estimate_id as string | undefined;
  const contractId = payload.contract_id as string | undefined;

  const statusMap = {
    approved: "approved",
    rejected: "rejected",
    returned: "returned",
  } as const;

  if (estimateId) {
    const estimatePatch: Record<string, unknown> = {
      approval_status: statusMap[outcome],
      updated_at: new Date().toISOString(),
    };
    // 承認完了時は見積を「発行済み」に自動確定（No.51）
    if (outcome === "approved") {
      estimatePatch.status = "issued";
    }
    const { error: estimateErr } = await supabase
      .from("estimates")
      .update(estimatePatch)
      .eq("id", estimateId);
    if (estimateErr) {
      console.error("[syncWorkflowPayloadSideEffects] estimate update failed", estimateErr);
      throw new Error(`見積の承認状態更新に失敗しました: ${estimateErr.message}`);
    }
  }

  if (contractId) {
    if (outcome === "approved") {
      await supabase.from("contracts").update({
        status: "contracted",
        updated_at: new Date().toISOString(),
      }).eq("id", contractId);

      const { archiveContractDocumentFromRecord } = await import("@/lib/actions/contract-document-archive");
      void archiveContractDocumentFromRecord(contractId).catch(() => {});
    } else if (outcome === "returned") {
      await supabase.from("contracts").update({
        status: "preparing",
        updated_at: new Date().toISOString(),
      }).eq("id", contractId);
    }
  }
}

export async function approveWorkflowStep(stepId: string, comment?: string) {
  const { actionOk, actionFail } = await import("@/lib/action-result");
  try {
    await approveWorkflowStepInternal(stepId, "approved", comment);
    return actionOk({});
  } catch (e) {
    console.error("[approveWorkflowStep]", e);
    return actionFail(e, "承認に失敗しました");
  }
}

export async function approveWorkflowStepConditional(stepId: string, condition: string) {
  const { actionOk, actionFail } = await import("@/lib/action-result");
  try {
    const trimmed = condition.trim();
    if (!trimmed) return actionFail("条件付き承認には条件コメントが必要です", "条件コメントが必要です");
    await approveWorkflowStepInternal(stepId, "approved", `【条件付き承認】${trimmed}`, true);
    return actionOk({});
  } catch (e) {
    console.error("[approveWorkflowStepConditional]", e);
    return actionFail(e, "条件付き承認に失敗しました");
  }
}

async function approveWorkflowStepInternal(
  stepId: string,
  status: "approved",
  comment?: string,
  conditional = false,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // 順次承認: 前ステップが未完了なら拒否（No.85）
  const { data: currentStep } = await supabase
    .from("workflow_steps")
    .select("id, request_id, step_order, status, approver_id")
    .eq("id", stepId)
    .single();
  if (!currentStep) throw new Error("承認ステップが見つかりません");
  if (currentStep.status !== "pending") throw new Error("このステップは既に処理済みです");
  if (currentStep.approver_id !== user.id) {
    throw new Error("このステップの承認者ではありません");
  }

  const { data: earlierPending } = await supabase
    .from("workflow_steps")
    .select("id, step_order")
    .eq("request_id", currentStep.request_id)
    .eq("status", "pending")
    .lt("step_order", currentStep.step_order)
    .limit(1);
  if (earlierPending && earlierPending.length > 0) {
    throw new Error("前の承認ステップが完了していません。順番に承認してください");
  }

  // 契約書×総務: 必要事項追記後のみ承認可（No.86 / Step17）
  const { data: requestForGate } = await supabase
    .from("workflow_requests")
    .select("payload")
    .eq("id", currentStep.request_id)
    .single();
  const gatePayload = (requestForGate?.payload ?? {}) as Record<string, unknown>;
  if (gatePayload.contract_id) {
    const { data: approverProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (approverProfile?.role === "administration") {
      const supplemented = Boolean(gatePayload.admin_supplemented_at)
        || (
          typeof gatePayload.payment_terms === "string"
          && gatePayload.payment_terms.trim()
          && typeof gatePayload.bank_account === "string"
          && gatePayload.bank_account.trim()
        );
      if (!supplemented) {
        throw new Error("総務追記（支払条件・振込口座）を保存してから承認してください");
      }
    }
  }

  const { error } = await supabase
    .from("workflow_steps")
    .update({ status, comment: comment || null, decided_at: new Date().toISOString() })
    .eq("id", stepId);
  if (error) throw actionError(error, "承認ステップの更新に失敗しました");

  // Check if all steps are approved
  const { data: step } = await supabase.from("workflow_steps").select("request_id, step_order").eq("id", stepId).single();
  if (step) {
    const { data: pendingSteps } = await supabase
      .from("workflow_steps")
      .select("id, approver_id, step_order")
      .eq("request_id", step.request_id)
      .eq("status", "pending")
      .order("step_order", { ascending: true });

    if (!pendingSteps || pendingSteps.length === 0) {
      const decidedAt = new Date().toISOString();
      const { data: approvedReq, error: approveErr } = await supabase
        .from("workflow_requests")
        .update({ status: "approved", decided_at: decidedAt, updated_at: decidedAt })
        .eq("id", step.request_id)
        .select("id, status")
        .maybeSingle();
      if (approveErr || !approvedReq || approvedReq.status !== "approved") {
        throw new Error(
          `承認完了ステータスの更新に失敗しました: ${approveErr?.message ?? "更新が反映されませんでした"}`,
        );
      }

      const { data: request } = await supabase
        .from("workflow_requests")
        .select("company_id, title, requester_id, payload")
        .eq("id", step.request_id)
        .single();
      if (request) {
        void dispatchWebhook(request.company_id, "workflow.approved", {
          id: step.request_id,
          title: request.title,
        });
        try {
          await syncWorkflowPayloadSideEffects(supabase, step.request_id, "approved");
        } catch (e) {
          console.error("[approveWorkflowStep] side effects failed", e);
        }

        // 条件付き承認の場合は見積 approval_status を上書き（No.46/52）
        if (conditional) {
          const estimateId = (request.payload as Record<string, unknown> | undefined)?.estimate_id as string | undefined;
          if (estimateId) {
            await supabase.from("estimates").update({
              approval_status: "conditional",
              updated_at: new Date().toISOString(),
            }).eq("id", estimateId);
          }
        }

        const contractId = (request.payload as Record<string, unknown> | undefined)?.contract_id as string | undefined;
        if (contractId) {
          // 電子契約タブ活性化のため契約ステータスを確実に contracted へ（Step18）
          const { data: contracted, error: contractErr } = await supabase
            .from("contracts")
            .update({ status: "contracted", updated_at: new Date().toISOString() })
            .eq("id", contractId)
            .select("id, status, assigned_to, title")
            .maybeSingle();
          if (contractErr || !contracted) {
            console.error("[approveWorkflowStep] contract status update failed", contractErr);
          }

          const { notifySalesFlowUser } = await import("@/lib/actions/sales-flow");
          const notifyIds = new Set<string>();
          if (request.requester_id) notifyIds.add(request.requester_id);
          if (contracted?.assigned_to) notifyIds.add(contracted.assigned_to);

          for (const userId of notifyIds) {
            try {
              await notifySalesFlowUser(supabase, request.company_id, userId, {
                title: `契約承認完了: ${contracted?.title ?? request.title}`,
                description: "電子契約タブが利用可能になりました。クラウドサインで送信できます",
                href: `/contracts/${contractId}?tab=esign`,
                urgent: true,
                extraTags: ["contract", "esign_unlocked"],
              }, request.requester_id);
            } catch (e) {
              console.error("[approveWorkflowStep] notify failed", e);
            }
          }
        }

        // 見積承認完了時も申請者へ通知
        const estimateId = (request.payload as Record<string, unknown> | undefined)?.estimate_id as string | undefined;
        if (estimateId && request.requester_id) {
          try {
            const { notifySalesFlowUser } = await import("@/lib/actions/sales-flow");
            await notifySalesFlowUser(supabase, request.company_id, request.requester_id, {
              title: conditional
                ? `見積が条件付き承認されました: ${request.title}`
                : `見積が承認されました: ${request.title}`,
              description: conditional
                ? "条件を確認のうえ、顧客へ提示してください"
                : "見積が発行済みになりました。顧客へ提示できます",
              href: `/quotes/${estimateId}`,
              urgent: conditional,
            });
          } catch (e) {
            console.error("[approveWorkflowStep] estimate notify failed", e);
          }
        }
      }
    } else {
      // 次の承認者へ順次通知（No.85）
      const next = pendingSteps[0];
      if (next?.approver_id) {
        const { data: request } = await supabase
          .from("workflow_requests")
          .select("company_id, title, requester_id")
          .eq("id", step.request_id)
          .single();
        if (request) {
          try {
            const { notifySalesFlowUser } = await import("@/lib/actions/sales-flow");
            await notifySalesFlowUser(supabase, request.company_id, next.approver_id, {
              title: `契約承認依頼（次ステップ）: ${request.title}`,
              description: `Step ${next.step_order} の承認をお願いします`,
              href: `/workflow/${step.request_id}`,
              urgent: true,
            }, request.requester_id);
          } catch (e) {
            console.error("[approveWorkflowStep] next-step notify failed", e);
          }
        }
      }
    }
  }
}

export async function rejectWorkflowStep(stepId: string, comment?: string) {
  const { actionOk, actionFail } = await import("@/lib/action-result");
  try {
    await rejectWorkflowStepUnsafe(stepId, comment);
    return actionOk({});
  } catch (e) {
    console.error("[rejectWorkflowStep]", e);
    return actionFail(e, "却下処理に失敗しました");
  }
}

async function rejectWorkflowStepUnsafe(stepId: string, comment?: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("workflow_steps")
    .update({ status: "rejected", comment: comment || null, decided_at: new Date().toISOString() })
    .eq("id", stepId);
  if (error) throw actionError(error, "却下処理に失敗しました");

  const { data: step, error: stepErr } = await supabase
    .from("workflow_steps")
    .select("request_id")
    .eq("id", stepId)
    .single();
  if (stepErr || !step) throw actionError(stepErr, "承認ステップが見つかりません");

  // 却下時は差戻しフラグを明示的にクリア（No.48: 却下→差戻し誤表示の再発防止）
  const { data: existing, error: existingErr } = await supabase
    .from("workflow_requests")
    .select("payload")
    .eq("id", step.request_id)
    .single();
  if (existingErr) throw actionError(existingErr, "申請の取得に失敗しました");

  const prev = (existing?.payload ?? {}) as Record<string, unknown>;
  const { remand: _r, remand_comment: _c, remanded_at: _a, ...rest } = prev;
  const payload = {
    ...rest,
    remand: false,
    reject_comment: comment ?? null,
    rejected_at: new Date().toISOString(),
  };

  const decidedAt = new Date().toISOString();
  const { data: updatedReq, error: reqErr } = await supabase
    .from("workflow_requests")
    .update({
      status: "rejected",
      decided_at: decidedAt,
      payload,
      updated_at: decidedAt,
    })
    .eq("id", step.request_id)
    .select("id, status")
    .maybeSingle();
  if (reqErr || !updatedReq || updatedReq.status !== "rejected") {
    await supabase
      .from("workflow_steps")
      .update({ status: "pending", comment: null, decided_at: null })
      .eq("id", stepId);
    throw new Error(`却下に失敗しました: ${reqErr?.message ?? "更新が反映されませんでした"}`);
  }

  await supabase
    .from("workflow_steps")
    .update({ status: "skipped", decided_at: decidedAt })
    .eq("request_id", step.request_id)
    .eq("status", "pending");

  const { data: request } = await supabase
    .from("workflow_requests")
    .select("company_id, title")
    .eq("id", step.request_id)
    .single();
  if (request) {
    void dispatchWebhook(request.company_id, "workflow.rejected", {
      id: step.request_id,
      title: request.title,
    });
  }
  try {
    await syncWorkflowPayloadSideEffects(supabase, step.request_id, "rejected");
  } catch (e) {
    console.error("[rejectWorkflowStep] side effects failed", e);
  }
}

export async function remandWorkflowStep(stepId: string, comment?: string) {
  const { actionOk, actionFail } = await import("@/lib/action-result");
  try {
    const updated = await remandWorkflowStepUnsafe(stepId, comment);
    return actionOk(updated);
  } catch (e) {
    console.error("[remandWorkflowStep]", e);
    return actionFail(e, "差戻し処理に失敗しました");
  }
}

async function remandWorkflowStepUnsafe(stepId: string, comment?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: stepped, error } = await supabase
    .from("workflow_steps")
    .update({ status: "rejected", comment: comment || null, decided_at: new Date().toISOString() })
    .eq("id", stepId)
    .select("id, request_id")
    .single();
  if (error || !stepped) throw actionError(error, "承認ステップの更新に失敗しました");

  const requestId = stepped.request_id;

  const { data: existing, error: existingErr } = await supabase
    .from("workflow_requests")
    .select("payload")
    .eq("id", requestId)
    .single();
  if (existingErr) throw actionError(existingErr, "申請の取得に失敗しました");

  const prev = (existing?.payload ?? {}) as Record<string, unknown>;
  // 差戻し時は却下系フィールドを除去し、remand を必ず true で書き込む（差戻し→却下誤表示対策）
  const { reject_comment: _rc, rejected_at: _ra, ...rest } = prev;
  const payload = {
    ...rest,
    remand: true,
    remand_comment: comment ?? null,
    remanded_at: new Date().toISOString(),
  };

  // RLS で 0 件更新でも error にならないため .select().single() で実更新を検証（申請中のまま残る不具合対策）
  const decidedAt = new Date().toISOString();
  let { data: updatedReq, error: reqErr } = await supabase
    .from("workflow_requests")
    .update({
      status: "rejected",
      decided_at: decidedAt,
      payload,
      updated_at: decidedAt,
    })
    .eq("id", requestId)
    .select("id, status, payload")
    .maybeSingle();

  // 巨大 payload で失敗した場合はステータス＋差戻しフラグのみで再試行
  if (reqErr || !updatedReq || updatedReq.status !== "rejected") {
    const lightPayload = {
      contract_id: prev.contract_id ?? null,
      estimate_id: prev.estimate_id ?? null,
      workflow_type_key: prev.workflow_type_key ?? null,
      workflow_type_name: prev.workflow_type_name ?? null,
      remand: true,
      remand_comment: comment ?? null,
      remanded_at: decidedAt,
    };
    const retry = await supabase
      .from("workflow_requests")
      .update({
        status: "rejected",
        decided_at: decidedAt,
        payload: lightPayload,
        updated_at: decidedAt,
      })
      .eq("id", requestId)
      .select("id, status, payload")
      .maybeSingle();
    updatedReq = retry.data;
    reqErr = retry.error;
  }

  if (reqErr || !updatedReq || updatedReq.status !== "rejected") {
    await supabase
      .from("workflow_steps")
      .update({ status: "pending", comment: null, decided_at: null })
      .eq("id", stepId);
    throw new Error(
      `差戻しに失敗しました（ステータスが申請中のままです）: ${reqErr?.message ?? "更新が反映されませんでした"}`,
    );
  }

  // 後続の承認待ちステップをスキップし、申請中のように見えないようにする
  await supabase
    .from("workflow_steps")
    .update({ status: "skipped", decided_at: decidedAt })
    .eq("request_id", requestId)
    .eq("status", "pending");

  try {
    await syncWorkflowPayloadSideEffects(supabase, requestId, "returned");
  } catch (e) {
    console.error("[remandWorkflowStep] side effects failed", e);
  }

  const { data: request } = await supabase
    .from("workflow_requests")
    .select("company_id, requester_id, title, payload")
    .eq("id", requestId)
    .single();

  if (request?.requester_id) {
    const reqPayload = (request.payload ?? {}) as Record<string, unknown>;
    const contractId = reqPayload.contract_id as string | undefined;
    const estimateId = reqPayload.estimate_id as string | undefined;
    const href = estimateId
      ? `/quotes/${estimateId}`
      : contractId
        ? `/contracts/${contractId}?tab=documents`
        : `/workflow/${requestId}`;
    const description = [
      comment?.trim() || "内容を修正のうえ再申請してください",
      contractId ? "書類作成タブで修正できます。" : null,
    ].filter(Boolean).join("\n");

    try {
      const { notifySalesFlowUser } = await import("@/lib/actions/sales-flow");
      await notifySalesFlowUser(supabase, request.company_id, request.requester_id, {
        title: `差戻しされました: ${request.title}`,
        description,
        href,
        urgent: true,
        extraTags: ["workflow_remand", contractId ? "contract" : "estimate"].filter(Boolean) as string[],
      }, user.id);
    } catch (e) {
      console.error("[remandWorkflowStep] notify failed", e);
    }
  }

  return {
    id: requestId,
    status: "rejected" as const,
    payload: (updatedReq.payload ?? payload) as Record<string, unknown>,
  };
}

export async function updateWorkflowRequestStatus(
  id: string,
  status: "draft" | "submitted" | "approved" | "rejected" | "cancelled",
) {
  const supabase = await createClient();
  const patch: {
    status: typeof status;
    submitted_at?: string | null;
    decided_at?: string | null;
    updated_at: string;
  } = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === "submitted") {
    patch.submitted_at = new Date().toISOString();
    patch.decided_at = null;
  } else if (status === "approved" || status === "rejected" || status === "cancelled") {
    patch.decided_at = new Date().toISOString();
  } else if (status === "draft") {
    patch.submitted_at = null;
    patch.decided_at = null;
  }

  const { error } = await supabase.from("workflow_requests").update(patch).eq("id", id);
  if (error) throw actionError(error, "申請ステータスの更新に失敗しました");
}

const LINKED_PAYLOAD_KEYS = ["estimate_id", "contract_id"] as const;

function isLinkedWorkflowPayload(payload: Record<string, unknown> | null | undefined) {
  if (!payload) return false;
  return LINKED_PAYLOAD_KEYS.some((k) => {
    const v = payload[k];
    return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());
  });
}

function isWorkflowPrivilegedRole(role: string | null | undefined) {
  return role === "hq_admin" || role === "admin";
}

/** 申請者本人、または同一テナントの管理者（見積 No.69 と同様に再申請・取消を可能にする） */
function canActOnOwnWorkflowRequest(
  userId: string,
  request: { requester_id: string | null; company_id: string | null },
  actor: { role?: string | null; company_id?: string | null } | null,
) {
  if (request.requester_id === userId) return true;
  if (!actor || !isWorkflowPrivilegedRole(actor.role)) return false;
  return Boolean(actor.company_id && request.company_id && actor.company_id === request.company_id);
}

async function updateWorkflowRequestRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  companyId: string,
  patch: Record<string, unknown>,
) {
  const selectCols = "id, status, payload, requester_id, title, amount, due_date, decided_at, submitted_at";
  let { data, error } = await supabase
    .from("workflow_requests")
    .update(patch)
    .eq("id", id)
    .eq("company_id", companyId)
    .select(selectCols)
    .maybeSingle();
  if (error || !data) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const retry = await createAdminClient()
        .from("workflow_requests")
        .update(patch)
        .eq("id", id)
        .eq("company_id", companyId)
        .select(selectCols)
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    } catch (adminErr) {
      console.error("[updateWorkflowRequestRow] admin fallback unavailable", adminErr);
    }
  }
  return { data, error };
}

/**
 * 差戻し / 却下された経費・休暇などの申請を再提出する（見積 No.69 相当）。
 * 見積・契約に紐づく申請はそれぞれの画面から再申請する。
 */
export async function resubmitWorkflowRequest(input: {
  id: string;
  title?: string;
  amount?: number | null;
  due_date?: string | null;
  payload?: Record<string, unknown>;
  comment?: string;
}): Promise<
  | { ok: true; id: string; status: "submitted"; payload: Record<string, unknown> }
  | { ok: false; error: string }
> {
  const { actionOk, actionFail } = await import("@/lib/action-result");
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return actionFail("ログインが必要です", "ログインが必要です");

    const { data: request, error: reqErr } = await supabase
      .from("workflow_requests")
      .select("id, status, payload, requester_id, company_id, title, type_id")
      .eq("id", input.id)
      .single();
    if (reqErr || !request) return actionFail(reqErr, "申請が見つかりません");
    const { data: actorProfile } = await supabase
      .from("profiles")
      .select("company_id, role")
      .eq("id", user.id)
      .maybeSingle();
    if (!canActOnOwnWorkflowRequest(user.id, request, actorProfile)) {
      return actionFail("申請者本人のみ再申請できます", "申請者本人のみ再申請できます");
    }
    if (actorProfile?.company_id && request.company_id && actorProfile.company_id !== request.company_id) {
      return actionFail("申請が見つかりません", "申請が見つかりません");
    }
    if (request.status !== "rejected") {
      return actionFail("差戻しまたは却下された申請のみ再申請できます", "再申請できない状態です");
    }
    const { data: wfType } = await supabase
      .from("workflow_types")
      .select("key")
      .eq("id", request.type_id)
      .maybeSingle();
    const prev = (request.payload ?? {}) as Record<string, unknown>;
    if (isLinkedWorkflowPayload(prev) && !STANDALONE_WORKFLOW_KEYS.has(String(wfType?.key ?? ""))) {
      return actionFail(
        "見積・契約の申請は、それぞれの詳細画面から再申請してください",
        "見積・契約の申請は、それぞれの詳細画面から再申請してください",
      );
    }

    const now = new Date().toISOString();
    const nextPayload = {
      ...prev,
      ...(input.payload ?? {}),
      remand: false,
      resubmitted_at: now,
    };

    const patch: Record<string, unknown> = {
      status: "submitted",
      title: input.title?.trim() || request.title,
      payload: nextPayload,
      submitted_at: now,
      decided_at: null,
      updated_at: now,
    };
    if (input.amount !== undefined) patch.amount = input.amount;
    if (input.due_date !== undefined) patch.due_date = input.due_date;

    const companyId = actorProfile?.company_id ?? request.company_id;
    if (!companyId) return actionFail("申請が見つかりません", "申請が見つかりません");
    const { data: updated, error: updErr } = await updateWorkflowRequestRow(supabase, input.id, companyId, patch);
    if (updErr || !updated || updated.status !== "submitted") {
      return actionFail(updErr, "再申請に失敗しました");
    }

    const { error: stepsErr } = await supabase
      .from("workflow_steps")
      .update({ status: "pending", comment: null, decided_at: null })
      .eq("request_id", input.id);
    if (stepsErr) {
      try {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        await createAdminClient()
          .from("workflow_steps")
          .update({ status: "pending", comment: null, decided_at: null })
          .eq("request_id", input.id)
          .eq("company_id", companyId);
      } catch (e) {
        console.error("[resubmitWorkflowRequest] steps reset failed", e);
        return actionFail(stepsErr, "承認ステップの初期化に失敗しました");
      }
    }

    const note = input.comment?.trim() || "再申請しました";
    await supabase.from("workflow_comments").insert({
      company_id: companyId,
      request_id: input.id,
      user_id: user.id,
      message: note,
    });

    const { data: firstStep } = await supabase
      .from("workflow_steps")
      .select("approver_id, step_order")
      .eq("request_id", input.id)
      .eq("status", "pending")
      .order("step_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (firstStep?.approver_id && request.company_id) {
      try {
        const { notifySalesFlowUser } = await import("@/lib/actions/sales-flow");
        await notifySalesFlowUser(supabase, request.company_id, firstStep.approver_id, {
          title: `再申請: ${updated.title ?? request.title}`,
          description: note,
          href: `/workflow/${input.id}`,
          urgent: true,
        }, user.id);
      } catch (e) {
        console.error("[resubmitWorkflowRequest] notify failed", e);
      }
    }

    return actionOk({
      id: input.id,
      status: "submitted" as const,
      payload: (updated.payload ?? nextPayload) as Record<string, unknown>,
    });
  } catch (e) {
    console.error("[resubmitWorkflowRequest]", e);
    return actionFail(e, "再申請に失敗しました");
  }
}

/**
 * 申請中・差戻し・却下の申請を申請者本人が取り消す。
 * 承認済みは取り消せない。履歴として cancelled を残し、物理削除はしない。
 */
export async function cancelWorkflowRequest(
  id: string,
  comment?: string,
): Promise<
  | { ok: true; id: string; status: "cancelled"; payload: Record<string, unknown> }
  | { ok: false; error: string }
> {
  const { actionOk, actionFail } = await import("@/lib/action-result");
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return actionFail("ログインが必要です", "ログインが必要です");

    const { data: request, error: reqErr } = await supabase
      .from("workflow_requests")
      .select("id, status, payload, requester_id, company_id, title, type_id")
      .eq("id", id)
      .single();
    if (reqErr || !request) return actionFail(reqErr, "申請が見つかりません");
    const { data: actorProfile } = await supabase
      .from("profiles")
      .select("company_id, role")
      .eq("id", user.id)
      .maybeSingle();
    if (!canActOnOwnWorkflowRequest(user.id, request, actorProfile)) {
      return actionFail("申請者本人のみ取り消せます", "申請者本人のみ取り消せます");
    }
    if (request.status !== "submitted" && request.status !== "rejected") {
      return actionFail("申請中・差戻し・却下の申請のみ取り消せます", "取り消せない状態です");
    }
    const { data: wfType } = await supabase
      .from("workflow_types")
      .select("key")
      .eq("id", request.type_id)
      .maybeSingle();
    const prev = (request.payload ?? {}) as Record<string, unknown>;
    if (isLinkedWorkflowPayload(prev) && !STANDALONE_WORKFLOW_KEYS.has(String(wfType?.key ?? ""))) {
      return actionFail(
        "見積・契約の申請は、それぞれの詳細画面から操作してください",
        "見積・契約の申請は、それぞれの詳細画面から操作してください",
      );
    }

    const now = new Date().toISOString();
    const companyId = actorProfile?.company_id ?? request.company_id;
    if (!companyId) return actionFail("申請が見つかりません", "申請が見つかりません");
    const { data: updated, error: updErr } = await updateWorkflowRequestRow(supabase, id, companyId, {
      status: "cancelled",
      decided_at: now,
      updated_at: now,
      payload: { ...prev, cancelled_at: now, cancel_comment: comment?.trim() || null },
    });
    if (updErr || !updated || updated.status !== "cancelled") {
      return actionFail(updErr, "取り消しに失敗しました");
    }

    await supabase
      .from("workflow_steps")
      .update({ status: "skipped", decided_at: now })
      .eq("request_id", id)
      .in("status", ["pending", "rejected"]);

    const note = comment?.trim() || "申請を取り消しました";
    await supabase.from("workflow_comments").insert({
      company_id: companyId,
      request_id: id,
      user_id: user.id,
      message: note,
    });

    const { data: steps } = await supabase
      .from("workflow_steps")
      .select("approver_id")
      .eq("request_id", id);
    const notifyIds = new Set(
      (steps ?? []).map((s) => s.approver_id).filter((uid): uid is string => !!uid && uid !== user.id),
    );
    if (request.company_id) {
      const { notifySalesFlowUser } = await import("@/lib/actions/sales-flow");
      for (const uid of notifyIds) {
        try {
          await notifySalesFlowUser(supabase, request.company_id, uid, {
            title: `申請が取り消されました: ${request.title}`,
            description: note,
            href: `/workflow/${id}`,
            urgent: false,
          }, user.id);
        } catch (e) {
          console.error("[cancelWorkflowRequest] notify failed", e);
        }
      }
    }

    return actionOk({
      id,
      status: "cancelled" as const,
      payload: (updated.payload ?? { ...prev, cancelled_at: now, cancel_comment: comment?.trim() || null }) as Record<string, unknown>,
    });
  } catch (e) {
    console.error("[cancelWorkflowRequest]", e);
    return actionFail(e, "取り消しに失敗しました");
  }
}

export async function addWorkflowComment(requestId: string, body: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { error } = await supabase.from("workflow_comments").insert({
    company_id: profile.company_id,
    request_id: requestId,
    user_id: user.id,
    message: body,
  });
  if (error) throw actionError(error, "コメントの投稿に失敗しました");

  // コメント着信通知（No.43/44）
  const { data: request } = await supabase
    .from("workflow_requests")
    .select("title, requester_id, payload")
    .eq("id", requestId)
    .single();
  const { data: steps } = await supabase
    .from("workflow_steps")
    .select("approver_id")
    .eq("request_id", requestId);

  const notifyIds = new Set<string>();
  if (request?.requester_id && request.requester_id !== user.id) {
    notifyIds.add(request.requester_id);
  }
  for (const s of steps ?? []) {
    if (s.approver_id && s.approver_id !== user.id) notifyIds.add(s.approver_id);
  }

  if (notifyIds.size > 0) {
    const { notifySalesFlowUser } = await import("@/lib/actions/sales-flow");
    const estimateId = (request?.payload as Record<string, unknown> | undefined)?.estimate_id as string | undefined;
    const contractId = (request?.payload as Record<string, unknown> | undefined)?.contract_id as string | undefined;
    const href = estimateId
      ? `/quotes/${estimateId}`
      : contractId
        ? `/contracts/${contractId}`
        : `/workflow/${requestId}`;

    for (const uid of notifyIds) {
      await notifySalesFlowUser(supabase, profile.company_id, uid, {
        title: `承認スレッドにコメント: ${request?.title ?? ""}`,
        description: body.slice(0, 200),
        href: `/workflow/${requestId}`,
        urgent: false,
      }, user.id);
      void href;
    }
  }
}

export async function getWorkflowApprovalSupport(requestId: string) {
  const supabase = await createClient();
  const { data: request } = await supabase
    .from("workflow_requests")
    .select("payload, amount, title")
    .eq("id", requestId)
    .single();
  if (!request) throw new Error("申請が見つかりません");

  const payload = (request.payload ?? {}) as Record<string, unknown>;
  const estimateId = payload.estimate_id as string | undefined;
  if (!estimateId) return null;

  const { data: estimate } = await supabase
    .from("estimates")
    .select("id, title, gross_profit_rate, total, customer_id")
    .eq("id", estimateId)
    .single();
  if (!estimate) return null;

  const { data: similar } = await supabase
    .from("estimates")
    .select("id, title, gross_profit_rate, total")
    .eq("customer_id", estimate.customer_id ?? "")
    .neq("id", estimateId)
    .order("updated_at", { ascending: false })
    .limit(5);

  const { generateApprovalSupport, resolveLinqAiConfig } = await import("@/lib/integrations/linq-ai");
  return generateApprovalSupport(
    {
      id: estimate.id,
      title: estimate.title ?? "",
      grossProfitRate: estimate.gross_profit_rate ?? 0,
      total: Number(estimate.total ?? 0),
    },
    (similar ?? []).map((e) => ({
      id: e.id,
      title: e.title ?? "",
      grossProfitRate: e.gross_profit_rate ?? 0,
      total: Number(e.total ?? 0),
    })),
    String(payload.application_comment ?? ""),
    await resolveLinqAiConfig(),
  );
}

const DELETED_WORKFLOW_TYPE_PREFIX = "deleted:";

function isDeletedWorkflowTypeKey(key?: string | null) {
  return String(key ?? "").startsWith(DELETED_WORKFLOW_TYPE_PREFIX);
}

export async function getWorkflowTypes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workflow_types")
    .select("*")
    .order("sort_order")
    .order("created_at");
  if (error) throw actionError(error, "ワークフロー種別の取得に失敗しました");
  return (data ?? []).filter((t) => !isDeletedWorkflowTypeKey((t as { key?: string }).key));
}

export async function createWorkflowType(input: {
  key: string;
  name: string;
  description?: string;
  fields_schema?: FieldDef[];
  approval_route?: ApprovalStep[];
  deadline_days?: number;
  sort_order?: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { data, error } = await supabase
    .from("workflow_types")
    .insert({
      company_id: profile.company_id,
      key: input.key || input.name,
      name: input.name,
      description: input.description || null,
      fields_schema: input.fields_schema || [],
      approval_route: input.approval_route || [],
      deadline_days: input.deadline_days || null,
      sort_order: input.sort_order || 0,
    })
    .select()
    .single();
  if (error) throw actionError(error, "ワークフロー種別の作成に失敗しました");
  return data;
}

export async function updateWorkflowType(id: string, input: {
  name?: string;
  description?: string;
  fields_schema?: FieldDef[];
  approval_route?: ApprovalStep[];
  deadline_days?: number;
  sort_order?: number;
}) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("workflow_types")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw actionError(error, "ワークフロー種別の更新に失敗しました");
}

export async function deleteWorkflowType(id: string) {
  const supabase = await createClient();
  const { data: current, error: fetchErr } = await supabase
    .from("workflow_types")
    .select("id, key")
    .eq("id", id)
    .single();
  if (fetchErr || !current) throw actionError(fetchErr, "ワークフロー種別が見つかりません");

  // 申請が残っていても種別を消せるよう、先に参照を外す（マイグレーション適用後）
  await supabase.from("workflow_requests").update({ type_id: null }).eq("type_id", id);

  const { data: removed, error: delErr } = await supabase
    .from("workflow_types")
    .delete()
    .eq("id", id)
    .select("id");
  if (!delErr && removed && removed.length > 0) return;

  // FK / RLS で物理削除できない場合は論理削除（申請データは残す）
  const nextKey = isDeletedWorkflowTypeKey(current.key)
    ? current.key
    : `${DELETED_WORKFLOW_TYPE_PREFIX}${current.key}`;
  const { error: updErr } = await supabase
    .from("workflow_types")
    .update({ key: nextKey, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (updErr) throw actionError(updErr ?? delErr, "ワークフロー種別の削除に失敗しました");
}

export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "textarea" | "select";
  required?: boolean;
  options?: string[];
};

export type ApprovalStep = {
  step_order: number;
  approver_id: string;
};
