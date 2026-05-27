"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send } from "lucide-react";
import { TEAL_ACTIVE_GRADIENT } from "@/lib/teal-theme";

const GREETINGS: { match: RegExp; text: string }[] = [
  { match: /\/quotes/, text: "見積もりについてお手伝いできますか？" },
  { match: /\/constructions/, text: "工程表・工事管理についてお手伝いできますか？" },
  { match: /\/contracts/, text: "契約・書類作成についてお手伝いできますか？" },
  { match: /\/crm/, text: "顧客・商談についてお手伝いできますか？" },
  { match: /\/craftsmen/, text: "職人管理についてお手伝いできますか？" },
  { match: /\/workflow/, text: "ワークフローについてお手伝いできますか？" },
  { match: /\/dashboard/, text: "ダッシュボードの見方についてお手伝いできますか？" },
];

function getGreeting(pathname: string) {
  return GREETINGS.find((g) => g.match.test(pathname))?.text ?? "BRIDGE AI です。何かお手伝いできますか？";
}

export function BridgeAiChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 size-14 rounded-full shadow-lg flex items-center justify-center text-white hover:scale-105 transition-transform"
        style={{ background: TEAL_ACTIVE_GRADIENT }}
        aria-label="BRIDGE AI"
      >
        <Sparkles className="h-6 w-6" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />BLIDGE AI
            </SheetTitle>
          </SheetHeader>
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
          <div className="p-3 border-t flex gap-2">
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="メッセージ..." onKeyDown={(e) => e.key === "Enter" && send()} />
            <Button size="icon" onClick={send}><Send className="h-4 w-4" /></Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
