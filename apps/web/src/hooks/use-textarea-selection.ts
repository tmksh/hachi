"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** textarea の選択範囲テキストを取得 */
export function readTextareaSelection(el: HTMLTextAreaElement | null): string {
  if (!el) return "";
  const { selectionStart, selectionEnd, value } = el;
  if (
    selectionStart == null ||
    selectionEnd == null ||
    selectionStart === selectionEnd
  ) {
    return "";
  }
  return value.slice(selectionStart, selectionEnd);
}

/**
 * textarea のテキスト選択を追跡。
 * ローディング後に textarea がマウントされても効くよう callback ref + document 監視。
 */
export function useTextareaSelection() {
  const elementRef = useRef<HTMLTextAreaElement | null>(null);
  const [selection, setSelection] = useState("");
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);

  const setRef = useCallback((node: HTMLTextAreaElement | null) => {
    elementRef.current = node;
    setMounted(Boolean(node));
  }, []);

  const applySelection = useCallback((el: HTMLTextAreaElement | null) => {
    const text = readTextareaSelection(el);
    setSelection(text);
    setAnchorRect(text && el ? el.getBoundingClientRect() : null);
  }, []);

  const sync = useCallback(() => {
    applySelection(elementRef.current);
  }, [applySelection]);

  const clear = useCallback(() => {
    setSelection("");
    setAnchorRect(null);
  }, []);

  useEffect(() => {
    const scheduleSync = () => {
      // ブラウザが selectionStart/End を確定するまで 1–2 フレーム待つ
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          applySelection(elementRef.current);
        });
      });
    };

    const onSelectionChange = () => {
      const el = elementRef.current;
      if (!el) return;
      if (document.activeElement === el || readTextareaSelection(el)) {
        scheduleSync();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const el = elementRef.current;
      const target = e.target as Node | null;
      if (el && target && (el === target || el.contains(target))) {
        scheduleSync();
        return;
      }
      scheduleSync();
    };

    const onClick = (e: MouseEvent) => {
      const el = elementRef.current;
      if (!el) return;
      const target = e.target as Node;
      if (el.contains(target)) {
        scheduleSync();
        return;
      }
      if ((target as HTMLElement).closest?.("[data-text-selection-toolbar]")) return;
      // 選択確定の click と外側クリックが競合しないよう、1フレーム遅らせて判定
      requestAnimationFrame(() => {
        if (!readTextareaSelection(elementRef.current)) clear();
      });
    };

    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("mouseup", onPointerUp as EventListener);
    document.addEventListener("click", onClick, true);

    if (mounted) scheduleSync();

    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("mouseup", onPointerUp as EventListener);
      document.removeEventListener("click", onClick, true);
    };
  }, [applySelection, clear, mounted]);

  const handlers = {
    onSelect: sync,
    onMouseUp: sync,
    onKeyUp: sync,
    onTouchEnd: sync,
    onPointerUp: sync,
    onFocus: sync,
  };

  return { ref: setRef, selection, anchorRect, sync, clear, handlers };
}
