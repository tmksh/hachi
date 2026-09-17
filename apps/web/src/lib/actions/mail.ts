"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { guessReplyAddress, replySubject } from "@/lib/mail-reply";

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

  const { data, error } = await supabase
    .from("email_accounts")
    .select("id, provider, email_address, last_sync_at, token_expires_at")
    .eq("user_id", user.id)
    .order("created_at");

  if (error) {
    console.error("[getEmailAccounts]", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    ...row,
    display_name: null,
    forward_address: null,
  })) as EmailAccount[];
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

async function myEmailAccountIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("email_accounts")
    .select("id")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((row) => row.id);
}

export async function getEmailThreads(folder?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const accountIds = await myEmailAccountIds(supabase, user.id);
  if (accountIds.length === 0) return [];

  let query = supabase
    .from("email_threads")
    .select("*, account:email_accounts!email_threads_account_id_fkey(id, email_address, provider)")
    .in("account_id", accountIds)
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const accountIds = await myEmailAccountIds(supabase, user.id);
  if (accountIds.length === 0) throw new Error("スレッドが見つかりません");

  const { data: thread, error: threadError } = await supabase
    .from("email_threads")
    .select("*")
    .eq("id", id)
    .in("account_id", accountIds)
    .maybeSingle();
  if (threadError) throw threadError;
  if (!thread) throw new Error("スレッドが見つかりません");

  const { data: messages, error: messagesError } = await supabase
    .from("email_messages")
    .select("*")
    .eq("thread_id", thread.id)
    .order("received_at");
  if (messagesError) throw messagesError;
  return { ...thread, messages: messages || [] };
}

export async function markThreadRead(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const accountIds = await myEmailAccountIds(supabase, user.id);
  if (accountIds.length === 0) return;

  await supabase
    .from("email_threads")
    .update({ is_read: true })
    .eq("id", id)
    .in("account_id", accountIds);
}

export type EmailFolder = {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
};

/** 本人のメールフォルダ一覧（会社別・請求書など、利用者が自由に作成） */
export async function listEmailFolders(): Promise<EmailFolder[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("email_folders")
    .select("id, name, color, sort_order")
    .eq("user_id", user.id)
    .order("sort_order")
    .order("created_at");
  if (error) {
    // マイグレーション未適用環境ではテーブルが無いので空扱い
    console.error("[listEmailFolders]", error);
    return [];
  }
  return (data ?? []) as EmailFolder[];
}

export async function createEmailFolder(name: string, color?: string | null): Promise<ActionResult<{ folder: EmailFolder }>> {
  const trimmed = name.trim();
  if (!trimmed) return actionFail("フォルダ名を入力してください", "フォルダ名を入力してください");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return actionFail("ログインが必要です", "ログインが必要です");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile?.company_id) return actionFail("プロフィールが見つかりません", "プロフィールが見つかりません");
  const { count } = await supabase
    .from("email_folders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  const { data, error } = await supabase
    .from("email_folders")
    .insert({
      company_id: profile.company_id,
      user_id: user.id,
      name: trimmed,
      color: color ?? null,
      sort_order: count ?? 0,
    })
    .select("id, name, color, sort_order")
    .single();
  if (error || !data) {
    return actionFail(error, error?.code === "23505" ? "同じ名前のフォルダがあります" : "フォルダの作成に失敗しました");
  }
  return actionOk({ folder: data as EmailFolder });
}

export async function renameEmailFolder(id: string, name: string): Promise<ActionResult<{ done: true }>> {
  const trimmed = name.trim();
  if (!trimmed) return actionFail("フォルダ名を入力してください", "フォルダ名を入力してください");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return actionFail("ログインが必要です", "ログインが必要です");
  const { error } = await supabase
    .from("email_folders")
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return actionFail(error, "フォルダ名の変更に失敗しました");
  return actionOk({ done: true as const });
}

export async function deleteEmailFolder(id: string): Promise<ActionResult<{ done: true }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return actionFail("ログインが必要です", "ログインが必要です");
  // 中のメールは受信トレイへ戻す（FK は ON DELETE SET NULL だが明示しておく）
  await supabase.from("email_threads").update({ folder_id: null }).eq("folder_id", id);
  const { error } = await supabase.from("email_folders").delete().eq("id", id).eq("user_id", user.id);
  if (error) return actionFail(error, "フォルダの削除に失敗しました");
  return actionOk({ done: true as const });
}

export async function moveThreadToFolder(threadId: string, folderId: string | null): Promise<ActionResult<{ done: true }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return actionFail("ログインが必要です", "ログインが必要です");
  const accountIds = await myEmailAccountIds(supabase, user.id);
  if (accountIds.length === 0) return actionFail("メールアカウントがありません", "メールアカウントがありません");
  const { error } = await supabase
    .from("email_threads")
    .update({ folder_id: folderId })
    .eq("id", threadId)
    .in("account_id", accountIds);
  if (error) return actionFail(error, "フォルダの移動に失敗しました");
  return actionOk({ done: true as const });
}

export async function toggleThreadFlag(id: string, flagged: boolean): Promise<ActionResult<{ done: true }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return actionFail("ログインが必要です", "ログインが必要です");
  const accountIds = await myEmailAccountIds(supabase, user.id);
  if (accountIds.length === 0) return actionFail("メールアカウントがありません", "メールアカウントがありません");
  const { error } = await supabase
    .from("email_threads")
    .update({ is_flagged: flagged })
    .eq("id", id)
    .in("account_id", accountIds);
  if (error) return actionFail(error, "フラグの更新に失敗しました");
  return actionOk({ done: true as const });
}

export async function toggleThreadStar(id: string, starred: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const accountIds = await myEmailAccountIds(supabase, user.id);
  if (accountIds.length === 0) return;

  await supabase
    .from("email_threads")
    .update({ is_starred: starred })
    .eq("id", id)
    .in("account_id", accountIds);
}

export async function replyToThread(input: {
  threadId: string;
  body_text: string;
  body_html?: string;
  to?: string;
}): Promise<ActionResult<{ thread: Awaited<ReturnType<typeof getEmailThread>> }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return actionFail("ログインが必要です", "ログインが必要です");

    const body = input.body_text.trim();
    if (!body) return actionFail("本文を入力してください", "本文を入力してください");

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id, display_name")
      .eq("id", user.id)
      .single();
    if (!profile) return actionFail("プロフィールが見つかりません", "プロフィールが見つかりません");

    const thread = await getEmailThread(input.threadId);

    const { data: gmailAccount } = await supabase
      .from("email_accounts")
      .select("id, email_address")
      .eq("user_id", user.id)
      .eq("provider", "gmail")
      .maybeSingle();

    const toAddress =
      input.to?.trim() ||
      guessReplyAddress(thread.messages ?? [], [gmailAccount?.email_address ?? ""]);
    if (!toAddress) {
      return actionFail("返信先のメールアドレスを入力してください", "返信先のメールアドレスを入力してください");
    }

    const { sendViaGmailAccount } = await import("@/lib/gmail-send");
    const sent = await sendViaGmailAccount({
      userId: user.id,
      to: [{ address: toAddress }],
      subject: replySubject(thread.subject),
      bodyText: body,
      bodyHtml: input.body_html,
      gmailThreadId: thread.external_thread_id,
    });

    const now = new Date().toISOString();
    const { error: msgError } = await supabase.from("email_messages").insert({
      company_id: profile.company_id,
      thread_id: thread.id,
      from_address: sent.emailAddress,
      from_name: profile.display_name ?? sent.emailAddress,
      to_addresses: [{ address: toAddress }],
      cc_addresses: [],
      subject: replySubject(thread.subject),
      body_text: body,
      body_html: input.body_html || null,
      direction: "outbound",
      external_message_id: sent.gmailMessageId,
      received_at: now,
    });
    if (msgError) {
      const { error: msgRetry } = await supabase.from("email_messages").insert({
        company_id: profile.company_id,
        thread_id: thread.id,
        from_address: sent.emailAddress,
        from_name: profile.display_name ?? sent.emailAddress,
        to_addresses: [{ address: toAddress }],
        subject: replySubject(thread.subject),
        body_text: body,
        direction: "outbound",
        received_at: now,
      });
      if (msgRetry) console.error("[replyToThread] message insert failed", msgError, msgRetry);
    }

    const accountIds = await myEmailAccountIds(supabase, user.id);
    const threadPatch: Record<string, unknown> = {
      snippet: body.substring(0, 200),
      last_message_at: now,
      is_read: true,
      updated_at: now,
    };
    if (!thread.external_thread_id && sent.gmailThreadId) {
      threadPatch.external_thread_id = sent.gmailThreadId;
    }
    let threadUpdate = supabase.from("email_threads").update(threadPatch).eq("id", thread.id);
    if (accountIds.length > 0) {
      threadUpdate = threadUpdate.in("account_id", accountIds);
    }
    await threadUpdate;

    try {
      return actionOk({ thread: await getEmailThread(thread.id) });
    } catch {
      return actionOk({
        thread: {
          ...thread,
          snippet: body.substring(0, 200),
          last_message_at: now,
          is_read: true,
          messages: [
            ...(thread.messages ?? []),
            {
              id: sent.gmailMessageId ?? `local-${now}`,
              from_address: sent.emailAddress,
              from_name: profile.display_name ?? sent.emailAddress,
              to_addresses: [{ address: toAddress }],
              body_text: body,
              received_at: now,
              direction: "outbound",
            },
          ],
        } as Awaited<ReturnType<typeof getEmailThread>>,
      });
    }
  } catch (e) {
    return actionFail(e, "返信の送信に失敗しました。Gmail連携と返信先を確認してください");
  }
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
  revalidatePath("/mail/compose");
  revalidatePath("/settings");
}
