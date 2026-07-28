"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type TextSelectionToolbarProps = {
  visible: boolean;
  className?: string;
  children: ReactNode;
};

/** テキスト選択時のフローティングツールバー（mousedown で textarea の選択が消えないよう preventDefault） */
export function TextSelectionToolbar({
  visible,
  className,
  children,
}: TextSelectionToolbarProps) {
  if (!visible) return null;

  return (
    <div
      data-text-selection-toolbar
      role="toolbar"
      aria-label="選択テキストの操作"
      className={cn(
        "absolute z-20 flex gap-1 rounded-lg border border-border/80 bg-background/95 backdrop-blur-sm shadow-md p-1",
        "left-1/2 -translate-x-1/2 top-2",
        className,
      )}
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </div>
  );
}
