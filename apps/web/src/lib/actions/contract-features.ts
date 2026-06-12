"use server";

import { createClient } from "@/lib/supabase/server";
import { getCloudSignConfig, sendToCloudSign } from "@/lib/integrations/cloudsign";
import { createWorkflowRequest } from "@/lib/actions/workflow";
import { dispatchWebhook } from "@/lib/webhooks";
import { findTemplate } from "@/lib/contract-templates";

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

export type ContractMessagingContext = {
  customer: {
    id: string;
    name: string;
    email: string | null;
    line_user_id: string | null;
    slack_channel_id: string | null;
  } | null;
  company: {
    emailConnected: boolean;
    emailAddress: string | null;
    slackConnected: boolean;
    lineWorksConnected: boolean;
  };
  readiness: {
    line: "linked" | "needs_customer_line_id" | "needs_company_line";
    slack: "linked" | "needs_customer_channel" | "needs_company_slack";
    email: "linked" | "needs_customer_email" | "needs_mail_connect";
  };
};

async function getCompanyEmailConnection(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  companyId: string,
) {
  const { data: members } = await supabase
    .from("profiles")
    .select("id")
    .eq("company_id", companyId);
  const memberIds = (members ?? []).map((m) => m.id);
  if (memberIds.length === 0) return { connected: false, address: null as string | null };

  const { data: accounts } = await supabase
    .from("email_accounts")
    .select("email_address")
    .in("user_id", memberIds)
    .limit(1);
  return {
    connected: (accounts ?? []).length > 0,
    address: accounts?.[0]?.email_address ?? null,
  };
}

export async function getContractMessagingContext(contractId: string): Promise<ContractMessagingContext> {
  const { supabase, company_id, user_id } = await getCompanyContext();

  const { data: contract } = await supabase
    .from("contracts")
    .select("customer_id")
    .eq("id", contractId)
    .single();

  let customer: ContractMessagingContext["customer"] = null;
  if (contract?.customer_id) {
    const { data: row } = await supabase
      .from("customers")
      .select("id, name, email, line_user_id, slack_channel_id")
      .eq("id", contract.customer_id)
      .single();
    if (row) {
      customer = {
        id: row.id,
        name: row.name,
        email: row.email,
        line_user_id: row.line_user_id,
        slack_channel_id: row.slack_channel_id,
      };
    }
  }

  const { data: emailAccounts } = await supabase
    .from("email_accounts")
    .select("email_address")
    .eq("user_id", user_id)
    .limit(1);

  const companyEmail = await getCompanyEmailConnection(supabase, company_id);

  const { data: integrations } = await supabase
    .from("app_integrations")
    .select("provider, is_active")
    .eq("company_id", company_id)
    .eq("is_active", true);

  const activeProviders = new Set((integrations ?? []).map((i) => i.provider));
  const emailConnected = companyEmail.connected;

  const company = {
    emailConnected,
    emailAddress: companyEmail.address ?? emailAccounts?.[0]?.email_address ?? null,
    slackConnected: activeProviders.has("slack"),
    lineWorksConnected: activeProviders.has("line_works"),
  };

  const readiness: ContractMessagingContext["readiness"] = {
    line: !company.lineWorksConnected
      ? "needs_company_line"
      : customer?.line_user_id?.trim()
        ? "linked"
        : "needs_customer_line_id",
    slack: !company.slackConnected
      ? "needs_company_slack"
      : customer?.slack_channel_id?.trim()
        ? "linked"
        : "needs_customer_channel",
    email: !company.emailConnected
      ? "needs_mail_connect"
      : customer?.email?.trim()
        ? "linked"
        : "needs_customer_email",
  };

  return { customer, company, readiness };
}

export async function updateCustomerMessagingLinks(
  customerId: string,
  input: {
    email?: string | null;
    line_user_id?: string | null;
    slack_channel_id?: string | null;
  },
) {
  const { supabase } = await getCompanyContext();
  const patch: Record<string, string | null> = {};
  if (input.email !== undefined) patch.email = input.email?.trim() || null;
  if (input.line_user_id !== undefined) patch.line_user_id = input.line_user_id?.trim() || null;
  if (input.slack_channel_id !== undefined) patch.slack_channel_id = input.slack_channel_id?.trim() || null;

  const { data, error } = await supabase
    .from("customers")
    .update(patch)
    .eq("id", customerId)
    .select("id, name, email, line_user_id, slack_channel_id")
    .single();
  if (error) throw error;
  return data;
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

const DEMO_MESSAGES: Record<"line" | "slack" | "email", Array<{ direction: "inbound" | "outbound"; sender_name: string | null; body: string; hoursAgo: number }>> = {
  line: [
    { direction: "inbound", sender_name: "顧客", body: "お世話になっております。見積内容を確認しました。工期は3月中旬開始で合意です。", hoursAgo: 48 },
    { direction: "outbound", sender_name: "担当", body: "ありがとうございます。3/15開始で手配いたします。", hoursAgo: 47 },
    { direction: "inbound", sender_name: "顧客", body: "追加工事の見積15万円も了解しました。日程調整よろしくお願いします。", hoursAgo: 24 },
    { direction: "outbound", sender_name: "担当", body: "承知しました。追加工事分の契約書を別途お送りします。", hoursAgo: 23 },
  ],
  slack: [
    { direction: "inbound", sender_name: "顧客", body: "設計変更の件、平面図の修正版で問題ありません。来週火曜の打ち合わせで確定しましょう。", hoursAgo: 72 },
    { direction: "outbound", sender_name: "設計", body: "了解です。火曜10:00でTeamsリンクを共有します。", hoursAgo: 70 },
    { direction: "inbound", sender_name: "顧客", body: "内装仕様はAプラン、設備はBプランで合意です。", hoursAgo: 30 },
  ],
  email: [
    { direction: "inbound", sender_name: "顧客", body: "見積書を拝見しました。総額1,850万円（税込）で了承いたします。契約書送付をお願いします。", hoursAgo: 96 },
    { direction: "outbound", sender_name: "営業", body: "ありがとうございます。契約書ドラフトを本日中にお送りします。", hoursAgo: 95 },
    { direction: "inbound", sender_name: "顧客", body: "着工日は4/1、完成希望は9月末で承知しました。", hoursAgo: 12 },
  ],
};

/** プラットフォームからやり取り履歴を取得し、AIで合意事項を抽出（プロトタイプ: デモデータ + ヒューリスティック） */
export async function syncContractPlatformMessages(contractId: string, platform: "line" | "slack" | "email") {
  const { supabase, company_id } = await getCompanyContext();
  const { extractCommunicationAgreements } = await import("@/lib/integrations/linq-ai");

  const { data: existing, error: fetchError } = await supabase
    .from("contract_communications")
    .select("*")
    .eq("contract_id", contractId)
    .eq("platform", platform)
    .order("sent_at", { ascending: true });
  if (fetchError) throw fetchError;

  let rows = existing ?? [];

  if (rows.length === 0) {
    const now = Date.now();
    const seeds = DEMO_MESSAGES[platform].map((m) => ({
      company_id,
      contract_id: contractId,
      platform,
      direction: m.direction,
      sender_name: m.sender_name,
      body: m.body,
      sent_at: new Date(now - m.hoursAgo * 3600_000).toISOString(),
    }));
    const { data: inserted, error: insertError } = await supabase
      .from("contract_communications")
      .insert(seeds)
      .select();
    if (insertError) throw insertError;
    rows = inserted ?? [];
  }

  const candidates = rows.filter((r) => r.direction === "inbound" && !r.is_important);
  const { items, source } = await extractCommunicationAgreements(
    candidates.map((r) => ({ id: r.id, body: r.body })),
  );

  for (const item of items) {
    await supabase
      .from("contract_communications")
      .update({
        is_important: true,
        agreement_status: "pending",
        body: item.summary,
      })
      .eq("id", item.messageId);
  }

  const { data: refreshed, error: refreshError } = await supabase
    .from("contract_communications")
    .select("*")
    .eq("contract_id", contractId)
    .order("sent_at", { ascending: false });
  if (refreshError) throw refreshError;

  return {
    messages: refreshed ?? [],
    extractedCount: items.length,
    analysisSource: source,
  };
}

/** 全プラットフォームのデモ履歴を投入し、合意事項を抽出（初回プレビュー用） */
export async function seedContractMessagingDemo(contractId: string) {
  const platforms = ["line", "slack", "email"] as const;
  let extractedCount = 0;
  let messages: Awaited<ReturnType<typeof getContractCommunications>> = [];

  for (const platform of platforms) {
    const result = await syncContractPlatformMessages(contractId, platform);
    extractedCount += result.extractedCount;
    messages = result.messages;
  }

  return { messages, extractedCount };
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

export async function getContractWorkflowRequests(contractId: string) {
  const { supabase, company_id } = await getCompanyContext();
  const { data, error } = await supabase
    .from("workflow_requests")
    .select("*, requester:profiles!workflow_requests_requester_id_fkey(id, display_name), workflow_type:workflow_types!workflow_requests_type_id_fkey(id, key, name)")
    .eq("company_id", company_id)
    .contains("payload", { contract_id: contractId })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function submitContractWorkflow(contractId: string, title: string, workflowTypeKey = "contract_08") {
  const { supabase, company_id, user_id } = await getCompanyContext();

  const { data: contract } = await supabase
    .from("contracts")
    .select("notes, amount, title, customer:customers(name)")
    .eq("id", contractId)
    .eq("company_id", company_id)
    .single();
  if (!contract) throw new Error("契約が見つかりません");

  type ContractDraft = { template_id: string; form: Record<string, string | number> };
  let draft: ContractDraft | null = null;
  if (contract.notes) {
    try {
      const parsed = JSON.parse(contract.notes) as { contract_draft?: ContractDraft };
      draft = parsed.contract_draft ?? null;
    } catch {
      // plain text notes
    }
  }

  const form = draft?.form ?? {};
  const template = draft?.template_id ? findTemplate(draft.template_id) : null;
  const excl = Number(form.amount_excl_tax) || 0;
  const taxRate = Number(form.tax_rate) || 10;
  const computedAmount = excl > 0 ? excl + Math.floor(excl * taxRate / 100) : (contract.amount ?? null);
  const customerName = (contract.customer as { name?: string } | null)?.name;

  const payload: Record<string, unknown> = {
    contract_id: contractId,
    template_id: draft?.template_id ?? null,
    contract_draft: draft,
    契約書: template?.name ?? contract.title ?? title,
    発注者: form.kou_name ?? customerName ?? "",
    工事名称: form.work_name ?? contract.title ?? title,
  };
  if (form.start_date || form.end_date) {
    payload.工期 = `${form.start_date ?? "—"} ～ ${form.end_date ?? "—"}`;
  }
  if (excl > 0) {
    payload["契約金額（税抜）"] = `¥${excl.toLocaleString()}`;
  }

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
    amount: computedAmount ?? undefined,
    payload,
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
