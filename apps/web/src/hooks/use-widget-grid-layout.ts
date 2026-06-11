"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { MIN_CARD_W } from "@/components/shared/sortable-widget";
import { useChatPanelOpen } from "@/contexts/chat-panel-context";

const GAP = 16; // gap-4

export type WidgetLayoutInput = {
  id: string;
  widthPx?: number;
};

function defaultColWidth(containerWidth: number) {
  return Math.max(MIN_CARD_W, Math.floor((containerWidth - 2 * GAP) / 3));
}

/** 行ごとに幅を配分し、コンテナより広いときは比例縮小する */
function computeDisplayWidths(
  widgets: WidgetLayoutInput[],
  containerWidth: number,
  stackFullWidth: boolean,
): Record<string, number> {
  if (containerWidth <= 0) return {};

  // チャット開時: 各カードをグリッド幅いっぱい（1列）にする
  if (stackFullWidth) {
    return Object.fromEntries(widgets.map((w) => [w.id, containerWidth]));
  }

  const fallback = defaultColWidth(containerWidth);
  const result: Record<string, number> = {};

  let row: { id: string; desired: number }[] = [];
  let rowSum = 0;

  const flush = () => {
    if (!row.length) return;
    const gaps = GAP * (row.length - 1);
    const total = rowSum + gaps;
    const scale =
      total > containerWidth ? (containerWidth - gaps) / rowSum : 1;
    for (const item of row) {
      result[item.id] = Math.max(
        MIN_CARD_W,
        Math.floor(item.desired * scale),
      );
    }
    row = [];
    rowSum = 0;
  };

  for (const w of widgets) {
    const desired = w.widthPx ?? fallback;
    const addGap = row.length > 0 ? GAP : 0;
    const gapsAfterAdd = GAP * row.length;
    const minRowWidth = (row.length + 1) * MIN_CARD_W + gapsAfterAdd;
    // 最小幅でも入らないときだけ次の行へ。それ以外は同一行で比例縮小
    if (row.length > 0 && rowSum + addGap + desired > containerWidth && minRowWidth > containerWidth) {
      flush();
    }
    row.push({ id: w.id, desired });
    rowSum += desired + addGap;
  }
  flush();

  return result;
}

/** ウィジェットグリッドの実表示幅（チャット開閉・リサイズに追従） */
export function useWidgetGridLayout(widgets: WidgetLayoutInput[]) {
  const chatOpen = useChatPanelOpen();
  const gridRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const update = () => {
      const next = el.clientWidth;
      setContainerWidth((prev) => (prev === next ? prev : next));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const stackFullWidth = chatOpen && containerWidth > 0;

  const displayWidths = useMemo(
    () => computeDisplayWidths(widgets, containerWidth, stackFullWidth),
    [widgets, containerWidth, stackFullWidth],
  );

  return { gridRef, displayWidths, containerWidth, stackFullWidth };
}
