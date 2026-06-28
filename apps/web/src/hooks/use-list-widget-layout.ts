"use client";

import { useRef, useState, useEffect } from "react";

/** ウィジェット枠の高さとリスト内容を比較し、コンパクト表示できるか判定する */
export function useListWidgetLayout(
  itemCount: number,
  itemHeightPx: number,
  options?: { gapPx?: number; cardPaddingPx?: number; cardGapPx?: number },
) {
  const { gapPx = 4, cardPaddingPx = 24, cardGapPx = 8 } = options ?? {};
  const cardRef = useRef<HTMLDivElement>(null);
  const [allFit, setAllFit] = useState(itemCount === 0);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const update = () => {
      if (itemCount === 0) {
        setAllFit(true);
        return;
      }

      const widget = card.parentElement;
      const widgetH = widget?.clientHeight ?? 0;
      if (widgetH <= 0) return;

      const headerEl = card.querySelector("[data-widget-header]");
      const headerH = headerEl instanceof HTMLElement ? headerEl.offsetHeight : 0;
      const available = widgetH - headerH - cardPaddingPx - cardGapPx;
      const contentH = itemCount * itemHeightPx + Math.max(0, itemCount - 1) * gapPx;
      setAllFit(contentH <= available);
    };

    update();
    const widget = card.parentElement;
    const ro = new ResizeObserver(update);
    if (widget) ro.observe(widget);
    ro.observe(card);
    return () => ro.disconnect();
  }, [itemCount, itemHeightPx, gapPx, cardPaddingPx, cardGapPx]);

  return { cardRef, allFit };
}
