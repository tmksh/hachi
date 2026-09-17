"use client";

import { useState, useEffect, useRef } from "react";

/**
 * グリッドコンテナ幅に応じてデフォルトのカラムスパンを返す。
 * 幅が広いほど多列（小さいスパン数）になる。
 *
 * 目安（コンテナ幅 = ビューポート幅 - サイドバー - ページ余白）
 *   >= 1050px → 4列（col-span-3）  ≒ ビューポート 1280〜1400px+
 *   >= 600px  → 3列（col-span-4）  ← 従来のデフォルト
 *   < 600px   → 2列（col-span-6）  ← 狭め
 */
function computeDefaultCols(containerWidth: number): number {
  if (containerWidth >= 1050) return 3;
  if (containerWidth >= 600) return 4;
  if (containerWidth >= 420) return 6;
  return 12;
}

/** これ未満の幅では1列積み（スマホ幅、またはチャット2枚展開時） */
const STACK_WIDTH = 420;

/** ウィジェットグリッドのコンテナ幅計測・チャット開閉・デフォルト列数算出 */
export function useWidgetGridLayout() {
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

  // チャット展開時は全カードを col-span-12 にせず、縮んだコンテナ幅から列数を再計算する
  // （以前は全幅積みにしていたため勤怠カード等が極端に横長になっていた）
  const stackFullWidth = containerWidth > 0 && containerWidth < STACK_WIDTH;
  const defaultCols = computeDefaultCols(containerWidth);

  return { gridRef, containerWidth, stackFullWidth, defaultCols };
}
