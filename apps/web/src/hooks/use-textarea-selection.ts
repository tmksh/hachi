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
  const [mounted, setMounted] = useState(false);

  const setRef = useCallback((node: HTMLTextAreaElement | null) => {
    elementRef.current = node;
    setMounted(Boolean(node));
  }, []);

  const sync = useCallback(() => {
    setSelection(readTextareaSelection(elementRef.current));
  }, []);

  const clear = useCallback(() => {
    setSelection("");
  }, []);

  useEffect(() => {
    const scheduleSync = () => {
      requestAnimationFrame(() => {
        setSelection(readTextareaSelection(elementRef.current));
      });
    };

    const onSelectionChange = () => {
      const el = elementRef.current;
      if (!el) return;
      if (document.activeElement === el) scheduleSync();
    };

    const onPointerUp = () => scheduleSync();

    const onPointerDown = (e: PointerEvent) => {
      const el = elementRef.current;
      if (!el) return;
      const target = e.target as Node;
      if (el.contains(target)) return;
      if ((target as HTMLElement).closest?.("[data-text-selection-toolbar]")) return;
      requestAnimationFrame(() => {
        if (!readTextareaSelection(el)) clear();
      });
    };

    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointerdown", onPointerDown);

    if (mounted) scheduleSync();

    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [clear, mounted]);

  const handlers = {
    onSelect: sync,
    onMouseUp: sync,
    onKeyUp: sync,
    onTouchEnd: sync,
    onPointerUp: sync,
  };

  return { ref: setRef, selection, sync, clear, handlers };
}
