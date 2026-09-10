import { createClient } from "@/lib/supabase/client";

export const CHAT_STALE_MS = 30_000;

export const CHAT_QK = {
  contacts: ["chat-contacts"] as const,
  unread: ["chat-unread"] as const,
  latest: ["chat-latest"] as const,
  conversation: (otherUserId: string) => ["chat-conversation", otherUserId] as const,
};

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

const MESSAGE_SELECT =
  "*, sender:profiles!internal_messages_sender_id_fkey(id, display_name, avatar_url), recipient:profiles!internal_messages_recipient_id_fkey(id, display_name, avatar_url), related_customer:customers(id, name)";

export async function fetchChatContacts() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: me } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!me) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, role, department")
    .eq("company_id", me.company_id)
    .neq("id", user.id)
    .order("display_name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchConversation(otherUserId: string): Promise<InternalMessage[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("internal_messages")
    .select(MESSAGE_SELECT)
    .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`)
    .in("message_type", ["chat", "followup_inquiry"])
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as InternalMessage[];
}

export async function fetchUnreadMessageCount(): Promise<number> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from("internal_messages")
    .select("*", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function fetchLatestConversations(): Promise<InternalMessage[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("internal_messages")
    .select(MESSAGE_SELECT)
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .in("message_type", ["chat", "followup_inquiry"])
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  if (!data) return [];

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
