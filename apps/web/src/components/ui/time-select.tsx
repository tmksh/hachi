"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/* 0:00 〜 23:45 を 15 分刻みで生成 */
const TIMES: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    TIMES.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

function toJa(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = parseInt(mStr ?? "0", 10);
  const mm = String(m).padStart(2, "0");
  if (h === 0)  return `午前12:${mm}`;
  if (h < 12)  return `午前${h}:${mm}`;
  if (h === 12) return `午後12:${mm}`;
  return `午後${h - 12}:${mm}`;
}

interface TimeSelectProps {
  value: string;          // "HH:mm"
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
}

export function TimeSelect({ value, onChange, disabled, className }: TimeSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef      = useRef<HTMLUListElement>(null);

  /* 外クリックで閉じる */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  /* 開いたとき選択中の時刻にスクロール */
  useEffect(() => {
    if (!open || !listRef.current) return;
    const idx = TIMES.indexOf(value);
    if (idx >= 0) {
      const el = listRef.current.children[idx] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "center" });
    }
  }, [open, value]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "h-9 w-full flex items-center justify-between gap-2 px-3 rounded-xl text-sm font-normal",
          "bg-white text-foreground border border-[rgba(0,0,0,0.10)]",
          "shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
          "hover:bg-gray-50 hover:border-[rgba(0,0,0,0.18)]",
          "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "dark:bg-white/8 dark:border-white/8 dark:hover:bg-white/14 dark:hover:border-white/14",
        )}
      >
        <span className="tabular-nums">{toJa(value || "00:00")}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-70 transition-transform duration-150", open && "rotate-180")}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-xl border border-[rgba(0,0,0,0.10)] bg-white shadow-md py-1 dark:bg-[#1F2937] dark:border-white/12"
        >
          {TIMES.map((t) => (
            <li
              key={t}
              onMouseDown={(e) => e.preventDefault()} /* フォーカス移動防止 */
              onClick={() => { onChange(t); setOpen(false); }}
              className={cn(
                "px-3 py-1.5 text-sm cursor-pointer hover:bg-primary/10 transition-colors tabular-nums",
                t === value && "bg-primary/15 font-semibold text-primary",
              )}
            >
              {toJa(t)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
