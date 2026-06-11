"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getDashboardSettings, saveDashboardSettings } from "@/lib/actions/dashboard-settings";

export interface WidgetConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  /** ピクセル単位の幅（未設定なら 1/3 列を占める） */
  widthPx?: number;
  /** ピクセル単位の高さ（未設定ならコンテンツに追従） */
  height?: number;
  /** @deprecated 旧グリッド版の互換用 */
  colSpan?: number;
  /** @deprecated 旧グリッド版の互換用 */
  rowSpan?: number;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "ai-focus",        label: "AIフォーカス",     visible: true,  order: 0 },
  { id: "attendance",      label: "勤怠",             visible: true,  order: 1 },
  { id: "mail",            label: "お知らせ",          visible: true,  order: 2 },
  { id: "workflow",        label: "ワークフロー",      visible: true,  order: 3 },
  { id: "kpi-won",           label: "受注額",          visible: true,  order: 4 },
  { id: "kpi-pipeline",     label: "パイプライン",    visible: true,  order: 5 },
  { id: "kpi-customers",    label: "顧客数",          visible: true,  order: 6 },
  { id: "kpi-constructions", label: "進行案件",       visible: true,  order: 7 },
  { id: "kpi-deals",        label: "商談数",          visible: true,  order: 8 },
  { id: "kpi-unpaid",       label: "未入金",          visible: true,  order: 9 },
  { id: "kpi-approvals",    label: "承認待ち",        visible: true,  order: 10 },
  { id: "kpi-contracts",    label: "進行中契約",      visible: true,  order: 11 },
  { id: "trend",           label: "売上トレンド",      visible: true,  order: 12 },
  { id: "deals",           label: "商談パイプライン",  visible: true,  order: 13 },
  { id: "quotes",          label: "最近の見積",        visible: true,  order: 14 },
  { id: "customers",       label: "最近の顧客",        visible: true,  order: 15 },
  { id: "production",      label: "生産サマリー",      visible: true,  order: 16 },
  { id: "constructions",   label: "進行中の工事",      visible: true,  order: 17 },
  { id: "unfollowed",      label: "未フォローアップ",  visible: false, order: 18 },
];

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

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ハイドレーション完了後の変更のみ永続化するためのフラグ
  const skipPersistRef = useRef(true);

  // 起動時: localStorage で即時表示 → DB はアイドル時に同期
  useEffect(() => {
    const local = loadFromLocalStorage();
    setWidgets(local);
    setHydrated(true);
    skipPersistRef.current = false;

    const syncFromDb = () => {
      getDashboardSettings().then((dbWidgets) => {
        if (dbWidgets && dbWidgets.length > 0) {
          const merged = mergeWithDefaults(dbWidgets);
          setWidgets(merged);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        }
      }).catch(() => {});
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = window.requestIdleCallback(syncFromDb, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(syncFromDb, 1500);
    return () => clearTimeout(t);
  }, []);

  // widgets が変化したら localStorage + DB に自動保存（ハイドレーション後のみ）
  useEffect(() => {
    if (skipPersistRef.current) return;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDashboardSettings(widgets).catch(() => {});
    }, 500);
  }, [widgets]);

  const toggleVisible = useCallback((id: string) => {
    setWidgets((prev) =>
      prev.map((w) => w.id === id ? { ...w, visible: !w.visible } : w)
    );
  }, []);

  const moveUp = useCallback((id: string) => {
    setWidgets((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((w) => w.id === id);
      if (idx <= 0) return prev;
      return sorted.map((w, i) => {
        if (i === idx - 1) return { ...w, order: sorted[idx].order };
        if (i === idx)     return { ...w, order: sorted[idx - 1].order };
        return w;
      });
    });
  }, []);

  const moveDown = useCallback((id: string) => {
    setWidgets((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((w) => w.id === id);
      if (idx >= sorted.length - 1) return prev;
      return sorted.map((w, i) => {
        if (i === idx)     return { ...w, order: sorted[idx + 1].order };
        if (i === idx + 1) return { ...w, order: sorted[idx].order };
        return w;
      });
    });
  }, []);

  /** ピクセル単位で width / height を自由設定（スナップなし） */
  const resizeWidget = useCallback((id: string, widthPx: number, height: number) => {
    setWidgets((prev) =>
      prev.map((w) =>
        w.id === id
          ? { ...w, widthPx: Math.max(160, Math.round(widthPx)), height: Math.max(100, Math.round(height)) }
          : w,
      ),
    );
  }, []);

  const setWidgetWidth = useCallback((id: string, widthPx: number) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, widthPx: Math.max(160, Math.round(widthPx)) } : w)),
    );
  }, []);

  const initWidths = useCallback((updates: Record<string, number>) => {
    setWidgets((prev) =>
      prev.map((w) =>
        updates[w.id] !== undefined && w.widthPx === undefined
          ? { ...w, widthPx: updates[w.id] }
          : w,
      ),
    );
  }, []);

  const reorder = useCallback((activeId: string, overId: string) => {
    setWidgets((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const activeIdx = sorted.findIndex((w) => w.id === activeId);
      const overIdx   = sorted.findIndex((w) => w.id === overId);
      if (activeIdx === -1 || overIdx === -1 || activeIdx === overIdx) return prev;
      const next = [...sorted];
      const [moved] = next.splice(activeIdx, 1);
      next.splice(overIdx, 0, moved);
      return next.map((w, i) => ({ ...w, order: i }));
    });
  }, []);

  const reset = useCallback(() => {
    setWidgets(DEFAULT_WIDGETS);
  }, []);

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
