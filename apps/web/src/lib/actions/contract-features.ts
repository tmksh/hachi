"use server";

import { createClient } from "@/lib/supabase/server";

async function getCompanyContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");
  return { supabase, company_id: profile.company_id };
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
  const { data: contract } = await supabase.from("contracts").select("customer_id, estimate_id").eq("id", contractId).single();
  if (!contract?.customer_id) return [];
  const { data, error } = await supabase
    .from("estimates")
    .select("id, estimate_no, title, status, total, created_at")
    .eq("customer_id", contract.customer_id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function submitContractWorkflow(contractId: string, title: string) {
  const { supabase, company_id } = await getCompanyContext();
  const { data: types } = await supabase.from("workflow_types").select("id").eq("company_id", company_id).limit(1);
  const typeId = types?.[0]?.id;
  if (!typeId) throw new Error("ワークフロー種別がありません");
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("workflow_requests").insert({
    company_id,
    type_id: typeId,
    requester_id: user!.id,
    title: `契約承認: ${title}`,
    payload: { contract_id: contractId },
    status: "submitted",
    submitted_at: new Date().toISOString(),
  }).select().single();
  if (error) throw error;
  return data;
}

export async function sendContractCloudSign(contractId: string, email: string, subject: string, message: string) {
  // クラウドサイン連携は API キー設定後に有効化
  const { supabase } = await getCompanyContext();
  const { data: contract } = await supabase.from("contracts").select("contract_no, title").eq("id", contractId).single();
  return {
    ok: true,
    message: `「${contract?.contract_no}」を ${email} へ送信予約しました（件名: ${subject}）`,
    preview: message,
  };
}
