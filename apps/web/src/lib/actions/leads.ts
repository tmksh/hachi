"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createCustomer } from "@/lib/actions/customers";
import { tokyoDateString } from "@/lib/tokyo-date";
import type { InboundLead } from "@/lib/database.types";

async function getCompanyContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("Profile not found");
  return { supabase, company_id: profile.company_id, user_id: user.id };
}

export type InboundLeadInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  inquiry_category?: string | null;
  inquiry_content?: string | null;
  notes?: string | null;
  assigned_to?: string | null;
};

export async function getInboundLeads(status?: string): Promise<InboundLead[]> {
  const { supabase, company_id } = await getCompanyContext();
  let query = supabase
    .from("inbound_leads")
    .select("*")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    // マイグレーション未適用時は空配列で落とさない
    if (error.code === "42P01" || /inbound_leads|does not exist|schema cache/i.test(error.message ?? "")) {
      console.warn("[leads] inbound_leads unavailable:", error.message);
      return [];
    }
    throw error;
  }
  return (data ?? []) as InboundLead[];
}

export async function createInboundLead(input: InboundLeadInput): Promise<InboundLead> {
  const { supabase, company_id, user_id } = await getCompanyContext();
  if (!input.name?.trim()) throw new Error("名前は必須です");

  const { data, error } = await supabase
    .from("inbound_leads")
    .insert({
      company_id,
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      source: input.source?.trim() || "manual",
      inquiry_category: input.inquiry_category?.trim() || null,
      inquiry_content: input.inquiry_content?.trim() || null,
      notes: input.notes?.trim() || null,
      assigned_to: input.assigned_to || user_id,
      status: "new",
    })
    .select("*")
    .single();
  if (error) throw error;

  revalidatePath("/leads");
  return data as InboundLead;
}

/** 画面から自動取り込み相当のテストデータを登録（ターミナル不要） */
export async function createTestInboundLead(): Promise<InboundLead> {
  const stamp = new Date().toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const unique = Date.now();
  return createInboundLead({
    name: `Webhook検証 ${stamp}`,
    email: `webhook-test-${unique}@example.com`,
    phone: `090${String(unique).slice(-8)}`,
    source: "web",
    inquiry_category: "検証",
    inquiry_content: "画面の「テスト取り込み」から登録した自動取り込み検証用データです。",
  });
}

export async function updateInboundLeadStatus(
  id: string,
  status: InboundLead["status"],
): Promise<void> {
  const { supabase, company_id } = await getCompanyContext();
  const { error } = await supabase
    .from("inbound_leads")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", company_id);
  if (error) throw error;
  revalidatePath("/leads");
}

/** リードを顧客・商談（問い合わせステージ）へ変換 */
export async function convertInboundLeadToCustomer(id: string): Promise<{
  customerId: string;
  dealId?: string;
}> {
  const { supabase, company_id, user_id } = await getCompanyContext();

  const { data: lead, error: leadErr } = await supabase
    .from("inbound_leads")
    .select("*")
    .eq("id", id)
    .eq("company_id", company_id)
    .single();
  if (leadErr || !lead) throw new Error("リードが見つかりません");
  if (lead.status === "converted" && lead.customer_id) {
    return { customerId: lead.customer_id, dealId: lead.deal_id ?? undefined };
  }

  const customer = await createCustomer({
    name: lead.name,
    company_name: null,
    email: lead.email,
    phone: lead.phone,
    address: null,
    source: lead.source,
    status: "active",
    assigned_to: lead.assigned_to ?? user_id,
    budget_min: null,
    budget_max: null,
    ai_score: null,
    tags: [],
    notes: lead.notes,
    eight_id: null,
    customer_type: "individual",
    department: null,
    age: null,
    inquiry_category: lead.inquiry_category,
    inquiry_date: tokyoDateString(new Date(lead.created_at)),
    inquiry_content: lead.inquiry_content,
    custom_fields: {},
    line_user_id: null,
    slack_channel_id: null,
    prospect_grade: null,
    is_special_demand: false,
    special_probability: null,
  }, { skipDedupe: true });

  let dealId: string | undefined;
  const { data: deal } = await supabase
    .from("deals")
    .select("id")
    .eq("customer_id", customer.id)
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (deal) {
    dealId = deal.id;
  } else {
    const { data: createdDeal, error: dealErr } = await supabase
      .from("deals")
      .insert({
        company_id,
        customer_id: customer.id,
        title: `${lead.name} 様 問い合わせ`,
        stage: "inquiry",
        assigned_to: lead.assigned_to ?? user_id,
      })
      .select("id")
      .single();
    if (dealErr) throw dealErr;
    dealId = createdDeal.id;
  }

  const { error: updErr } = await supabase
    .from("inbound_leads")
    .update({
      status: "converted",
      customer_id: customer.id,
      deal_id: dealId ?? null,
      converted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("company_id", company_id);
  if (updErr) throw updErr;

  revalidatePath("/leads");
  revalidatePath("/crm");
  return { customerId: customer.id, dealId };
}

export async function discardInboundLead(id: string): Promise<void> {
  await updateInboundLeadStatus(id, "discarded");
}

export type InboundWebhookPublicConfig = {
  enabled: boolean;
  token: string | null;
  secret_prefix: string | null;
  path: string | null;
  created_at: string | null;
  rotated_at: string | null;
  canManage: boolean;
};

async function getLeadAdminContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("Profile not found");
  return { supabase, company_id: profile.company_id, user_id: user.id, role: profile.role as string };
}

export async function getInboundWebhookConfig(): Promise<InboundWebhookPublicConfig> {
  const { supabase, company_id, role } = await getLeadAdminContext();
  const canManage = ["hq_admin", "admin", "contractor_admin"].includes(role);
  const { data: company } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", company_id)
    .single();

  const { readInboundWebhookSettings } = await import("@/lib/inbound-leads");
  const cfg = readInboundWebhookSettings(company?.settings as Record<string, unknown>);
  if (!cfg) {
    return {
      enabled: false,
      token: null,
      secret_prefix: null,
      path: null,
      created_at: null,
      rotated_at: null,
      canManage,
    };
  }
  return {
    enabled: cfg.enabled,
    token: cfg.token,
    secret_prefix: cfg.secret_prefix,
    path: `/api/webhooks/inbound-leads/${cfg.token}`,
    created_at: cfg.created_at ?? null,
    rotated_at: cfg.rotated_at ?? null,
    canManage,
  };
}

/** Webhook を有効化（未作成なら発行）。シークレットは今回のみ返却 */
export async function enableInboundWebhook(): Promise<{
  path: string;
  secret: string;
  secret_prefix: string;
}> {
  const { supabase, company_id, role } = await getLeadAdminContext();
  if (!["hq_admin", "admin", "contractor_admin"].includes(role)) {
    throw new Error("権限がありません");
  }

  const { data: company } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", company_id)
    .single();
  const settings = (company?.settings ?? {}) as Record<string, unknown>;
  const { generateInboundWebhookCredentials, readInboundWebhookSettings } = await import("@/lib/inbound-leads");
  const existing = readInboundWebhookSettings(settings);

  let secret: string;
  let token: string;
  let secret_hash: string;
  let secret_prefix: string;
  const now = new Date().toISOString();

  if (existing) {
    // 既存トークンを維持したまま有効化（シークレットは再発行しない）
    token = existing.token;
    secret_hash = existing.secret_hash;
    secret_prefix = existing.secret_prefix;
    secret = ""; // 再表示不可
    const nextSettings = {
      ...settings,
      inbound_webhook: {
        ...existing,
        enabled: true,
      },
    };
    const { error } = await supabase
      .from("companies")
      .update({ settings: nextSettings })
      .eq("id", company_id);
    if (error) throw error;
    return { path: `/api/webhooks/inbound-leads/${token}`, secret, secret_prefix };
  }

  const creds = generateInboundWebhookCredentials();
  token = creds.token;
  secret = creds.secret;
  secret_hash = creds.secret_hash;
  secret_prefix = creds.secret_prefix;

  const { error } = await supabase
    .from("companies")
    .update({
      settings: {
        ...settings,
        inbound_webhook: {
          enabled: true,
          token,
          secret_hash,
          secret_prefix,
          created_at: now,
          rotated_at: now,
        },
      },
    })
    .eq("id", company_id);
  if (error) throw error;

  revalidatePath("/leads");
  return { path: `/api/webhooks/inbound-leads/${token}`, secret, secret_prefix };
}

export async function rotateInboundWebhookSecret(): Promise<{
  path: string;
  secret: string;
  secret_prefix: string;
}> {
  const { supabase, company_id, role } = await getLeadAdminContext();
  if (!["hq_admin", "admin", "contractor_admin"].includes(role)) {
    throw new Error("権限がありません");
  }

  const { data: company } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", company_id)
    .single();
  const settings = (company?.settings ?? {}) as Record<string, unknown>;
  const { generateInboundWebhookCredentials, readInboundWebhookSettings } = await import("@/lib/inbound-leads");
  const existing = readInboundWebhookSettings(settings);
  const creds = generateInboundWebhookCredentials();
  const now = new Date().toISOString();
  // URL（token）は維持し、シークレットだけ再発行
  const token = existing?.token ?? creds.token;

  const { error } = await supabase
    .from("companies")
    .update({
      settings: {
        ...settings,
        inbound_webhook: {
          enabled: true,
          token,
          secret_hash: creds.secret_hash,
          secret_prefix: creds.secret_prefix,
          created_at: existing?.created_at ?? now,
          rotated_at: now,
        },
      },
    })
    .eq("id", company_id);
  if (error) throw error;

  revalidatePath("/leads");
  return {
    path: `/api/webhooks/inbound-leads/${token}`,
    secret: creds.secret,
    secret_prefix: creds.secret_prefix,
  };
}

export async function disableInboundWebhook(): Promise<void> {
  const { supabase, company_id, role } = await getLeadAdminContext();
  if (!["hq_admin", "admin", "contractor_admin"].includes(role)) {
    throw new Error("権限がありません");
  }
  const { data: company } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", company_id)
    .single();
  const settings = (company?.settings ?? {}) as Record<string, unknown>;
  const { readInboundWebhookSettings } = await import("@/lib/inbound-leads");
  const existing = readInboundWebhookSettings(settings);
  if (!existing) return;

  const { error } = await supabase
    .from("companies")
    .update({
      settings: {
        ...settings,
        inbound_webhook: { ...existing, enabled: false },
      },
    })
    .eq("id", company_id);
  if (error) throw error;
  revalidatePath("/leads");
}
