"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/** textarea の選択範囲テキストを取得 */
export function readTextareaSelection(el: HTMLTextAreaElement | null): string {
  if (!el) return "";
  const { selectionStart, selectionEnd, value } = el;
  if (selectionStart === selectionEnd) return "";
  return value.slice(selectionStart, selectionEnd);
}

/**
 * textarea のテキスト選択を追跡。
 * ドラッグ選択で mouseup が textarea 外になるケースも document レベルで捕捉する。
 */
export function useTextareaSelection(externalRef?: RefObject<HTMLTextAreaElement | null>) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const ref = externalRef ?? internalRef;
  const [selection, setSelection] = useState("");

  const sync = useCallback(() => {
    setSelection(readTextareaSelection(ref.current));
  }, [ref]);

  const clear = useCallback(() => {
    setSelection("");
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const scheduleSync = () => {
      requestAnimationFrame(() => sync());
    };

    const onSelectionChange = () => {
      if (document.activeElement === el) scheduleSync();
    };

    const onPointerUp = () => scheduleSync();

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (el.contains(target)) return;
      if ((target as HTMLElement).closest?.("[data-text-selection-toolbar]")) return;
      requestAnimationFrame(() => {
        const text = readTextareaSelection(el);
        if (!text) clear();
      });
    };

    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [ref, sync, clear]);

  const handlers = {
    onSelect: sync,
    onMouseUp: sync,
    onKeyUp: sync,
    onTouchEnd: sync,
    onPointerUp: sync,
  };

  return { ref, selection, sync, clear, handlers };
}
