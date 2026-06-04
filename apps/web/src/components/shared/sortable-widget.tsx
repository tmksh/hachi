"use client";

import { useRef, useCallback } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const MIN_CARD_W = 180;
export const MIN_CARD_H = 100;

export interface SortableWidgetProps {
  id: string;
  widthPx?: number;
  /** グリッド幅に合わせた実表示幅（未指定時は widthPx を使用） */
  layoutWidthPx?: number;
  /** チャット開時など: グリッド幅いっぱい（100%） */
  stackFullWidth?: boolean;
  height?: number;
  onResize: (id: string, widthPx: number, height: number) => void;
  onResizeWidth: (id: string, widthPx: number) => void;
  /** @deprecated 未使用。互換のため残置 */
  onInitWidths?: (updates: Record<string, number>) => void;
  children: React.ReactNode;
}

export function SortableWidget({
  id,
  widthPx,
  layoutWidthPx,
  stackFullWidth = false,
  height,
  onResize,
  onResizeWidth,
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

    const cardRect = card.getBoundingClientRect();
    const measuredW = Math.round(cardRect.width);
    const measuredH = Math.round(cardRect.height);
    // 未保存のウィジェットのみ現在幅を確定（縮小表示時に保存値は上書きしない）
    if (widthPx === undefined) {
      onResizeWidth(id, measuredW);
    }

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = measuredW;
    const startH = height ?? measuredH;

    const gridRect = grid.getBoundingClientRect();
    const gridWidth = Math.round(gridRect.width);
    const allEls = Array.from(grid.querySelectorAll("[data-widget-id]")) as HTMLElement[];
    const cardIndex = allEls.indexOf(card);

    // DOM順 + 同行（top差 < 10px）で右兄弟を検出
    const hasRightSibling = allEls.some((el, i) => {
      if (i <= cardIndex) return false;
      return Math.abs(el.getBoundingClientRect().top - cardRect.top) < 10;
    });

    let maxW: number;
    if (hasRightSibling) {
      // 右にカードあり → グリッド全幅まで拡大可（右カードは flex-wrap で折り返す）
      maxW = gridWidth;
    } else {
      // 右にカードなし → カード左端からグリッド右端までの実ピクセル距離が上限
      // 左兄弟の幅合算より正確で、丸め誤差による折り返しを防ぐ
      maxW = Math.max(MIN_CARD_W, Math.floor(gridRect.right - cardRect.left));
    }

    let rafId = 0;
    const onMove = (ev: MouseEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const nextW = Math.max(MIN_CARD_W, Math.min(maxW, Math.round(startW + dx)));
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
    document.body.style.cursor = "nwse-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ユーザーがリサイズした widthPx を優先（layoutWidthPx は未設定時のデフォルト幅のみ）
  const displayW = widthPx ?? layoutWidthPx;

  return (
    <div
      ref={setRef}
      data-widget-id={id}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.45 : 1,
        flex: stackFullWidth
          ? "0 0 100%"
          : displayW
            ? `0 0 ${displayW}px`
            : "0 0 calc(33.333% - 11px)",
        minWidth: 0,
        maxWidth: "100%",
        ...(height ? { height, display: "flex", flexDirection: "column" } : {}),
        boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.12)" : undefined,
      }}
      {...attributes}
      className="relative h-full min-h-0 min-w-0"
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
        className="absolute bottom-0 right-0 z-40 h-6 w-6 cursor-nwse-resize touch-none select-none"
      />

      <div className="flex-1 min-h-0 flex flex-col w-full h-full [&>*]:w-full [&>*]:h-full [&>*]:min-h-0">
        {children}
      </div>
    </div>
  );
}
