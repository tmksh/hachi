"use client";

import { cn } from "@/lib/utils";
import { useVisibleItemCount } from "@/hooks/use-visible-item-count";

interface AdaptiveListProps<T> {
  items: T[];
  itemHeightPx?: number;
  max?: number;
  className?: string;
  empty?: React.ReactNode;
  children: (item: T, index: number) => React.ReactNode;
}

/** ウィジェット高さに応じて表示件数を自動調整するリスト */
export function AdaptiveList<T>({
  items,
  itemHeightPx = 56,
  max = 20,
  className,
  empty,
  children,
}: AdaptiveListProps<T>) {
  const { ref, count } = useVisibleItemCount(itemHeightPx, { max });

  if (!items.length) {
    return empty ? <div className={cn("flex-1 min-h-0", className)}>{empty}</div> : null;
  }

  return (
    <div
      ref={ref}
      className={cn("flex flex-col gap-1 flex-1 min-h-0 overflow-hidden", className)}
    >
      {items.slice(0, count).map((item, index) => children(item, index))}
    </div>
  );
}
