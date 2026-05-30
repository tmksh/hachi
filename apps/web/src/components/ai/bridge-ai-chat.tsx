"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, X } from "lucide-react";
import { TEAL_ACTIVE_GRADIENT } from "@/lib/teal-theme";

export const BRIDGE_AI_PANEL_WIDTH = 400;

const GREETINGS: { match: RegExp; text: string }[] = [
  { match: /\/quotes/, text: "見積もりについて\nお手伝いできますか？" },
  { match: /\/constructions/, text: "工程表・工事管理について\nお手伝いできますか？" },
  { match: /\/contracts/, text: "契約・書類作成について\nお手伝いできますか？" },
  { match: /\/crm/, text: "顧客・商談について\nお手伝いできますか？" },
  { match: /\/craftsmen/, text: "職人管理について\nお手伝いできますか？" },
  { match: /\/workflow/, text: "ワークフローについて\nお手伝いできますか？" },
  { match: /\/dashboard/, text: "ダッシュボードの見方について\nお手伝いできますか？" },
];

function getGreeting(pathname: string) {
  return GREETINGS.find((g) => g.match.test(pathname))?.text ?? "BRIDGE AI です。\n何かお手伝いできますか？";
}

export function BridgeAiChat({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const pathname = usePathname();
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: "assistant", text: getGreeting(pathname ?? "") }]);
    }
  }, [open, pathname, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isInitial = messages.length === 1 && messages[0]?.role === "assistant";

  const send = () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages((m) => [...m, { role: "user", text: userMsg }]);
    setInput("");
    setTimeout(() => {
      setMessages((m) => [...m, {
        role: "assistant",
        text: `「${userMsg}」について確認しました。現在の画面（${pathname}）のコンテキストに基づき、詳細は各機能画面から操作できます。`,
      }]);
    }, 400);
  };

  if (pathname?.startsWith("/admin/login")) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          className="fixed bottom-6 right-6 z-50 size-14 rounded-full shadow-lg flex items-center justify-center text-white hover:scale-105 transition-transform"
          style={{ background: TEAL_ACTIVE_GRADIENT }}
          aria-label="BRIDGE AI"
        >
          <Sparkles className="h-6 w-6" />
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
        className={`fixed top-0 right-0 z-50 h-screen w-full md:w-[400px] flex flex-col bg-background border-l border-border shadow-xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
        aria-hidden={!open}
      >
        <div className="px-4 py-3 border-b flex items-center gap-2.5">
          <span
            className="h-8 w-8 rounded-full flex items-center justify-center text-white shrink-0"
            style={{ background: TEAL_ACTIVE_GRADIENT }}
          >
            <Sparkles className="h-4 w-4" />
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
                <span className={`inline-block max-w-[90%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {m.text}
                </span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
        <div className="p-3 border-t flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="メッセージを入力..." onKeyDown={(e) => e.key === "Enter" && send()} />
          <Button size="icon" onClick={send}><Send className="h-4 w-4" /></Button>
        </div>
      </aside>
    </>
  );
}
