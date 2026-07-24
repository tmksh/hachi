"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * 同一オリジンの Link クリック直後にトップバーを出し、
 * pathname / search が変わったら消す。遷移の「無反応」感を消す。
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = searchParams.toString();
  useEffect(() => {
    setActive(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [pathname, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.button !== 0) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        const next = `${url.pathname}${url.search}`;
        const current = `${window.location.pathname}${window.location.search}`;
        if (next === current) return;
        setActive(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setActive(false), 12_000);
      } catch {
        // ignore invalid href
      }
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed left-0 right-0 top-0 z-[100] h-0.5 overflow-hidden transition-opacity duration-150",
        active ? "opacity-100" : "opacity-0",
      )}
    >
      <div
        className={cn(
          "h-full w-1/3 rounded-r-full bg-[var(--brand-dark,#0E6F77)] shadow-[0_0_12px_rgba(var(--brand-dark-rgb),0.55)]",
          active && "nav-progress-bar",
        )}
      />
    </div>
  );
}
