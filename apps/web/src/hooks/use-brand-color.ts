"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { DEFAULT_HEX, applyBrandColor, type BrandMode } from "@/lib/brand-color";

const KEY_GRADIENT = "dashboard-brand-hex";
const KEY_SOLID    = "dashboard-brand-hex-solid";
const KEY_MODE     = "dashboard-brand-mode";
const BRAND_EVENT  = "bridge:brand-color";

function load(key: string, fallback: string) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

type BrandState = { gradientHex: string; solidHex: string; mode: BrandMode };

function readInitial(): BrandState {
  if (typeof window === "undefined") {
    return { gradientHex: DEFAULT_HEX, solidHex: DEFAULT_HEX, mode: "gradient" };
  }
  const mode = load(KEY_MODE, "gradient") as BrandMode;
  return {
    gradientHex: load(KEY_GRADIENT, DEFAULT_HEX),
    solidHex: load(KEY_SOLID, DEFAULT_HEX),
    mode: mode === "solid" ? "solid" : "gradient",
  };
}

/** アプリ全体で CSS 変数適用は1回だけ行う */
let brandCssApplied = false;

function persistAndApply(next: BrandState) {
  applyBrandColor(next.mode === "solid" ? next.solidHex : next.gradientHex, next.mode);
  brandCssApplied = true;
  try {
    localStorage.setItem(KEY_GRADIENT, next.gradientHex);
    localStorage.setItem(KEY_SOLID, next.solidHex);
    localStorage.setItem(KEY_MODE, next.mode);
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(BRAND_EVENT, { detail: next }));
}

export function useBrandColor() {
  const [state, setState] = useState(readInitial);
  const stateRef = useRef(state);
  stateRef.current = state;

  // マウント時: setState せず CSS だけ適用（再レンダー誘発を避ける）
  useEffect(() => {
    if (brandCssApplied) return;
    brandCssApplied = true;
    const { gradientHex, solidHex, mode } = stateRef.current;
    applyBrandColor(mode === "solid" ? solidHex : gradientHex, mode);
  }, []);

  // 同タブ内の他インスタンスからの変更を受信
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<BrandState>).detail;
      setState((prev) => {
        if (
          prev.gradientHex === detail.gradientHex
          && prev.solidHex === detail.solidHex
          && prev.mode === detail.mode
        ) {
          return prev;
        }
        return detail;
      });
    };
    window.addEventListener(BRAND_EVENT, handler);
    return () => window.removeEventListener(BRAND_EVENT, handler);
  }, []);

  const setGradientColor = useCallback((hex: string) => {
    const prev = stateRef.current;
    if (prev.gradientHex === hex) return;
    const next = { ...prev, gradientHex: hex };
    setState(next);
    persistAndApply(next);
  }, []);

  const setSolidColor = useCallback((hex: string) => {
    const prev = stateRef.current;
    if (prev.solidHex === hex) return;
    const next = { ...prev, solidHex: hex };
    setState(next);
    persistAndApply(next);
  }, []);

  const switchMode = useCallback((m: BrandMode) => {
    const prev = stateRef.current;
    if (prev.mode === m) return;
    const next = { ...prev, mode: m };
    setState(next);
    persistAndApply(next);
  }, []);

  const reset = useCallback(() => {
    const next: BrandState = {
      gradientHex: DEFAULT_HEX,
      solidHex: DEFAULT_HEX,
      mode: "gradient",
    };
    setState(next);
    persistAndApply(next);
    try {
      localStorage.removeItem(KEY_GRADIENT);
      localStorage.removeItem(KEY_SOLID);
      localStorage.removeItem(KEY_MODE);
    } catch { /* ignore */ }
  }, []);

  const hex = state.mode === "solid" ? state.solidHex : state.gradientHex;

  return {
    hex,
    color: hex,
    gradientHex: state.gradientHex,
    solidHex: state.solidHex,
    mode: state.mode,
    setGradientColor,
    setSolidColor,
    switchMode,
    reset,
  };
}
