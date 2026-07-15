"use server";

import { createClient } from "@/lib/supabase/server";
import { dispatchWebhook } from "@/lib/webhooks";
import type { WorkflowRequest, WorkflowStep } from "@/lib/database.types";

export async function getWorkflowRequests(status?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("workflow_requests")
    .select("*, requester:profiles!workflow_requests_requester_id_fkey(id, display_name), workflow_type:workflow_types!workflow_requests_type_id_fkey(id, key, name)")
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getWorkflowRequest(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workflow_requests")
    .select("*, requester:profiles!workflow_requests_requester_id_fkey(id, display_name, department), workflow_type:workflow_types!workflow_requests_type_id_fkey(id, key, name)")
    .eq("id", id)
    .single();
  if (error) throw error;

  const { data: steps } = await supabase
    .from("workflow_steps")
    .select("*, approver:profiles!workflow_steps_approver_id_fkey(id, display_name)")
    .eq("request_id", id)
    .order("step_order");

  const { data: comments } = await supabase
    .from("workflow_comments")
    .select("*, user:profiles!workflow_comments_user_id_fkey(id, display_name)")
    .eq("request_id", id)
    .order("created_at");

  return {
    ...data,
    steps: steps || [],
    comments: (comments || []).map((c) => ({
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
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { data, error } = await supabase
    .from("workflow_requests")
    .insert({
      company_id: profile.company_id,
      type_id: input.type_id,
      requester_id: user.id,
      title: input.title,
      amount: input.amount || null,
      is_urgent: input.is_urgent || false,
      due_date: input.due_date || null,
      payload: input.payload || {},
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;

  // Create approval steps
  if (input.approver_ids && input.approver_ids.length > 0) {
    await supabase.from("workflow_steps").insert(
      input.approver_ids.map((approverId, i) => ({
        company_id: profile.company_id,
        request_id: data.id,
        step_order: i + 1,
        approver_id: approverId,
        status: "pending" as const,
      }))
    );
  }

  return data as WorkflowRequest;
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
    await supabase.from("estimates").update(estimatePatch).eq("id", estimateId);
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
  return approveWorkflowStepInternal(stepId, "approved", comment);
}

export async function approveWorkflowStepConditional(stepId: string, condition: string) {
  const trimmed = condition.trim();
  if (!trimmed) throw new Error("条件付き承認には条件コメントが必要です");
  return approveWorkflowStepInternal(stepId, "approved", `【条件付き承認】${trimmed}`, true);
}

async function approveWorkflowStepInternal(
  stepId: string,
  status: "approved",
  comment?: string,
  conditional = false,
) {
  const supabase = await createClient();

  // 順次承認: 前ステップが未完了なら拒否（No.85）
  const { data: currentStep } = await supabase
    .from("workflow_steps")
    .select("id, request_id, step_order, status")
    .eq("id", stepId)
    .single();
  if (!currentStep) throw new Error("承認ステップが見つかりません");
  if (currentStep.status !== "pending") throw new Error("このステップは既に処理済みです");

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

  const { error } = await supabase
    .from("workflow_steps")
    .update({ status, comment: comment || null, decided_at: new Date().toISOString() })
    .eq("id", stepId);
  if (error) throw error;

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
      await supabase
        .from("workflow_requests")
        .update({ status: "approved", decided_at: new Date().toISOString() })
        .eq("id", step.request_id);

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
        await syncWorkflowPayloadSideEffects(supabase, step.request_id, "approved");

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
          const { data: contract } = await supabase
            .from("contracts")
            .select("assigned_to, title")
            .eq("id", contractId)
            .single();

          const { notifySalesFlowUser } = await import("@/lib/actions/sales-flow");
          const notifyIds = new Set<string>();
          if (request.requester_id) notifyIds.add(request.requester_id);
          if (contract?.assigned_to) notifyIds.add(contract.assigned_to);

          for (const userId of notifyIds) {
            await notifySalesFlowUser(supabase, request.company_id, userId, {
              title: `契約承認完了: ${contract?.title ?? request.title}`,
              description: "電子契約タブからクラウドサインで送信できます",
              href: `/contracts/${contractId}?tab=esign`,
            }, request.requester_id);
          }
        }

        // 見積承認完了時も申請者へ通知
        const estimateId = (request.payload as Record<string, unknown> | undefined)?.estimate_id as string | undefined;
        if (estimateId && request.requester_id) {
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
          const { notifySalesFlowUser } = await import("@/lib/actions/sales-flow");
          await notifySalesFlowUser(supabase, request.company_id, next.approver_id, {
            title: `契約承認依頼（次ステップ）: ${request.title}`,
            description: `Step ${next.step_order} の承認をお願いします`,
            href: `/workflow/${step.request_id}`,
            urgent: true,
          }, request.requester_id);
        }
      }
    }
  }
}

export async function rejectWorkflowStep(stepId: string, comment?: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("workflow_steps")
    .update({ status: "rejected", comment: comment || null, decided_at: new Date().toISOString() })
    .eq("id", stepId);
  if (error) throw error;

  const { data: step } = await supabase.from("workflow_steps").select("request_id").eq("id", stepId).single();
  if (step) {
    await supabase
      .from("workflow_requests")
      .update({ status: "rejected", decided_at: new Date().toISOString() })
      .eq("id", step.request_id);

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
      await syncWorkflowPayloadSideEffects(supabase, step.request_id, "rejected");
    }
  }
}

export async function remandWorkflowStep(stepId: string, comment?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("workflow_steps")
    .update({ status: "rejected", comment: comment || null, decided_at: new Date().toISOString() })
    .eq("id", stepId);
  if (error) throw error;

  const { data: step } = await supabase.from("workflow_steps").select("request_id").eq("id", stepId).single();
  if (step) {
    const { data: existing } = await supabase
      .from("workflow_requests")
      .select("payload")
      .eq("id", step.request_id)
      .single();

    const payload = {
      ...((existing?.payload ?? {}) as Record<string, unknown>),
      remand: true,
      remand_comment: comment ?? null,
      remanded_at: new Date().toISOString(),
    };

    await supabase
      .from("workflow_requests")
      .update({
        status: "rejected",
        decided_at: new Date().toISOString(),
        payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", step.request_id);

    await syncWorkflowPayloadSideEffects(supabase, step.request_id, "returned");

    const { data: request } = await supabase
      .from("workflow_requests")
      .select("company_id, requester_id, title, payload")
      .eq("id", step.request_id)
      .single();

    if (request) {
      const payload = (request.payload ?? {}) as Record<string, unknown>;
      const contractId = payload.contract_id as string | undefined;
      const estimateId = payload.estimate_id as string | undefined;
      const href = estimateId
        ? `/quotes/${estimateId}`
        : contractId
          ? `/contracts/${contractId}?tab=documents`
          : `/workflow/${step.request_id}`;

      const { notifySalesFlowUser } = await import("@/lib/actions/sales-flow");
      await notifySalesFlowUser(supabase, request.company_id, request.requester_id, {
        title: `差戻しされました: ${request.title}`,
        description: comment?.trim() || "内容を修正のうえ再申請してください",
        href,
        urgent: true,
      }, user.id);
    }
  }
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
  if (error) throw error;
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
  if (error) throw error;

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

export async function getWorkflowTypes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workflow_types")
    .select("*")
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return data;
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
  if (error) throw error;
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
  if (error) throw error;
}

export async function deleteWorkflowType(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("workflow_types").delete().eq("id", id);
  if (error) throw error;
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
