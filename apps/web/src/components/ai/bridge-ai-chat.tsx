"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, X } from "lucide-react";

export const BRIDGE_AI_PANEL_WIDTH = 400;

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

export function BridgeAiChat({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const pathname = usePathname();
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const TEAL_ACTIVE_GRADIENT = "var(--brand-gradient)";

  useEffect(() => {
    if (!open) return;
    const greeting = getGreeting(pathname ?? "");
    setMessages((prev) => {
      if (prev.length === 0) return [{ role: "assistant", text: greeting }];
      const initialOnly = prev.length === 1 && prev[0]?.role === "assistant";
      if (initialOnly) return [{ role: "assistant", text: greeting }];
      return prev;
    });
  }, [open, pathname]);

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
