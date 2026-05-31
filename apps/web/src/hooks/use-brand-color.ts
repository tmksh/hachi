"use client";

import { useState, useEffect, useCallback } from "react";
import { DEFAULT_HEX, applyBrandColor, type BrandMode } from "@/lib/brand-color";

const KEY_GRADIENT = "dashboard-brand-hex";
const KEY_SOLID    = "dashboard-brand-hex-solid";
const KEY_MODE     = "dashboard-brand-mode";
const BRAND_EVENT  = "bridge:brand-color";

function load(key: string, fallback: string) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

export function useBrandColor() {
  const [gradientHex, setGradientHex] = useState(DEFAULT_HEX);
  const [solidHex,    setSolidHex]    = useState(DEFAULT_HEX);
  const [mode,        setMode]        = useState<BrandMode>("gradient");

  // マウント時: localStorage から読み込み + CSS 変数適用
  useEffect(() => {
    const gHex = load(KEY_GRADIENT, DEFAULT_HEX);
    const sHex = load(KEY_SOLID,    DEFAULT_HEX);
    const m    = (load(KEY_MODE, "gradient") as BrandMode);
    setGradientHex(gHex);
    setSolidHex(sHex);
    setMode(m);
    applyBrandColor(m === "solid" ? sHex : gHex, m);
  }, []);

  // 同タブ内の他インスタンスからの変更を受信
  useEffect(() => {
    const handler = (e: Event) => {
      const { gradientHex: gH, solidHex: sH, mode: m } = (e as CustomEvent).detail;
      setGradientHex(gH);
      setSolidHex(sH);
      setMode(m);
    };
    window.addEventListener(BRAND_EVENT, handler);
    return () => window.removeEventListener(BRAND_EVENT, handler);
  }, []);

  const _dispatch = (gH: string, sH: string, m: BrandMode) => {
    applyBrandColor(m === "solid" ? sH : gH, m);
    try {
      localStorage.setItem(KEY_GRADIENT, gH);
      localStorage.setItem(KEY_SOLID,    sH);
      localStorage.setItem(KEY_MODE,     m);
    } catch {}
    window.dispatchEvent(new CustomEvent(BRAND_EVENT, { detail: { gradientHex: gH, solidHex: sH, mode: m } }));
  };

  const setGradientColor = useCallback((hex: string) => {
    setGradientHex(hex);
    if (mode === "gradient") _dispatch(hex, solidHex, "gradient");
    else _dispatch(hex, solidHex, mode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, solidHex]);

  const setSolidColor = useCallback((hex: string) => {
    setSolidHex(hex);
    if (mode === "solid") _dispatch(gradientHex, hex, "solid");
    else _dispatch(gradientHex, hex, mode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, gradientHex]);

  const switchMode = useCallback((m: BrandMode) => {
    setMode(m);
    _dispatch(gradientHex, solidHex, m);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradientHex, solidHex]);

  const reset = useCallback(() => {
    setGradientHex(DEFAULT_HEX);
    setSolidHex(DEFAULT_HEX);
    setMode("gradient");
    _dispatch(DEFAULT_HEX, DEFAULT_HEX, "gradient");
    try {
      localStorage.removeItem(KEY_GRADIENT);
      localStorage.removeItem(KEY_SOLID);
      localStorage.removeItem(KEY_MODE);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 後方互換: hex / color / setColor
  const hex   = mode === "solid" ? solidHex : gradientHex;
  const color = hex;

  return { hex, color, gradientHex, solidHex, mode, setGradientColor, setSolidColor, switchMode, reset };
}
