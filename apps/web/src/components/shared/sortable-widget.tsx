"use client";

import { useRef, useCallback } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const MIN_CARD_W = 180;
export const MIN_CARD_H = 100;

export interface SortableWidgetProps {
  id: string;
  widthPx?: number;
  height?: number;
  onResize: (id: string, widthPx: number, height: number) => void;
  onResizeWidth: (id: string, widthPx: number) => void;
  onInitWidths: (updates: Record<string, number>) => void;
  children: React.ReactNode;
}

export function SortableWidget({
  id,
  widthPx,
  height,
  onResize,
  onResizeWidth,
  onInitWidths,
  children,
}: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const innerRef = useRef<HTMLDivElement | null>(null);

  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      setNodeRef(el);
      innerRef.current = el;
    },
    [setNodeRef],
  );

  // ── ピクセル単位の自由リサイズ（スナップなし） ──
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const card = innerRef.current;
    const grid = card?.closest("[data-widget-grid]") as HTMLElement | null;
    if (!card || !grid) return;

    // 全カードの現在の DOM 幅を保存（初回リサイズ時の幅確定）
    const allEls = Array.from(grid.querySelectorAll("[data-widget-id]")) as HTMLElement[];
    const initMap: Record<string, number> = {};
    allEls.forEach((el) => {
      if (el.dataset.widgetId) initMap[el.dataset.widgetId] = Math.round(el.getBoundingClientRect().width);
    });
    onInitWidths(initMap);

    const cardRect = card.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = cardRect.width;
    const startH = height ?? cardRect.height;

    let rafId = 0;
    const onMove = (ev: MouseEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const nextW = Math.max(MIN_CARD_W, Math.round(startW + dx));
        const nextH = Math.max(MIN_CARD_H, Math.round(startH + dy));
        onResize(id, nextW, nextH);
      });
    };
    const onUp = () => {
      cancelAnimationFrame(rafId);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    void onResizeWidth;
    document.body.style.cursor = "nwse-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      ref={setRef}
      data-widget-id={id}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.45 : 1,
        flex: widthPx ? `0 0 ${widthPx}px` : "1 1 calc(33.333% - 11px)",
        width: widthPx ? `${widthPx}px` : undefined,
        minWidth: `${MIN_CARD_W}px`,
        ...(height ? { height, display: "flex", flexDirection: "column" } : {}),
        boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.12)" : undefined,
      }}
      {...attributes}
      className="relative h-full min-h-0"
    >
      {/* 上端：透明ゾーンでドラッグ並び替え（視覚ハンドルなし） */}
      <div
        {...listeners}
        aria-label="ドラッグして並び替え"
        className="absolute top-0 left-0 right-0 z-30 h-3 cursor-grab active:cursor-grabbing touch-none select-none"
      />

      {/* 右下角：透明ゾーンでリサイズ（視覚ハンドルなし） */}
      <div
        onMouseDown={handleResizeMouseDown}
        aria-label="ドラッグしてサイズ変更"
        className="absolute bottom-0 right-0 z-20 h-5 w-5 cursor-nwse-resize touch-none select-none"
      />

      <div className="flex-1 min-h-0 flex flex-col w-full">{children}</div>
    </div>
  );
}
