"use server";

import { createClient } from "@/lib/supabase/server";

export type InternalMessage = {
  id: string;
  company_id: string;
  sender_id: string;
  recipient_id: string | null;
  content: string;
  message_type: "chat" | "followup_inquiry";
  related_customer_id: string | null;
  related_deal_id: string | null;
  read_at: string | null;
  created_at: string;
  sender?: { id: string; display_name: string; avatar_url: string | null };
  recipient?: { id: string; display_name: string; avatar_url: string | null } | null;
  related_customer?: { id: string; name: string } | null;
};

/** 同会社のメンバー一覧（チャット相手候補） */
export async function getChatContacts() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: me } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!me) return [];

  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, role, department")
    .eq("company_id", me.company_id)
    .neq("id", user.id)
    .order("display_name");
  return data ?? [];
}

/** 特定ユーザーとの会話メッセージ取得 */
export async function getConversation(otherUserId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("internal_messages")
    .select("*, sender:profiles!internal_messages_sender_id_fkey(id, display_name, avatar_url), recipient:profiles!internal_messages_recipient_id_fkey(id, display_name, avatar_url), related_customer:customers(id, name)")
    .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`)
    .in("message_type", ["chat", "followup_inquiry"])
    .order("created_at", { ascending: true })
    .limit(100);
  return (data ?? []) as InternalMessage[];
}

/** 通常チャットメッセージ送信 */
export async function sendChatMessage(recipientId: string, content: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { data, error } = await supabase
    .from("internal_messages")
    .insert({
      company_id: profile.company_id,
      sender_id: user.id,
      recipient_id: recipientId,
      content,
      message_type: "chat",
    })
    .select("*, sender:profiles!internal_messages_sender_id_fkey(id, display_name, avatar_url)")
    .single();
  if (error) throw error;
  return data as InternalMessage;
}

/** フォローアップ問い合わせ送信（マネージャー → 担当営業） */
export async function sendFollowupInquiry(
  assigneeId: string,
  customerId: string,
  content: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { data, error } = await supabase
    .from("internal_messages")
    .insert({
      company_id: profile.company_id,
      sender_id: user.id,
      recipient_id: assigneeId,
      content,
      message_type: "followup_inquiry",
      related_customer_id: customerId,
    })
    .select()
    .single();
  if (error) throw error;
  return data as InternalMessage;
}

/** 自分宛の未読メッセージ数 */
export async function getUnreadMessageCount() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await supabase
    .from("internal_messages")
    .select("*", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .is("read_at", null);
  return count ?? 0;
}

/** メッセージを既読にする */
export async function markMessageAsRead(messageId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("internal_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("recipient_id", user.id)
    .is("read_at", null);
}

/** 会話の未読メッセージを全既読 */
export async function markConversationAsRead(otherUserId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("internal_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("sender_id", otherUserId)
    .eq("recipient_id", user.id)
    .is("read_at", null);
}

/** 自分宛の最新メッセージ一覧（連絡先ごとの最新1件） */
export async function getLatestConversations() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("internal_messages")
    .select("*, sender:profiles!internal_messages_sender_id_fkey(id, display_name, avatar_url), recipient:profiles!internal_messages_recipient_id_fkey(id, display_name, avatar_url), related_customer:customers(id, name)")
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .in("message_type", ["chat", "followup_inquiry"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (!data) return [];

  // ユーザーごとの最新メッセージのみ
  const seen = new Set<string>();
  const result: InternalMessage[] = [];
  for (const msg of data as InternalMessage[]) {
    const otherId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
    if (!otherId || seen.has(otherId)) continue;
    seen.add(otherId);
    result.push(msg);
  }
  return result;
}

/** フォローアップ問い合わせ受信一覧（担当営業宛） */
export async function getFollowupInquiries() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("internal_messages")
    .select("*, sender:profiles!internal_messages_sender_id_fkey(id, display_name, avatar_url), related_customer:customers(id, name)")
    .eq("recipient_id", user.id)
    .eq("message_type", "followup_inquiry")
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as InternalMessage[];
}

/** フォローアップ問い合わせ送信一覧（管理者・送信者向け） */
export async function getSentFollowupInquiries() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("internal_messages")
    .select("*, recipient:profiles!internal_messages_recipient_id_fkey(id, display_name, avatar_url), related_customer:customers(id, name)")
    .eq("sender_id", user.id)
    .eq("message_type", "followup_inquiry")
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as InternalMessage[];
}
