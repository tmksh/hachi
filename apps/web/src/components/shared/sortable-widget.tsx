"use client";

import { useRef, useCallback } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripHorizontal } from "lucide-react";

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
        ...(height ? { height } : {}),
        boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.12)" : undefined,
      }}
      {...attributes}
      className="relative group/drag"
    >
      {/* ドラッグ用ハンドル：カード上端中央のバー（ホバー時のみ表示） */}
      <div
        {...listeners}
        className={`absolute top-0 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center
                    h-5 w-14 rounded-b-md
                    bg-foreground/10 hover:bg-foreground/20
                    text-foreground/60 hover:text-foreground/90
                    cursor-grab active:cursor-grabbing
                    opacity-0 group-hover/drag:opacity-100
                    transition-opacity duration-150 touch-none select-none`}
        title="ドラッグして縦横に並び替え"
      >
        <GripHorizontal className="h-3 w-3" />
      </div>

      {/* リサイズハンドル（右下、ホバーで濃く表示） */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute bottom-1.5 right-1.5 z-20 w-5 h-5 flex items-center justify-center opacity-40 group-hover/drag:opacity-100 cursor-nwse-resize transition-opacity rounded hover:bg-foreground/10"
        title="ドラッグして自由にサイズ変更"
      >
        <svg viewBox="0 0 10 10" className="w-3 h-3 text-muted-foreground">
          <path
            d="M9 1L1 9M5.5 1L1 5.5M9 4.5L4.5 9"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {children}
    </div>
  );
}
