"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageCircle,
  Send,
  X,
  ChevronLeft,
  Check,
  CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import {
  sendChatMessage,
  markConversationAsRead,
} from "@/lib/actions/internal-messages";
import {
  fetchChatContacts,
  fetchConversation,
  fetchLatestConversations,
  fetchUnreadMessageCount,
  type InternalMessage,
} from "@/lib/queries/internal-messages";
import { useAuth } from "@/hooks/use-auth";
import { useImeComposition } from "@/hooks/use-ime-composition";
import { useInternalChat, type InternalChatSeed } from "@/contexts/chat-panel-context";

type Contact = Awaited<ReturnType<typeof fetchChatContacts>>[number];
type ConversationView = { type: "list" } | { type: "chat"; contact: Contact };


export const INTERNAL_CHAT_WIDTH = 360;

interface InternalChatPanelProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  seed?: InternalChatSeed | null;
  onSeedConsumed?: () => void;
}

function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const colors = ["#0F5132", "#1a6e47", "#2a8055", "#3d9966", "#0e4a2d"];
  const idx = name.charCodeAt(0) % colors.length;
  const dim = size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";
  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center text-white font-bold shrink-0`}
      style={{ background: colors[idx] }}
    >
      {name.charAt(0)}
    </div>
  );
}

export function InternalChatPanel({
  open,
  onOpenChange,
  seed = null,
  onSeedConsumed,
}: InternalChatPanelProps) {
  const { profile } = useAuth();
  const { internalChatRefreshKey } = useInternalChat();
  const [view, setView] = useState<ConversationView>({ type: "list" });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [latestConvs, setLatestConvs] = useState<InternalMessage[]>([]);
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasContactsRef = useRef(false);
  const seedGen = useRef(0);
  const ime = useImeComposition();

  const refreshContacts = useCallback(async () => {
    try {
      const [c, latest, count] = await Promise.all([
        fetchChatContacts(),
        fetchLatestConversations(),
        fetchUnreadMessageCount(),
      ]);
      setContacts(c);
      setLatestConvs(latest);
      setUnreadCount(count);
      hasContactsRef.current = c.length > 0;
      return c;
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    // 再オープン時は前回の連絡先を残したまま裏で更新（真っ白待ちを避ける）
    if (!hasContactsRef.current) setLoadingContacts(true);
    void refreshContacts();
  }, [open, internalChatRefreshKey, refreshContacts]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const openChat = useCallback(async (contact: Contact) => {
    setView({ type: "chat", contact });
    setMessages([]);
    setLoadingMessages(true);
    try {
      const msgs = await fetchConversation(contact.id);
      setMessages(msgs);
      setUnreadCount(prev => Math.max(0, prev - 1));
      void markConversationAsRead(contact.id);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  /** 外部からのシード（担当者指定で会話を開く／送信） */
  useEffect(() => {
    if (!open || !seed?.userId) return;
    const gen = ++seedGen.current;
    const current = seed;

    void (async () => {
      try {
        const list = (await refreshContacts()) ?? [];
        if (seedGen.current !== gen) return;
        const contact = list.find((c) => c.id === current.userId);
        if (!contact) return;
        await openChat(contact);
        if (seedGen.current !== gen) return;
        if (current.message && current.autoSend) {
          setSending(true);
          try {
            const msg = await sendChatMessage(contact.id, current.message);
            if (seedGen.current === gen) {
              setMessages((prev) => [...prev, msg]);
              void refreshContacts();
            }
          } finally {
            if (seedGen.current === gen) setSending(false);
          }
        } else if (current.message) {
          setInput(current.message);
        }
      } finally {
        if (seedGen.current === gen) onSeedConsumed?.();
      }
    })();
  }, [open, seed, openChat, refreshContacts, onSeedConsumed]);

  const handleSend = async () => {
    if (view.type !== "chat" || !input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    try {
      const msg = await sendChatMessage(view.contact.id, text);
      setMessages(prev => [...prev, msg]);
    } catch {
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const getLastMessage = (contactId: string) => {
    return latestConvs.find(m => m.sender_id === contactId || m.recipient_id === contactId);
  };

  const formatLastMessagePreview = (msg: InternalMessage) => {
    if (msg.message_type === "followup_inquiry") {
      const prefix = msg.sender_id === profile?.id ? "問い合わせ送信: " : "問い合わせ: ";
      return `${prefix}${msg.content}`;
    }
    return msg.content;
  };

  const isUnread = (contactId: string) => {
    const msg = getLastMessage(contactId);
    return msg && msg.sender_id === contactId && !msg.read_at;
  };

  const activeContacts = contacts
    .filter((c) => getLastMessage(c.id))
    .sort((a, b) => {
      const aTime = getLastMessage(a.id)!.created_at;
      const bTime = getLastMessage(b.id)!.created_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

  if (!open) return null;

  return (
    <>
      {/* モバイル: 背景オーバーレイ */}
      <div
        className="fixed inset-0 z-40 bg-black/40 md:hidden"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />

      <aside
        className="fixed top-0 right-0 z-50 h-screen flex flex-col bg-background border-l border-border shadow-xl"
        style={{ width: INTERNAL_CHAT_WIDTH, maxWidth: "100vw" }}
        aria-label="チャット"
      >
        {/* ヘッダー */}
        <div className="px-4 py-3 border-b flex items-center gap-2.5 shrink-0">
          {view.type === "chat" ? (
            <button
              type="button"
              onClick={() => { setView({ type: "list" }); setMessages([]); }}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors -ml-1"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : (
            <div className="h-8 w-8 rounded-full flex items-center justify-center bg-primary/10 shrink-0">
              <MessageCircle className="h-4 w-4 text-primary" />
            </div>
          )}
          <span className="flex-1 font-semibold text-sm truncate">
            {view.type === "chat" ? view.contact.display_name : "社内チャット"}
          </span>
          {view.type !== "chat" && unreadCount > 0 && (
            <Badge className="bg-rose-500 text-white text-[10px] h-5 px-1.5 shrink-0">{unreadCount}</Badge>
          )}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* メイン コンテンツ */}
        {view.type === "list" && (
          <div className="flex-1 overflow-y-auto">
            {loadingContacts ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-2.5 w-36" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activeContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-6">
                <MessageCircle className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">メッセージがありません</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {activeContacts.map((contact) => {
                  const lastMsg = getLastMessage(contact.id)!;
                  const unread = isUnread(contact.id);
                  return (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => openChat(contact)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                    >
                      <div className="relative">
                        <Avatar name={contact.display_name} size="md" />
                        {unread && (
                          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 border-2 border-background" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn("text-sm truncate", unread ? "font-semibold text-foreground" : "font-medium")}>{contact.display_name}</p>
                          <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(lastMsg.created_at), "M/d HH:mm", { locale: ja })}</span>
                        </div>
                        <p className={cn("text-xs truncate mt-0.5", unread ? "text-foreground/80" : "text-muted-foreground")}>
                          {lastMsg.sender_id === profile?.id && lastMsg.message_type === "chat" && (
                            lastMsg.read_at ? <CheckCheck className="h-3 w-3 inline mr-0.5 text-primary" /> : <Check className="h-3 w-3 inline mr-0.5 text-muted-foreground" />
                          )}
                          {formatLastMessagePreview(lastMsg)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* チャットビュー */}
        {view.type === "chat" && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {loadingMessages ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className={cn("flex gap-2", i % 2 === 1 && "justify-end")}>
                      {i % 2 === 0 && <Skeleton className="h-7 w-7 rounded-full shrink-0" />}
                      <Skeleton className={cn("h-10 rounded-xl", i % 2 === 0 ? "w-48" : "w-40")} />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 py-12 text-center">
                  <MessageCircle className="h-7 w-7 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">メッセージを送ってみましょう</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isMe = msg.sender_id === profile?.id;
                  const isInquiry = msg.message_type === "followup_inquiry";
                  return (
                    <div key={msg.id ?? i} className={cn("flex gap-2 items-end", isMe && "justify-end")}>
                      {!isMe && <Avatar name={view.contact.display_name} />}
                      <div className={cn("max-w-[75%] space-y-0.5", isMe && "items-end flex flex-col")}>
                        {isInquiry && (
                          <span className="text-[10px] text-primary font-medium px-1">フォローアップ問い合わせ</span>
                        )}
                        <div className={cn(
                          "rounded-2xl px-3 py-2 text-sm leading-relaxed",
                          isInquiry
                            ? "bg-primary/10 border border-primary/20 text-foreground rounded-bl-sm"
                            : isMe
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-muted rounded-bl-sm"
                        )}>
                          {msg.content}
                        </div>
                        <span className="text-[10px] text-muted-foreground px-1">
                          {format(new Date(msg.created_at), "HH:mm", { locale: ja })}
                          {isMe && (msg.read_at ? <CheckCheck className="inline ml-1 h-3 w-3 text-primary" /> : <Check className="inline ml-1 h-3 w-3 text-muted-foreground" />)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>
            <div className="p-3 border-t flex gap-2 shrink-0">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="メッセージを入力..."
                onCompositionStart={ime.onCompositionStart}
                onCompositionEnd={ime.onCompositionEnd}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || e.shiftKey) return;
                  if (ime.shouldBlockSubmit(e)) return;
                  e.preventDefault();
                  void handleSend();
                }}
                className="flex-1 text-sm"
              />
              <Button
                type="button"
                size="icon"
                onPointerDown={ime.armSend}
                onClick={() => {
                  if (ime.shouldIgnoreSendClick()) return;
                  void handleSend();
                }}
                disabled={sending || !input.trim()}
                className="shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
