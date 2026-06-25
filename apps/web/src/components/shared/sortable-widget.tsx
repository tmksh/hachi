"use client";

import { useRef, useCallback } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/** 縦スナップの基本単位（px） */
export const ROW_H = 100;
/** 縦の最小行数 */
export const MIN_ROWS = 2;
export const MIN_CARD_H = ROW_H * MIN_ROWS;
/** 12カラムグリッドの最小スパン数 */
export const MIN_COLS = 3;
/** グリッドの総カラム数 */
export const GRID_COLS = 12;
/** デフォルトのスパン数（1/3幅） */
export const DEFAULT_COLS = 4;

/** ピクセル値を ROW_H の倍数にスナップ */
function snapHeight(px: number): number {
  return Math.max(MIN_ROWS * ROW_H, Math.round(px / ROW_H) * ROW_H);
}

export interface SortableWidgetProps {
  id: string;
  /** 12カラムグリッドでのスパン数（1〜12） */
  cols?: number;
  /** ユーザー未設定時のデフォルトスパン数（コンテナ幅に応じて変動） */
  defaultCols?: number;
  /** チャット開時など: グリッド幅いっぱい（col-span-12） */
  stackFullWidth?: boolean;
  height?: number;
  onResize: (id: string, cols: number, height: number) => void;
  /** @deprecated 互換のため残置（未使用） */
  onInitWidths?: (updates: Record<string, number>) => void;
  children: React.ReactNode;
}

export function SortableWidget({
  id,
  cols,
  defaultCols = DEFAULT_COLS,
  stackFullWidth = false,
  height,
  onResize,
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

  // ── 12カラムグリッドスナップリサイズ ──
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const card = innerRef.current;
    const grid = card?.closest("[data-widget-grid]") as HTMLElement | null;
    if (!card || !grid) return;

    const cardRect = card.getBoundingClientRect();
    const gridWidth = grid.clientWidth;
    const colUnit = gridWidth / GRID_COLS;
    const currentCols = cols ?? defaultCols;
    // 開始高さ: 保存値があればそれを使い、なければ現在の描画高をスナップ済みとして扱う
    const startH = height ?? snapHeight(Math.round(cardRect.height));

    const startX = e.clientX;
    const startY = e.clientY;

    let rafId = 0;
    const onMove = (ev: MouseEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        // 横: カラム数スナップ
        const targetCols = Math.max(
          MIN_COLS,
          Math.min(GRID_COLS, Math.round((currentCols * colUnit + dx) / colUnit)),
        );
        // 縦: ROW_H の倍数スナップ
        const targetH = snapHeight(startH + dy);
        onResize(id, targetCols, targetH);
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

  const effectiveCols = stackFullWidth ? GRID_COLS : (cols ?? defaultCols);

  return (
    <div
      ref={setRef}
      data-widget-id={id}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.45 : 1,
        gridColumn: `span ${effectiveCols}`,
        minWidth: 0,
        ...(height ? { height, display: "flex", flexDirection: "column" } : {}),
        boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.12)" : undefined,
      }}
      {...attributes}
      className="relative min-h-0 min-w-0"
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
