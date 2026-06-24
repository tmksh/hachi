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
  AlertCircle,
  Check,
  CheckCheck,
} from "lucide-react";import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import {
  getChatContacts,
  getConversation,
  sendChatMessage,
  getLatestConversations,
  markConversationAsRead,
  getUnreadMessageCount,
  getFollowupInquiries,
  type InternalMessage,
} from "@/lib/actions/internal-messages";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";

type Contact = Awaited<ReturnType<typeof getChatContacts>>[number];
type ConversationView = { type: "list" } | { type: "chat"; contact: Contact } | { type: "inquiries" };


export const INTERNAL_CHAT_WIDTH = 360;

interface InternalChatPanelProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
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

export function InternalChatPanel({ open, onOpenChange }: InternalChatPanelProps) {
  const { profile } = useAuth();
  const [view, setView] = useState<ConversationView>({ type: "list" });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [latestConvs, setLatestConvs] = useState<InternalMessage[]>([]);
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [inquiries, setInquiries] = useState<InternalMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refreshContacts = useCallback(async () => {
    try {
      const [c, latest, count, inq] = await Promise.all([
        getChatContacts(),
        getLatestConversations(),
        getUnreadMessageCount(),
        getFollowupInquiries(),
      ]);
      setContacts(c);
      setLatestConvs(latest);
      setUnreadCount(count);
      setInquiries(inq);
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    refreshContacts();
  }, [open, refreshContacts]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const openChat = async (contact: Contact) => {
    setView({ type: "chat", contact });
    setLoadingMessages(true);
    try {
      const msgs = await getConversation(contact.id);
      setMessages(msgs);
      await markConversationAsRead(contact.id);
      setUnreadCount(prev => Math.max(0, prev - 1));
    } finally {
      setLoadingMessages(false);
    }
  };

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

  const isUnread = (contactId: string) => {
    const msg = getLastMessage(contactId);
    return msg && msg.sender_id === contactId && !msg.read_at;
  };

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
        style={{ width: INTERNAL_CHAT_WIDTH }}
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

        {/* タブ（一覧ビューのみ）は廃止 — メッセージと問い合わせを1リストで表示 */}

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
            ) : (
              <div className="divide-y divide-border/40">
                {/* フォローアップ問い合わせ（未読のみ優先表示） */}
                {inquiries.filter(i => !i.read_at).map(inq => (
                  <div key={inq.id} className="px-4 py-3 space-y-1 bg-primary/5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="h-3 w-3 text-primary shrink-0" />
                        <p className="text-xs font-semibold text-foreground truncate">
                          {(inq.sender as { display_name?: string } | null)?.display_name ?? "不明"} より
                        </p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(inq.created_at), "M/d HH:mm", { locale: ja })}</span>
                    </div>
                    {inq.related_customer && (
                      <Link href={`/crm/${inq.related_customer.id}`} className="text-[11px] text-primary hover:underline block truncate">
                        顧客: {inq.related_customer.name}
                      </Link>
                    )}
                    <p className="text-xs text-foreground/80 leading-relaxed">{inq.content}</p>
                  </div>
                ))}

                {/* メンバー一覧（チャット） */}
                {contacts.length === 0 && inquiries.filter(i => !i.read_at).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-6">
                    <MessageCircle className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">メンバーがいません</p>
                  </div>
                ) : contacts.map(contact => {
                  const lastMsg = getLastMessage(contact.id);
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
                          {lastMsg && (
                            <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(lastMsg.created_at), "M/d HH:mm", { locale: ja })}</span>
                          )}
                        </div>
                        <p className={cn("text-xs truncate mt-0.5", unread ? "text-foreground/80" : "text-muted-foreground")}>
                          {lastMsg ? (
                            <>
                              {lastMsg.sender_id === profile?.id && (
                                lastMsg.read_at ? <CheckCheck className="h-3 w-3 inline mr-0.5 text-primary" /> : <Check className="h-3 w-3 inline mr-0.5 text-muted-foreground" />
                              )}
                              {lastMsg.content}
                            </>
                          ) : (
                            <span className="text-muted-foreground/60">{contact.department || contact.role}</span>
                          )}
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
                  return (
                    <div key={msg.id ?? i} className={cn("flex gap-2 items-end", isMe && "justify-end")}>
                      {!isMe && <Avatar name={view.contact.display_name} />}
                      <div className={cn("max-w-[75%] space-y-0.5", isMe && "items-end flex flex-col")}>
                        <div className={cn(
                          "rounded-2xl px-3 py-2 text-sm leading-relaxed",
                          isMe
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
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                className="flex-1 text-sm"
              />
              <Button
                size="icon"
                onClick={handleSend}
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
