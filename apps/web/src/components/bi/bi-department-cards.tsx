"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type BiDeptCardData = {
  id: string;
  name: string;
  label: string;
  revenue: number;
  grossProfit: number;
  target: number | null;
  gpTarget: number | null;
  achieveRate: number;
  yoyRatio: number | null;
  prevRevenue: number;
  gpRate: number;
  deptSga: number;
  deptOp: number;
  color: string;
};

type BiDepartmentCardsProps = {
  fiscalYear: number;
  departments: BiDeptCardData[];
  showTheoretical: boolean;
  fmtMan: (v: number) => string;
  fmtSigned: (v: number) => string;
  fmtRatio: (ratio: number | null) => string;
  yoyRatioClass: (ratio: number | null) => string;
};

function storageKey(fiscalYear: number) {
  return `bi-dept-order:${fiscalYear}`;
}

/** 達成率から、ひと目でわかる評価 */
function achieveStatus(rate: number | null) {
  if (rate == null) return { label: "目標未設定", tone: "muted" as const };
  if (rate >= 100) return { label: "目標達成", tone: "good" as const };
  if (rate >= 70) return { label: "順調", tone: "good" as const };
  if (rate >= 40) return { label: "やや遅れ", tone: "warn" as const };
  return { label: "遅れ気味", tone: "bad" as const };
}

function yoyPlain(ratio: number | null): { text: string; tone: "good" | "bad" | "muted" } {
  if (ratio == null) return { text: "前年データなし", tone: "muted" };
  const diff = Math.round((ratio - 100) * 10) / 10;
  if (diff > 0) return { text: `前年より +${diff}%`, tone: "good" };
  if (diff < 0) return { text: `前年より ${diff}%`, tone: "bad" };
  return { text: "前年と同じ", tone: "muted" };
}

function SortableDeptCard({
  dept,
  showTheoretical,
  fmtMan,
  fmtSigned,
}: {
  dept: BiDeptCardData;
  showTheoretical: boolean;
  fmtMan: (v: number) => string;
  fmtSigned: (v: number) => string;
  fmtRatio: (ratio: number | null) => string;
  yoyRatioClass: (ratio: number | null) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: dept.id,
  });

  const hasTarget = dept.target != null && dept.target > 0;
  const rate = hasTarget ? dept.achieveRate : null;
  const status = achieveStatus(rate);
  const yoy = yoyPlain(dept.yoyRatio);
  const remain =
    hasTarget && dept.target != null
      ? Math.max(0, Math.round(dept.target - dept.revenue))
      : null;

  const YoyIcon =
    yoy.tone === "good" ? TrendingUp : yoy.tone === "bad" ? TrendingDown : Minus;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
      }}
      className={cn(
        "frost-card rounded-xl p-4 flex flex-col gap-3.5 border border-border/50",
        isDragging && "opacity-60 shadow-lg",
      )}
    >
      {/* 部門名 + 評価 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0 bg-[var(--brand-dark)]"
            style={dept.color ? { backgroundColor: dept.color } : undefined}
          />
          <div className="min-w-0">
            <p className="font-bold text-base text-foreground truncate leading-tight">{dept.name}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{dept.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {status.label}
          </span>
          <button
            type="button"
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-grab active:cursor-grabbing touch-none"
            aria-label={`${dept.name}を並び替え`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* いちばん大事：売上と達成 */}
      <div>
        <p className="text-xs text-muted-foreground">いまの売上</p>
        <p className="text-2xl font-bold tabular-nums tracking-tight mt-0.5 leading-none text-foreground">
          {fmtMan(dept.revenue)}
        </p>
        <p className="text-xs text-muted-foreground mt-1.5">
          年間目標{" "}
          <span className="font-medium text-foreground">
            {dept.target != null ? fmtMan(dept.target) : "未設定"}
          </span>
          {remain != null && remain > 0 && (
            <span className="ml-1.5">（あと {fmtMan(remain)}）</span>
          )}
          {remain === 0 && hasTarget && (
            <span className="ml-1.5 font-medium text-foreground">目標クリア</span>
          )}
        </p>
      </div>

      {/* 達成バー（ブランド色のみ） */}
      <div className="space-y-1.5">
        <div className="flex items-end justify-between gap-2">
          <span className="text-xs text-muted-foreground">目標達成まで</span>
          <span
            className={cn(
              "text-xl font-bold tabular-nums leading-none",
              rate == null ? "text-muted-foreground" : "text-[var(--brand-dark)]",
            )}
          >
            {rate != null ? `${rate}%` : "—"}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted/70 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(rate ?? 0, 100)}%`,
              background: "var(--brand-gradient)",
            }}
          />
        </div>
      </div>

      {/* 前年比較 */}
      <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs bg-muted/40 text-foreground/80">
        <YoyIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="font-medium">{yoy.text}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            前年の売上 {fmtMan(dept.prevRevenue)}
          </p>
        </div>
      </div>

      {/* 粗利 */}
      <div className="flex items-baseline justify-between gap-2 pt-0.5">
        <div>
          <p className="text-xs text-muted-foreground">粗利（もうけ）</p>
          <p className="text-base font-bold tabular-nums mt-0.5 text-foreground">{fmtMan(dept.grossProfit)}</p>
        </div>
        <p className="text-sm tabular-nums text-muted-foreground">
          粗利率 <span className="font-semibold text-foreground">{dept.gpRate}%</span>
        </p>
      </div>

      {showTheoretical && (
        <div className="pt-2.5 border-t border-border/50 space-y-1.5">
          <p className="text-[10px] text-muted-foreground">
            費用の目安（売上の割合で割り振った数字）
          </p>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">販管費の目安</span>
            <span className="font-medium tabular-nums text-foreground">
              {fmtMan(dept.deptSga)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">営業利益の目安</span>
            <span className="font-bold tabular-nums text-foreground">
              {fmtSigned(dept.deptOp)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function BiDepartmentCards({
  fiscalYear,
  departments,
  showTheoretical,
  fmtMan,
  fmtSigned,
  fmtRatio,
  yoyRatioClass,
}: BiDepartmentCardsProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const deptById = useMemo(
    () => new Map(departments.map((d) => [d.id, d])),
    [departments],
  );

  const [order, setOrder] = useState<string[]>(() => departments.map((d) => d.id));

  useEffect(() => {
    const ids = departments.map((d) => d.id);
    try {
      const raw = localStorage.getItem(storageKey(fiscalYear));
      if (!raw) {
        setOrder(ids);
        return;
      }
      const saved = JSON.parse(raw) as string[];
      const next = [
        ...saved.filter((id) => ids.includes(id)),
        ...ids.filter((id) => !saved.includes(id)),
      ];
      setOrder(next);
    } catch {
      setOrder(ids);
    }
  }, [departments, fiscalYear]);

  const persistOrder = useCallback(
    (next: string[]) => {
      setOrder(next);
      try {
        localStorage.setItem(storageKey(fiscalYear), JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [fiscalYear],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    persistOrder(arrayMove(order, oldIndex, newIndex));
  };

  const ordered = order
    .map((id) => deptById.get(id))
    .filter((d): d is BiDeptCardData => Boolean(d));

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground px-0.5">
        右上の≡をドラッグすると並び順を変えられます
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {ordered.map((dept) => (
              <SortableDeptCard
                key={dept.id}
                dept={dept}
                showTheoretical={showTheoretical}
                fmtMan={fmtMan}
                fmtSigned={fmtSigned}
                fmtRatio={fmtRatio}
                yoyRatioClass={yoyRatioClass}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
