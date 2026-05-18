"use client";

import { useRef, useCallback } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

export const MIN_CARD_W = 180;

export interface SortableWidgetProps {
  id: string;
  widthPx?: number;
  height?: number;
  onResize: (id: string, w: number, h: number) => void;
  onResizeWidth: (id: string, w: number) => void;
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

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const card = innerRef.current;
    const grid = card?.closest("[data-widget-grid]") as HTMLElement | null;
    if (!card || !grid) return;

    const cardRect = card.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startH = height ?? cardRect.height;

    // --- 全カードの px 幅を初期化（初回リサイズ時のみ）---
    const allEls = Array.from(
      grid.querySelectorAll("[data-widget-id]"),
    ) as HTMLElement[];
    const initMap: Record<string, number> = {};
    allEls.forEach((el) => {
      const wid = el.dataset.widgetId;
      if (wid) initMap[wid] = Math.round(el.getBoundingClientRect().width);
    });
    onInitWidths(initMap);

    // 同行カードを特定（top 座標 ±8px 以内）
    const sameRow = allEls
      .filter(
        (el) =>
          Math.abs(el.getBoundingClientRect().top - cardRect.top) < 8,
      )
      .sort(
        (a, b) =>
          a.getBoundingClientRect().left - b.getBoundingClientRect().left,
      );

    const myIdx = sameRow.findIndex((el) => el.dataset.widgetId === id);
    const nextEl = sameRow[myIdx + 1] ?? null;
    const nextId = nextEl?.dataset.widgetId ?? null;

    const startW = cardRect.width;
    const startNextW = nextEl?.getBoundingClientRect().width ?? 0;

    let rafId = 0;

    const onMove = (ev: MouseEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        const maxDx = nextEl ? startNextW - MIN_CARD_W : Infinity;
        const minDx = -(startW - MIN_CARD_W);
        const cdx = Math.max(minDx, Math.min(maxDx, dx));

        onResize(
          id,
          Math.round(startW + cdx),
          Math.max(120, Math.round(startH + dy)),
        );

        if (nextEl && nextId) {
          onResizeWidth(nextId, Math.round(startNextW - cdx));
        }
      });
    };

    const onUp = () => {
      cancelAnimationFrame(rafId);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

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
        opacity: isDragging ? 0.7 : 1,
        flex: widthPx ? `0 0 ${widthPx}px` : "1 1 calc(33.333% - 11px)",
        width: widthPx ? `${widthPx}px` : undefined,
        minWidth: `${MIN_CARD_W}px`,
        ...(height ? { height } : {}),
      }}
      {...attributes}
      className="relative group/drag"
    >
      {/* ドラッグハンドル */}
      <div
        {...listeners}
        className="absolute top-[12px] left-1.5 z-20 p-0.5 rounded cursor-grab active:cursor-grabbing text-muted-foreground/20 opacity-0 group-hover/drag:opacity-100 hover:text-muted-foreground/50 transition-all touch-none select-none"
        title="ドラッグして並び替え"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      {/* リサイズハンドル（右下） */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute bottom-1.5 right-1.5 z-20 w-5 h-5 flex items-center justify-center opacity-0 group-hover/drag:opacity-100 cursor-nwse-resize transition-opacity rounded hover:bg-black/5"
        title="ドラッグしてサイズ変更"
      >
        <svg viewBox="0 0 10 10" className="w-3 h-3 text-muted-foreground/40">
          <path
            d="M9 1L1 9M5.5 1L1 5.5M9 4.5L4.5 9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {children}
    </div>
  );
}
