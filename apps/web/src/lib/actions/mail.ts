"use server";

import { createClient } from "@/lib/supabase/server";

export async function getGmailAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("email_accounts")
    .select("id, email_address, last_sync_at, token_expires_at")
    .eq("user_id", user.id)
    .eq("provider", "gmail")
    .single();

  return data ?? null;
}

export async function disconnectGmailAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("email_accounts")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", "gmail");

  if (error) throw error;
}

export async function getEmailThreads(folder?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  let query = supabase
    .from("email_threads")
    .select("*, account:email_accounts!email_threads_account_id_fkey(id, email_address)")
    .order("last_message_at", { ascending: false });

  if (folder === "starred") {
    query = query.eq("is_starred", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getEmailThread(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_threads")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;

  const { data: messages } = await supabase
    .from("email_messages")
    .select("*")
    .eq("thread_id", id)
    .order("received_at");

  return { ...data, messages: messages || [] };
}

export async function markThreadRead(id: string) {
  const supabase = await createClient();
  await supabase.from("email_threads").update({ is_read: true }).eq("id", id);
}

export async function toggleThreadStar(id: string, starred: boolean) {
  const supabase = await createClient();
  await supabase.from("email_threads").update({ is_starred: starred }).eq("id", id);
}

export async function sendEmail(input: {
  to: Array<{ name?: string; address: string }>;
  cc?: Array<{ name?: string; address: string }>;
  subject: string;
  body_text: string;
  body_html?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  // Get user's email account
  const { data: account } = await supabase
    .from("email_accounts")
    .select("id, email_address")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!account) throw new Error("No email account configured");

  // Create thread
  const { data: thread, error: threadError } = await supabase
    .from("email_threads")
    .insert({
      company_id: profile.company_id,
      account_id: account.id,
      subject: input.subject,
      snippet: input.body_text.substring(0, 200),
      is_read: true,
      last_message_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (threadError) throw threadError;

  // Create message
  const { error: msgError } = await supabase
    .from("email_messages")
    .insert({
      company_id: profile.company_id,
      thread_id: thread.id,
      from_address: account.email_address,
      from_name: profile.company_id, // Will be resolved from profile
      to_addresses: input.to,
      cc_addresses: input.cc || [],
      subject: input.subject,
      body_text: input.body_text,
      body_html: input.body_html || null,
      direction: "outbound",
      received_at: new Date().toISOString(),
    });
  if (msgError) throw msgError;

  return thread;
}
