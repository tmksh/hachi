"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, X, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { sendBridgeAiMessage } from "@/lib/actions/bridge-ai";
import { getChatContacts, sendChatMessage } from "@/lib/actions/internal-messages";
import type { BridgeSeed } from "@/contexts/chat-panel-context";
import { useInternalChat } from "@/contexts/chat-panel-context";
import { BrandMark } from "@/components/layout/brand-logo";
import { cn } from "@/lib/utils";

export const BRIDGE_AI_PANEL_WIDTH = 400;
const INTERNAL_CHAT_PANEL_WIDTH = 360;

/** 長いパスを先に評価（/dashboard2 が /dashboard に吸われないように） */
const GREETINGS: { prefix: string; text: string }[] = [
  { prefix: "/dashboard2", text: "KPIやウィジェットの見方、\n気になるところはありますか？" },
  { prefix: "/dashboard3", text: "KPIやウィジェットの見方、\n気になるところはありますか？" },
  { prefix: "/dashboard", text: "今日のKPIやフォーカス、\n確認したい項目はありますか？" },
  { prefix: "/bi", text: "指標の見方やグラフの意味、\n知りたいことはありますか？" },
  { prefix: "/crm", text: "顧客登録や商談ステージ、\nお困りのことはありますか？" },
  { prefix: "/deals", text: "商談の進捗やステージ更新、\nお手伝いしましょうか？" },
  { prefix: "/quotes", text: "見積の作成・編集・送付、\n進め方を確認しますか？" },
  { prefix: "/craftsmen", text: "職人の登録や手配、\n確認したいことはありますか？" },
  { prefix: "/contracts", text: "契約書類の作成や進捗、\nお困りのことはありますか？" },
  { prefix: "/constructions", text: "工程表や現場の進捗、\nお手伝いできますか？" },
  { prefix: "/invoices", text: "請求の発行や入金状況、\n確認したいことはありますか？" },
  { prefix: "/budget", text: "予算と実績の差異、\n見方をお伝えしましょうか？" },
  { prefix: "/calendar", text: "予定の登録や空き時間、\nお手伝いしましょうか？" },
  { prefix: "/mail", text: "メールの作成や送受信、\n進め方を確認しますか？" },
  { prefix: "/attendance", text: "打刻や勤怠の確認・修正、\nお困りのことはありますか？" },
  { prefix: "/workflow", text: "申請や承認の進め方、\nお手伝いできますか？" },
  { prefix: "/circulation", text: "回覧の確認や配布、\n進め方を確認しますか？" },
  { prefix: "/documents", text: "文書の検索や保管、\nお困りのことはありますか？" },
  { prefix: "/settings", text: "各種設定やPDFテンプレート、\n変更方法をお伝えしましょうか？" },
  { prefix: "/marketing", text: "配信やROI・クリエイティブ、\n確認したいことはありますか？" },
  { prefix: "/admin", text: "管理画面の操作や権限、\nお困りのことはありますか？" },
];

const GREETINGS_BY_PREFIX = [...GREETINGS].sort((a, b) => b.prefix.length - a.prefix.length);

function getGreeting(pathname: string) {
  const path = pathname.split("?")[0];
  const hit = GREETINGS_BY_PREFIX.find(
    (g) => path === g.prefix || path.startsWith(`${g.prefix}/`),
  );
  return hit?.text ?? "BRIDGE AI です。\n何かお手伝いできることはありますか？";
}

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  /** UI 表示用（API には text を送る） */
  displayText?: string;
};

type Contact = Awaited<ReturnType<typeof getChatContacts>>[number];

function toApiHistory(messages: ChatMessage[]) {
  return messages.map(({ role, text }) => ({ role, text }));
}

export function BridgeAiChat({
  open,
  onOpenChange,
  seed = null,
  onSeedConsumed,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** 開いたとき自動送信するシード（1回消費） */
  seed?: BridgeSeed | null;
  onSeedConsumed?: () => void;
}) {
  const pathname = usePathname();
  const { openInternalChat, refreshInternalChat, internalChatOpen } = useInternalChat();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [allowForward, setAllowForward] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [forwarding, setForwarding] = useState(false);
  const [forwarded, setForwarded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const seedGen = useRef(0);

  useEffect(() => {
    if (!open) return;
    // シード送信待ちのあいだは挨拶差し替えだけしない
    if (seed) return;
    const greeting = getGreeting(pathname ?? "");
    setMessages((prev) => {
      if (prev.length === 0) return [{ role: "assistant", text: greeting }];
      const initialOnly = prev.length === 1 && prev[0]?.role === "assistant";
      if (initialOnly) return [{ role: "assistant", text: greeting }];
      return prev;
    });
  }, [open, pathname, seed]);

  useEffect(() => {
    if (!open || !seed?.prompt) return;
    const gen = ++seedGen.current;
    const { prompt, displayText, allowForward: seedForward } = seed;
    if (seedForward) {
      setAllowForward(true);
      setForwarded(false);
      setAssigneeId("");
      void getChatContacts().then(setContacts).catch(() => setContacts([]));
    }
    const greeting = getGreeting(pathname ?? "");
    const nextMessages: ChatMessage[] = [
      { role: "assistant", text: greeting },
      { role: "user", text: prompt, displayText },
    ];
    setMessages(nextMessages);
    setSending(true);

    void (async () => {
      try {
        const { text } = await sendBridgeAiMessage(toApiHistory(nextMessages), pathname ?? "/");
        if (seedGen.current !== gen) return;
        setMessages((m) => [...m, { role: "assistant", text }]);
      } catch {
        if (seedGen.current !== gen) return;
        setMessages((m) => [
          ...m,
          { role: "assistant", text: "通信エラーが発生しました。もう一度お試しください。" },
        ]);
      } finally {
        if (seedGen.current === gen) {
          setSending(false);
          onSeedConsumed?.();
        }
      }
    })();
  }, [open, seed, pathname, onSeedConsumed]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, allowForward, assigneeId]);

  const isInitial = messages.length === 1 && messages[0]?.role === "assistant";
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const showForward =
    allowForward &&
    !sending &&
    !forwarded &&
    !!lastAssistant &&
    messages.some((m) => m.role === "user") &&
    lastAssistant.text !== "通信エラーが発生しました。もう一度お試しください。";

  const send = async () => {
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", text: userMsg },
    ];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    try {
      const { text } = await sendBridgeAiMessage(toApiHistory(nextMessages), pathname ?? "/");
      setMessages((m) => [...m, { role: "assistant", text }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "通信エラーが発生しました。もう一度お試しください。" }]);
    } finally {
      setSending(false);
    }
  };

  const forwardToChat = async () => {
    if (!assigneeId || !lastAssistant?.text || forwarding) return;
    setForwarding(true);
    try {
      await sendChatMessage(assigneeId, lastAssistant.text);
      setForwarded(true);
      refreshInternalChat();
      openInternalChat({ userId: assigneeId });
      toast.success("社内チャットに送信しました");
    } catch {
      toast.error("送信に失敗しました。もう一度お試しください。");
    } finally {
      setForwarding(false);
    }
  };

  if (pathname?.startsWith("/admin/login")) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          className="fixed bottom-6 right-6 z-50 size-14 rounded-full shadow-lg flex items-center justify-center bg-background border border-border hover:scale-105 transition-transform"
          aria-label="BRIDGE AI"
        >
          <BrandMark className="h-9 w-auto" />
        </button>
      )}

      {/* モバイル: 背景オーバーレイ（タップで閉じる） */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => onOpenChange(false)}
          aria-hidden
        />
      )}

      {/* 右側パネル: デスクトップは画面を押し縮め、モバイルはオーバーレイ */}
      <aside
        className={`fixed top-0 z-50 h-screen w-full md:w-[400px] flex flex-col bg-background border-l border-border shadow-xl transition-[transform,right] duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ right: internalChatOpen ? INTERNAL_CHAT_PANEL_WIDTH : 0 }}
        aria-hidden={!open}
      >
        <div className="px-4 py-3 border-b flex items-center gap-2.5">
          <span className="h-8 w-9 flex items-center justify-center shrink-0">
            <BrandMark className={cn("h-9 w-auto", sending && "animate-cube-thinking")} />
          </span>
          <span className="flex flex-col items-start leading-tight flex-1">
            <span className="text-base font-semibold">BLIDGE AI</span>
            <span className="text-[10px] font-normal text-emerald-600 flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              オンライン
            </span>
          </span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors"
            aria-label="閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {isInitial ? (
          <div className="flex-1 flex items-center justify-center px-6">
            <p className="text-center text-lg text-foreground/80 whitespace-pre-line leading-relaxed">
              {messages[0]?.text}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                <span
                  className={
                    m.role === "user"
                      ? "inline-block max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap bg-primary text-primary-foreground"
                      : "inline-block max-w-[90%] py-1 text-sm whitespace-pre-wrap text-foreground leading-relaxed"
                  }
                >
                  {m.displayText ?? m.text}
                </span>
              </div>
            ))}
            {sending && (
              <div className="text-left">
                <span className="inline-flex items-center gap-3 py-2 text-sm text-muted-foreground">
                  <BrandMark className="h-12 w-auto animate-cube-thinking" />
                  考え中...
                </span>
              </div>
            )}
            {showForward && (
              <div className="rounded-xl border border-border/70 bg-muted/30 p-3 space-y-2.5">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-[var(--brand-dark)]" />
                  担当者へ社内チャットで送る
                </p>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger className="h-9 bg-background">
                    <SelectValue placeholder="担当者を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.display_name}
                        {c.department ? `（${c.department}）` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  className="w-full h-9"
                  style={{ background: "var(--brand-gradient)" }}
                  disabled={!assigneeId || forwarding}
                  onClick={() => void forwardToChat()}
                >
                  {forwarding ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      送信中…
                    </>
                  ) : (
                    "社内チャットで送る"
                  )}
                </Button>
              </div>
            )}
            {forwarded && (
              <p className="text-xs text-emerald-700 font-medium">社内チャットに送信済みです</p>
            )}
            <div ref={bottomRef} />
          </div>
        )}
        <div className="p-3 border-t flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="メッセージを入力"
            rows={2}
            className="min-h-[40px] max-h-32 resize-none [field-sizing:fixed]"
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              // 日本語IME変換中の Enter は送信しない（確定後の Enter で送信）
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              // Shift+Enter は改行
              if (e.shiftKey) return;
              e.preventDefault();
              void send();
            }}
            disabled={sending}
          />
          <Button size="icon" onClick={() => void send()} disabled={sending || !input.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </aside>
    </>
  );
}
