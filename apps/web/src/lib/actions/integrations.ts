"use server";

import { createClient } from "@/lib/supabase/server";
import { generateApiKey } from "@/lib/api-auth";

async function getAdminContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("認証が必要です");
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "hq_admin") {
    throw new Error("権限がありません");
  }
  return { supabase, company_id: profile.company_id, user_id: user.id };
}

export async function getApiKeys() {
  const { supabase, company_id } = await getAdminContext();
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, scopes, is_active, last_used_at, created_at")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createApiKey(name: string, scopes: string[] = ["read"]) {
  const { supabase, company_id, user_id } = await getAdminContext();
  const { rawKey, prefix, hash } = generateApiKey();
  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      company_id,
      name: name.trim(),
      key_hash: hash,
      key_prefix: prefix,
      scopes,
      created_by: user_id,
    })
    .select("id, name, key_prefix, scopes, created_at")
    .single();
  if (error) throw error;
  return { ...data, rawKey };
}

export async function revokeApiKey(id: string) {
  const { supabase, company_id } = await getAdminContext();
  const { error } = await supabase
    .from("api_keys")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", company_id);
  if (error) throw error;
}

export async function getWebhookEndpoints() {
  const { supabase, company_id } = await getAdminContext();
  const { data, error } = await supabase
    .from("webhook_endpoints")
    .select("id, url, events, is_active, description, created_at")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createWebhookEndpoint(input: {
  url: string;
  events: string[];
  description?: string;
}) {
  const { supabase, company_id, user_id } = await getAdminContext();
  const secretBytes = crypto.getRandomValues(new Uint8Array(32));
  const secret = Array.from(secretBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const { data, error } = await supabase
    .from("webhook_endpoints")
    .insert({
      company_id,
      url: input.url.trim(),
      secret,
      events: input.events,
      description: input.description?.trim() || null,
      created_by: user_id,
    })
    .select("id, url, events, description, created_at")
    .single();
  if (error) throw error;
  return { ...data, secret };
}

export async function deleteWebhookEndpoint(id: string) {
  const { supabase, company_id } = await getAdminContext();
  const { error } = await supabase
    .from("webhook_endpoints")
    .delete()
    .eq("id", id)
    .eq("company_id", company_id);
  if (error) throw error;
}

export async function getWebhookLogs(limit = 20) {
  const { supabase, company_id } = await getAdminContext();
  const { data, error } = await supabase
    .from("webhook_logs")
    .select("id, event, success, response_status, created_at, endpoint_id")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
