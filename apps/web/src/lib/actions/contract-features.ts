"use server";

import { createClient } from "@/lib/supabase/server";
import { getCloudSignConfig, sendToCloudSign } from "@/lib/integrations/cloudsign";
import { createWorkflowRequest } from "@/lib/actions/workflow";
import { dispatchWebhook } from "@/lib/webhooks";

const AUTHOR_NOTE_PREFIX = "作成者:";

function buildAuthorNotes(createdByName?: string, existingNotes?: string | null): string | null {
  const name = createdByName?.trim();
  if (!name) return existingNotes ?? null;
  const authorLine = `${AUTHOR_NOTE_PREFIX} ${name}`;
  const stripped = existingNotes?.replace(new RegExp(`^${AUTHOR_NOTE_PREFIX}\\s*.+?\\n?`), "").trim();
  if (!stripped) return authorLine;
  return `${authorLine}\n${stripped}`;
}

type AssigneeShape = { display_name?: string | null } | null | undefined;

function pickAssignee(assignee: AssigneeShape | AssigneeShape[]): AssigneeShape {
  if (Array.isArray(assignee)) return assignee[0] ?? null;
  return assignee;
}

function resolveEstimateAuthor(est: {
  created_by_name?: string | null;
  notes?: string | null;
  assignee?: AssigneeShape | AssigneeShape[];
}): string | null {
  if (est.created_by_name?.trim()) return est.created_by_name.trim();
  const match = est.notes?.match(new RegExp(`^${AUTHOR_NOTE_PREFIX}\\s*(.+?)(?:\\n|$)`));
  if (match?.[1]) return match[1].trim();
  return pickAssignee(est.assignee)?.display_name ?? null;
}

function parseEstimateSequence(estimateNo: string): number {
  const match = estimateNo.match(/^EST-(?:\d{4}-)?(\d+)$/i);
  return match ? parseInt(match[1], 10) : 0;
}

function throwIfSupabaseError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

async function nextEstimateNo(supabase: Awaited<ReturnType<typeof createClient>>, companyId: string) {
  const { data, error } = await supabase
    .from("estimates")
    .select("estimate_no")
    .eq("company_id", companyId);
  throwIfSupabaseError(error);

  const max = (data ?? []).reduce((current, row) => {
    return Math.max(current, parseEstimateSequence(row.estimate_no));
  }, 0);
  return `EST-${String(max + 1).padStart(4, "0")}`;
}

async function getCompanyContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");
  return { supabase, company_id: profile.company_id, user_id: user.id };
}

async function resolveDefaultApprovalApprovers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
): Promise<string[]> {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("company_id", companyId);

  const roleOrder = ["admin", "field_manager", "contractor_admin", "hq_admin", "executive"] as const;
  const ids: string[] = [];
  for (const role of roleOrder) {
    const match = profiles?.find((p) => p.role === role);
    if (match && !ids.includes(match.id)) ids.push(match.id);
    if (ids.length >= 3) break;
  }
  if (ids.length === 0 && profiles?.[0]) ids.push(profiles[0].id);
  return ids;
}

export async function getContractCommunications(contractId: string) {
  const { supabase } = await getCompanyContext();
  const { data, error } = await supabase
    .from("contract_communications")
    .select("*")
    .eq("contract_id", contractId)
    .order("sent_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addContractCommunication(input: {
  contract_id: string;
  platform: "line" | "slack" | "email";
  direction?: "inbound" | "outbound";
  sender_name?: string;
  body: string;
  is_important?: boolean;
}) {
  const { supabase, company_id } = await getCompanyContext();
  const { data, error } = await supabase.from("contract_communications").insert({
    company_id,
    contract_id: input.contract_id,
    platform: input.platform,
    direction: input.direction ?? "outbound",
    sender_name: input.sender_name ?? null,
    body: input.body,
    is_important: input.is_important ?? false,
    agreement_status: input.is_important ? "pending" : null,
    sent_at: new Date().toISOString(),
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateCommunicationAgreementStatus(id: string, agreement_status: "pending" | "addressed") {
  const { supabase } = await getCompanyContext();
  const { data, error } = await supabase.from("contract_communications").update({ agreement_status }).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function getContractPostSignInfo(contractId: string) {
  const { supabase } = await getCompanyContext();
  const { data, error } = await supabase
    .from("contract_post_sign_info")
    .select("*")
    .eq("contract_id", contractId)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function saveContractPostSignInfo(contractId: string, items: { label: string; value: string; category?: string }[]) {
  const { supabase, company_id } = await getCompanyContext();
  await supabase.from("contract_post_sign_info").delete().eq("contract_id", contractId);
  if (items.length === 0) return [];
  const { data, error } = await supabase.from("contract_post_sign_info").insert(
    items.map((i) => ({ company_id, contract_id: contractId, label: i.label, value: i.value, category: i.category ?? "general" }))
  ).select();
  if (error) throw error;
  return data ?? [];
}

export async function getContractDocuments(contractId: string) {
  const { supabase } = await getCompanyContext();
  const { data: contract } = await supabase.from("contracts").select("customer_id").eq("id", contractId).single();
  if (!contract?.customer_id) return [];
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("customer_id", contract.customer_id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getContractEstimates(contractId: string) {
  const { supabase } = await getCompanyContext();
  const { data: contract } = await supabase
    .from("contracts")
    .select("customer_id, estimate_id")
    .eq("id", contractId)
    .single();
  if (!contract?.customer_id) return [];

  const { data, error } = await supabase
    .from("estimates")
    .select(
      "id, estimate_no, title, status, total, subtotal, gross_profit_rate, version, construction_id, created_at, updated_at, notes, assignee:profiles!estimates_assigned_to_fkey(id, display_name)",
    )
    .eq("customer_id", contract.customer_id)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []).map((row) => ({
    ...row,
    created_by_name: resolveEstimateAuthor(row),
  }));

  if (contract.estimate_id && !rows.some((r) => r.id === contract.estimate_id)) {
    const { data: linked } = await supabase
      .from("estimates")
      .select(
        "id, estimate_no, title, status, total, subtotal, gross_profit_rate, version, construction_id, created_at, updated_at, notes, assignee:profiles!estimates_assigned_to_fkey(id, display_name)",
      )
      .eq("id", contract.estimate_id)
      .maybeSingle();
    if (linked) {
      rows.unshift({ ...linked, created_by_name: resolveEstimateAuthor(linked) });
    }
  }

  return rows;
}

export async function createEmptyEstimateForContract(contractId: string, title: string, createdByName?: string) {
  const { supabase, company_id } = await getCompanyContext();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: contract } = await supabase
    .from("contracts")
    .select("customer_id")
    .eq("id", contractId)
    .single();
  if (!contract?.customer_id) throw new Error("Contract not found");

  const estimateNo = await nextEstimateNo(supabase, company_id);

  const { data: existingVersions } = await supabase
    .from("estimates")
    .select("version")
    .eq("customer_id", contract.customer_id)
    .is("construction_id", null)
    .order("version", { ascending: false })
    .limit(1);
  const nextVersion = (existingVersions?.[0]?.version ?? 0) + 1;

  const { data: estimate, error } = await supabase
    .from("estimates")
    .insert({
      company_id,
      customer_id: contract.customer_id,
      construction_id: null,
      estimate_no: estimateNo,
      title,
      status: "draft",
      version: nextVersion,
      subtotal: 0,
      tax: 0,
      total: 0,
      cost_total: 0,
      gross_profit: 0,
      gross_profit_rate: 0,
      assigned_to: user.id,
      notes: buildAuthorNotes(createdByName),
    })
    .select()
    .single();
  throwIfSupabaseError(error);
  return estimate;
}

export async function copyEstimateForContract(
  contractId: string,
  sourceEstimateId: string,
  title: string,
  createdByName?: string,
) {
  const { supabase, company_id } = await getCompanyContext();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: contract } = await supabase
    .from("contracts")
    .select("customer_id")
    .eq("id", contractId)
    .single();
  if (!contract?.customer_id) throw new Error("Contract not found");

  const { data: source, error: sourceError } = await supabase
    .from("estimates")
    .select("*, categories:estimate_categories(*), items:estimate_items(*)")
    .eq("id", sourceEstimateId)
    .single();
  throwIfSupabaseError(sourceError);
  if (!source) throw new Error("Source estimate not found");

  const estimateNo = await nextEstimateNo(supabase, company_id);

  const { data: existingVersions } = await supabase
    .from("estimates")
    .select("version")
    .eq("customer_id", contract.customer_id)
    .is("construction_id", null)
    .order("version", { ascending: false })
    .limit(1);
  const nextVersion = (existingVersions?.[0]?.version ?? 0) + 1;

  const { data: newEstimate, error } = await supabase
    .from("estimates")
    .insert({
      company_id,
      customer_id: contract.customer_id,
      construction_id: null,
      estimate_no: estimateNo,
      title,
      status: "draft",
      version: nextVersion,
      subtotal: source.subtotal,
      tax: source.tax,
      total: source.total,
      cost_total: source.cost_total,
      gross_profit: source.gross_profit,
      gross_profit_rate: source.gross_profit_rate,
      notes: buildAuthorNotes(createdByName, source.notes),
      assigned_to: user.id,
    })
    .select()
    .single();
  throwIfSupabaseError(error);

  const categoryMap = new Map<string, string>();
  for (const cat of source.categories ?? []) {
    const { data: newCat, error: catError } = await supabase
      .from("estimate_categories")
      .insert({
        company_id,
        estimate_id: newEstimate.id,
        name: cat.name,
        sort_order: cat.sort_order,
      })
      .select()
      .single();
    throwIfSupabaseError(catError);
    if (newCat) categoryMap.set(cat.id, newCat.id);
  }

  if (source.items?.length) {
    const { error: itemsError } = await supabase.from("estimate_items").insert(
      source.items.map((item: Record<string, unknown>, index: number) => ({
        company_id,
        estimate_id: newEstimate.id,
        category_id: item.category_id ? categoryMap.get(String(item.category_id)) ?? null : null,
        name: item.name,
        description: item.description,
        specification: item.specification,
        quantity: item.quantity,
        unit: item.unit,
        cost_price: item.cost_price,
        cost_amount: item.cost_amount,
        selling_price: item.selling_price,
        selling_amount: item.selling_amount,
        gross_profit: item.gross_profit,
        gross_profit_rate: item.gross_profit_rate,
        sort_order: (item.sort_order as number | undefined) ?? index,
        notes: item.notes,
      })),
    );
    throwIfSupabaseError(itemsError);
  }

  return newEstimate;
}

export async function submitContractWorkflow(contractId: string, title: string, workflowTypeKey = "contract_08") {
  const { supabase, company_id, user_id } = await getCompanyContext();
  const { data: wfType } = await supabase
    .from("workflow_types")
    .select("id, approval_route")
    .eq("company_id", company_id)
    .eq("key", workflowTypeKey)
    .maybeSingle();

  const fallback = wfType
    ? null
    : (await supabase.from("workflow_types").select("id, approval_route").eq("company_id", company_id).limit(1).maybeSingle()).data;

  const type = wfType ?? fallback;
  if (!type) throw new Error("ワークフロー種別がありません");

  const approvalRoute = (type.approval_route ?? []) as Array<{ approver_id: string; step_order?: number }>;
  let approverIds = approvalRoute.length > 0
    ? approvalRoute.sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0)).map((s) => s.approver_id)
    : await resolveDefaultApprovalApprovers(supabase, company_id);

  const request = await createWorkflowRequest({
    type_id: type.id,
    title: `契約承認: ${title}`,
    payload: { contract_id: contractId },
    approver_ids: approverIds,
  });

  const { notifySalesFlowUser } = await import("@/lib/actions/sales-flow");
  for (const approverId of approverIds) {
    await notifySalesFlowUser(supabase, company_id, approverId, {
      title: `契約承認依頼: ${title}`,
      description: "契約書の社内承認をお願いします",
      href: `/workflow/${request.id}`,
      urgent: true,
    }, user_id);
  }

  void dispatchWebhook(company_id, "contract.workflow_submitted", {
    contract_id: contractId,
    workflow_request_id: request.id,
  });

  return request;
}

export async function sendContractCloudSign(contractId: string, email: string, subject: string, message: string) {
  const { supabase, company_id } = await getCompanyContext();
  const { data: company } = await supabase.from("companies").select("settings").eq("id", company_id).single();
  const config = getCloudSignConfig(company?.settings as Record<string, unknown>);

  const { data: contract } = await supabase
    .from("contracts")
    .select("contract_no, title, customer:customers(name)")
    .eq("id", contractId)
    .single();
  if (!contract) throw new Error("契約が見つかりません");

  const customerName = (contract.customer as { name?: string })?.name ?? "ご担当者";

  const result = await sendToCloudSign(config, {
    title: contract.title,
    signers: [{ name: customerName, email, order: 1 }],
    metadata: { contract_id: contractId, subject, message },
  });

  await supabase.from("contracts").update({
    cloudsign_document_id: result.document_id,
    cloudsign_status: result.status,
    cloudsign_sent_at: result.status === "sent" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", contractId);

  await supabase.from("contract_communications").insert({
    company_id,
    contract_id: contractId,
    platform: "email",
    direction: "outbound",
    sender_name: "CloudSign",
    body: `[${subject}]\n${message}`,
    sent_at: new Date().toISOString(),
  }).then(() => {}, () => {});

  void dispatchWebhook(company_id, "contract.cloudsign_sent", {
    contract_id: contractId,
    document_id: result.document_id,
    status: result.status,
  });

  return {
    ok: true,
    message: result.message,
    documentId: result.document_id,
    preview: message,
  };
}
