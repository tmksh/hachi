"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type TextSelectionToolbarProps = {
  visible: boolean;
  anchorRect?: DOMRect | null;
  className?: string;
  children: ReactNode;
};

/** テキスト選択時のフローティングツールバー（Portal + fixed で overflow クリップを回避） */
export function TextSelectionToolbar({
  visible,
  anchorRect,
  className,
  children,
}: TextSelectionToolbarProps) {
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  if (!visible || !anchorRect || !portalReady) return null;

  const top = Math.max(8, anchorRect.top - 44);
  const left = anchorRect.left + anchorRect.width / 2;

  return createPortal(
    <div
      data-text-selection-toolbar
      role="toolbar"
      aria-label="選択テキストの操作"
      style={{ position: "fixed", top, left, transform: "translateX(-50%)", zIndex: 9999 }}
      className={cn(
        "flex gap-1 rounded-lg border border-border/80 bg-background/95 backdrop-blur-sm shadow-md p-1",
        className,
      )}
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </div>,
    document.body,
  );
}
