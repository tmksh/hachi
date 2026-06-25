"use client";

import type { ReactNode } from "react";
import {
  DndContext,
  closestCorners,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";

type WidgetGridProps = {
  sortableIds: string[];
  onDragEnd: (event: DragEndEvent) => void;
  gridRef: React.RefObject<HTMLDivElement | null>;
  children: ReactNode;
};

export function WidgetGrid({ sortableIds, onDragEnd, gridRef, children }: WidgetGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
      <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
        <div ref={gridRef} data-widget-grid className="grid grid-cols-12 gap-3 md:gap-4 min-w-0 w-full items-start">
          {children}
        </div>
      </SortableContext>
    </DndContext>
  );
}
