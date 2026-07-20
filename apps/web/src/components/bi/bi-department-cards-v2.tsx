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
  return `bi2-dept-order:${fiscalYear}`;
}

function achieveStatus(rate: number | null) {
  if (rate == null) return { label: "未設定", tone: "muted" as const };
  if (rate >= 100) return { label: "達成", tone: "good" as const };
  if (rate >= 70) return { label: "順調", tone: "good" as const };
  if (rate >= 40) return { label: "やや遅れ", tone: "warn" as const };
  return { label: "遅れ", tone: "bad" as const };
}

function yoyPlain(ratio: number | null): { text: string; tone: "good" | "bad" | "muted" } {
  if (ratio == null) return { text: "—", tone: "muted" };
  const diff = Math.round((ratio - 100) * 10) / 10;
  if (diff > 0) return { text: `+${diff}%`, tone: "good" };
  if (diff < 0) return { text: `${diff}%`, tone: "bad" };
  return { text: "±0%", tone: "muted" };
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

  const statusClass =
    status.tone === "good"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : status.tone === "warn"
        ? "bg-amber-50 text-amber-900 border-amber-200"
        : status.tone === "bad"
          ? "bg-rose-50 text-rose-800 border-rose-200"
          : "bg-muted/50 text-muted-foreground border-border";

  const barColor =
    status.tone === "good"
      ? "#059669"
      : status.tone === "warn"
        ? "#d97706"
        : status.tone === "bad"
          ? "#e11d48"
          : "var(--brand-dark)";

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
        "frost-card rounded-xl p-4 flex flex-col gap-3 border border-border/50",
        isDragging && "opacity-60 shadow-lg",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: dept.color }} />
          <p className="font-bold text-base truncate">{dept.name}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className={cn("rounded-md border px-1.5 py-0.5 text-[11px] font-semibold", statusClass)}>
            {status.label}
          </span>
          <button
            type="button"
            className="p-1 rounded text-muted-foreground hover:bg-muted/50 cursor-grab active:cursor-grabbing touch-none"
            aria-label="並び替え"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div>
        <p className="text-2xl font-bold tabular-nums leading-none">{fmtMan(dept.revenue)}</p>
        <p className="text-xs text-muted-foreground mt-1">
          目標 {dept.target != null ? fmtMan(dept.target) : "—"}
        </p>
      </div>

      <div className="space-y-1">
        <div className="flex items-end justify-between">
          <span className="text-xs text-muted-foreground">達成</span>
          <span
            className={cn(
              "text-lg font-bold tabular-nums leading-none",
              status.tone === "good" && "text-emerald-700",
              status.tone === "warn" && "text-amber-700",
              status.tone === "bad" && "text-rose-600",
            )}
          >
            {rate != null ? `${rate}%` : "—"}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(rate ?? 0, 100)}%`, backgroundColor: barColor }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className={cn("inline-flex items-center gap-1 font-semibold", yoy.tone === "good" && "text-emerald-700", yoy.tone === "bad" && "text-rose-600")}>
          <YoyIcon className="h-3.5 w-3.5" />
          昨対 {yoy.text}
        </span>
        <span className="tabular-nums text-muted-foreground">
          粗利 <b className="text-foreground">{fmtMan(dept.grossProfit)}</b>
          <span className="ml-1">({dept.gpRate}%)</span>
        </span>
      </div>

      {showTheoretical && (
        <div className="pt-2 border-t border-border/50 flex justify-between text-xs">
          <span className="text-muted-foreground">販管費</span>
          <span className="tabular-nums text-rose-600">−{fmtMan(dept.deptSga)}</span>
          <span className="text-muted-foreground">営業利益</span>
          <span className={cn("font-bold tabular-nums", dept.deptOp < 0 ? "text-rose-600" : "text-emerald-700")}>
            {fmtSigned(dept.deptOp)}
          </span>
        </div>
      )}
    </div>
  );
}

export function BiDepartmentCardsV2({
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
      setOrder([
        ...saved.filter((id) => ids.includes(id)),
        ...ids.filter((id) => !saved.includes(id)),
      ]);
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
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
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
  );
}
