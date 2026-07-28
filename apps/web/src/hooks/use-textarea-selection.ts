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
 * textarea のテキスト選択を追跡（onSelect のみだとドラッグ選択で取りこぼすため mouseup/keyup も監視）
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
    const onPointerDown = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const target = e.target as Node;
      if (el.contains(target)) return;
      if ((target as HTMLElement).closest?.("[data-text-selection-toolbar]")) return;
      clear();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [ref, clear]);

  const handlers = {
    onSelect: sync,
    onMouseUp: sync,
    onKeyUp: sync,
    onTouchEnd: sync,
  };

  return { ref, selection, sync, clear, handlers };
}
