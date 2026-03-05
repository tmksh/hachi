"use client";

import { useState, useEffect, useCallback } from "react";

export interface WidgetConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "ai-focus",       label: "AIフォーカス",   visible: true,  order: 0 },
  { id: "attendance",     label: "勤怠",           visible: true,  order: 1 },
  { id: "mail",           label: "メール",          visible: true,  order: 2 },
  { id: "workflow",       label: "ワークフロー",    visible: true,  order: 3 },
  { id: "kpi",            label: "KPI指標",         visible: true,  order: 4 },
  { id: "customers",      label: "最近の顧客",      visible: true,  order: 5 },
  { id: "constructions",  label: "進行中の工事",    visible: true,  order: 6 },
];

const STORAGE_KEY = "dashboard-widgets-v1";

function loadFromStorage(): WidgetConfig[] {
  if (typeof window === "undefined") return DEFAULT_WIDGETS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WIDGETS;
    const parsed: WidgetConfig[] = JSON.parse(raw);
    // merge: keep defaults for any new widgets not yet in storage
    const stored = new Map(parsed.map((w) => [w.id, w]));
    return DEFAULT_WIDGETS.map((def) =>
      stored.has(def.id) ? { ...def, ...stored.get(def.id) } : def
    ).sort((a, b) => a.order - b.order);
  } catch {
    return DEFAULT_WIDGETS;
  }
}

export function useWidgets() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setWidgets(loadFromStorage());
    setHydrated(true);
  }, []);

  const save = useCallback((next: WidgetConfig[]) => {
    setWidgets(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const toggleVisible = useCallback((id: string) => {
    setWidgets((prev) => {
      const next = prev.map((w) =>
        w.id === id ? { ...w, visible: !w.visible } : w
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const moveUp = useCallback((id: string) => {
    setWidgets((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((w) => w.id === id);
      if (idx <= 0) return prev;
      const next = sorted.map((w, i) => {
        if (i === idx - 1) return { ...w, order: sorted[idx].order };
        if (i === idx)     return { ...w, order: sorted[idx - 1].order };
        return w;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const moveDown = useCallback((id: string) => {
    setWidgets((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((w) => w.id === id);
      if (idx >= sorted.length - 1) return prev;
      const next = sorted.map((w, i) => {
        if (i === idx)     return { ...w, order: sorted[idx + 1].order };
        if (i === idx + 1) return { ...w, order: sorted[idx].order };
        return w;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    save(DEFAULT_WIDGETS);
  }, [save]);

  const sorted = [...widgets].sort((a, b) => a.order - b.order);

  return { widgets: sorted, hydrated, toggleVisible, moveUp, moveDown, reset };
}
