"use server";

import { createClient } from "@/lib/supabase/server";

export type MailProvider = "gmail" | "imap" | "forward";

export type EmailAccount = {
  id: string;
  provider: MailProvider;
  email_address: string;
  display_name: string | null;
  last_sync_at: string | null;
  token_expires_at: string | null;
  forward_address: string | null;
};

export async function getEmailAccounts(): Promise<EmailAccount[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("email_accounts")
    .select("id, provider, email_address, display_name, last_sync_at, token_expires_at, forward_address")
    .eq("user_id", user.id)
    .order("created_at");

  return (data ?? []) as EmailAccount[];
}

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

export async function disconnectEmailAccount(provider: MailProvider) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("email_accounts")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", provider);

  if (error) throw error;
}

/** 後方互換 */
export async function disconnectGmailAccount() {
  return disconnectEmailAccount("gmail");
}

export async function getEmailThreads(folder?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  let query = supabase
    .from("email_threads")
    .select("*, account:email_accounts!email_threads_account_id_fkey(id, email_address, provider)")
    .order("last_message_at", { ascending: false })
    .limit(200);

  if (folder === "starred") {
    query = query.eq("is_starred", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getEmailThread(id: string) {
  const supabase = await createClient();
  const [threadRes, messagesRes] = await Promise.all([
    supabase.from("email_threads").select("*").eq("id", id).single(),
    supabase
      .from("email_messages")
      .select("*")
      .eq("thread_id", id)
      .order("received_at"),
  ]);
  if (threadRes.error) throw threadRes.error;
  return { ...threadRes.data, messages: messagesRes.data || [] };
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, display_name")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("Profile not found");

  if (!input.to.length || !input.to.some((t) => t.address.trim())) {
    throw new Error("宛先を入力してください");
  }

  // 実Gmail API へ送信（DBへの擬似送信だけで「送信しました」にしない）
  const { sendViaGmailAccount } = await import("@/lib/gmail-send");
  const sent = await sendViaGmailAccount({
    userId: user.id,
    to: input.to,
    cc: input.cc,
    subject: input.subject,
    bodyText: input.body_text,
    bodyHtml: input.body_html,
  });

  const { data: thread, error: threadError } = await supabase
    .from("email_threads")
    .insert({
      company_id: profile.company_id,
      account_id: sent.accountId,
      subject: input.subject,
      snippet: input.body_text.substring(0, 200),
      is_read: true,
      last_message_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (threadError) throw new Error(threadError.message || "送信履歴の保存に失敗しました");

  const { error: msgError } = await supabase.from("email_messages").insert({
    company_id: profile.company_id,
    thread_id: thread.id,
    from_address: sent.emailAddress,
    from_name: profile.display_name ?? sent.emailAddress,
    to_addresses: input.to,
    cc_addresses: input.cc || [],
    subject: input.subject,
    body_text: input.body_text,
    body_html: input.body_html || null,
    direction: "outbound",
    external_message_id: sent.gmailMessageId,
    received_at: new Date().toISOString(),
  });
  if (msgError) {
    // カラム差で失敗しても送信自体は成功しているため握りつぶし気味に再試行
    const { error: msgRetry } = await supabase.from("email_messages").insert({
      company_id: profile.company_id,
      thread_id: thread.id,
      from_address: sent.emailAddress,
      from_name: profile.display_name ?? sent.emailAddress,
      to_addresses: input.to,
      cc_addresses: input.cc || [],
      subject: input.subject,
      body_text: input.body_text,
      body_html: input.body_html || null,
      direction: "outbound",
      received_at: new Date().toISOString(),
    });
    if (msgRetry) console.error("[sendEmail] message insert failed", msgError, msgRetry);
  }

  return thread;
}

export async function getMailSignature(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "";
  return (user.user_metadata?.mail_signature as string) ?? "";
}

export async function saveMailSignature(signature: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    data: { mail_signature: signature },
  });
  if (error) throw error;
}
