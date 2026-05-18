"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getDashboardSettings, saveDashboardSettings } from "@/lib/actions/dashboard-settings";

export interface WidgetConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  widthPx?: number;
  height?: number;
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

// localStorage キーはユーザーIDを含まないが、ログイン前の即時表示用として残す
const STORAGE_KEY = "dashboard-widgets-v1";

function mergeWithDefaults(stored: WidgetConfig[]): WidgetConfig[] {
  const map = new Map(stored.map((w) => [w.id, w]));
  return DEFAULT_WIDGETS.map((def) =>
    map.has(def.id) ? { ...def, ...map.get(def.id) } : def
  ).sort((a, b) => a.order - b.order);
}

function loadFromLocalStorage(): WidgetConfig[] {
  if (typeof window === "undefined") return DEFAULT_WIDGETS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WIDGETS;
    return mergeWithDefaults(JSON.parse(raw) as WidgetConfig[]);
  } catch {
    return DEFAULT_WIDGETS;
  }
}

export function useWidgets() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  const [hydrated, setHydrated] = useState(false);

  // DB への保存をデバウンスするため ref でタイマー管理
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 起動時: まず localStorage で即時表示 → DB から上書き
  useEffect(() => {
    const local = loadFromLocalStorage();
    setWidgets(local);

    getDashboardSettings().then((dbWidgets) => {
      if (dbWidgets && dbWidgets.length > 0) {
        const merged = mergeWithDefaults(dbWidgets);
        setWidgets(merged);
        // DB の値を localStorage にも反映
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      }
      setHydrated(true);
    }).catch(() => {
      // DB 取得失敗時は localStorage のまま継続
      setHydrated(true);
    });
  }, []);

  /** localStorage + DB (debounced) に保存 */
  const save = useCallback((next: WidgetConfig[]) => {
    setWidgets(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

    // 500ms デバウンス: 連続操作（ドラッグ中など）でも最後の値だけ DB に送る
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDashboardSettings(next).catch(() => {});
    }, 500);
  }, []);

  const toggleVisible = useCallback((id: string) => {
    setWidgets((prev) => {
      const next = prev.map((w) =>
        w.id === id ? { ...w, visible: !w.visible } : w
      );
      save(next);
      return next;
    });
  }, [save]);

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
      save(next);
      return next;
    });
  }, [save]);

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
      save(next);
      return next;
    });
  }, [save]);

  const resizeWidget = useCallback((id: string, widthPx: number, height: number) => {
    setWidgets((prev) => {
      const next = prev.map((w) =>
        w.id === id ? { ...w, widthPx, height } : w
      );
      save(next);
      return next;
    });
  }, [save]);

  const setWidgetWidth = useCallback((id: string, widthPx: number) => {
    setWidgets((prev) => {
      const next = prev.map((w) =>
        w.id === id ? { ...w, widthPx } : w
      );
      save(next);
      return next;
    });
  }, [save]);

  const initWidths = useCallback((updates: Record<string, number>) => {
    setWidgets((prev) => {
      const next = prev.map((w) =>
        updates[w.id] !== undefined && w.widthPx === undefined
          ? { ...w, widthPx: updates[w.id] }
          : w
      );
      save(next);
      return next;
    });
  }, [save]);

  const reorder = useCallback((activeId: string, overId: string) => {
    setWidgets((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const activeIdx = sorted.findIndex((w) => w.id === activeId);
      const overIdx   = sorted.findIndex((w) => w.id === overId);
      if (activeIdx === -1 || overIdx === -1 || activeIdx === overIdx) return prev;
      const next = [...sorted];
      const [moved] = next.splice(activeIdx, 1);
      next.splice(overIdx, 0, moved);
      const reassigned = next.map((w, i) => ({ ...w, order: i }));
      save(reassigned);
      return reassigned;
    });
  }, [save]);

  const reset = useCallback(() => {
    save(DEFAULT_WIDGETS);
  }, [save]);

  const sorted = [...widgets].sort((a, b) => a.order - b.order);

  return {
    widgets: sorted,
    hydrated,
    toggleVisible,
    moveUp,
    moveDown,
    reorder,
    resizeWidget,
    setWidgetWidth,
    initWidths,
    reset,
  };
}
