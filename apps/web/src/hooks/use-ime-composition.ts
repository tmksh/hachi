"use client";

import { useCallback, useRef } from "react";

/**
 * 変換候補クリック後、一部ブラウザは compositionend と同じティックで Enter を飛ばす。
 * 長すぎると「確定の Enter → 送信の Enter」が潰れるので、同一タスク＋ごく短い待ちだけ止める。
 */
const IME_SUBMIT_LOCK_MS = 50;

type KeyLike = {
  key?: string;
  keyCode?: number;
  nativeEvent?: { isComposing?: boolean; keyCode?: number };
};

export function isImeComposingKey(e: KeyLike): boolean {
  const ne = e.nativeEvent;
  return Boolean(
    ne?.isComposing ||
      e.keyCode === 229 ||
      ne?.keyCode === 229 ||
      e.key === "Process",
  );
}

export function useImeComposition(lockMs = IME_SUBMIT_LOCK_MS) {
  const composingRef = useRef(false);
  const lockUntilRef = useRef(0);
  const sendArmedRef = useRef(false);

  const onCompositionStart = useCallback(() => {
    composingRef.current = true;
  }, []);

  const onCompositionEnd = useCallback(() => {
    composingRef.current = false;
    lockUntilRef.current = Date.now() + lockMs;
  }, [lockMs]);

  const shouldBlockSubmit = useCallback((e?: KeyLike) => {
    if (composingRef.current) return true;
    if (Date.now() < lockUntilRef.current) return true;
    return Boolean(e && isImeComposingKey(e));
  }, []);

  /** 変換候補ウィンドウが送信ボタンに重なり、mouseup だけ届く誤送信を防ぐ */
  const armSend = useCallback(() => {
    sendArmedRef.current = true;
  }, []);

  const shouldIgnoreSendClick = useCallback(() => {
    const armed = sendArmedRef.current;
    sendArmedRef.current = false;
    if (armed) return false;
    return composingRef.current || Date.now() < lockUntilRef.current;
  }, []);

  return {
    onCompositionStart,
    onCompositionEnd,
    shouldBlockSubmit,
    armSend,
    shouldIgnoreSendClick,
  };
}
