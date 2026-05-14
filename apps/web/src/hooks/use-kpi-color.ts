"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "dashboard-kpi-color";
const DEFAULT_COLOR = "#1a7a52";

export function useKpiColor() {
  const [color, setColorState] = useState(DEFAULT_COLOR);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setColorState(saved);
    } catch {}
  }, []);

  const setColor = useCallback((c: string) => {
    setColorState(c);
    try { localStorage.setItem(STORAGE_KEY, c); } catch {}
  }, []);

  const reset = useCallback(() => {
    setColorState(DEFAULT_COLOR);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  return { color, setColor, reset };
}
