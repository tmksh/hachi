"use client";

import { useRef, useState, useEffect } from "react";

/** リストコンテナの高さから表示可能な件数を算出 */
export function useVisibleItemCount(
  itemHeightPx: number,
  options?: { min?: number; max?: number; gapPx?: number },
) {
  const { min = 1, max = 20, gapPx = 4 } = options ?? {};
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(max);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const h = el.clientHeight;
      if (h <= 0) {
        // auto-height context (no fixed container) — show all items up to max
        setCount(max);
        return;
      }
      const step = itemHeightPx + gapPx;
      const n = Math.max(min, Math.min(max, Math.floor((h + gapPx) / step)));
      setCount(n);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [itemHeightPx, min, max, gapPx]);

  return { ref, count };
}
