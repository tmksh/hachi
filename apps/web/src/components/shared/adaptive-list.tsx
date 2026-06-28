"use client";

import { cn } from "@/lib/utils";
import { useListWidgetLayout } from "@/hooks/use-list-widget-layout";

interface AdaptiveListProps<T> {
  items: T[];
  itemHeightPx?: number;
  max?: number;
  className?: string;
  empty?: React.ReactNode;
  children: (item: T, index: number) => React.ReactNode;
}

/**
 * h-full カード内で使うスクロールリスト（ListWidgetCard 外のレガシー用途）。
 * 全件表示し、はみ出す場合はスクロールする。
 */
export function AdaptiveList<T>({
  items,
  className,
  empty,
  children,
}: AdaptiveListProps<T>) {
  if (!items.length) {
    return empty ? (
      <div className={cn("shrink-0 w-full", className)}>
        {empty}
      </div>
    ) : null;
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className={cn("flex flex-col gap-1", className)}>
        {items.map((item, index) => children(item, index))}
      </div>
    </div>
  );
}

interface ListWidgetCardProps<T> {
  header: React.ReactNode;
  items: T[];
  itemHeightPx?: number;
  listClassName?: string;
  className?: string;
  empty?: React.ReactNode;
  loading?: boolean;
  loadingSkeleton?: React.ReactNode;
  children: (item: T, index: number) => React.ReactNode;
}

/**
 * ダッシュボードのリスト系ウィジェット用カード。
 * - 件数がウィジェット高さに収まる → 内容に合わせてコンパクト表示
 * - 収まらない → ウィジェット高さいっぱいでスクロール
 */
export function ListWidgetCard<T>({
  header,
  items,
  itemHeightPx = 56,
  listClassName,
  className,
  empty,
  loading,
  loadingSkeleton,
  children,
}: ListWidgetCardProps<T>) {
  const { cardRef, allFit } = useListWidgetLayout(items.length, itemHeightPx);

  return (
    <div
      ref={cardRef}
      className={cn(
        "bg-white rounded-2xl shadow-sm p-3 flex flex-col gap-2 w-full overflow-hidden",
        loading || items.length === 0 || allFit ? "self-start max-h-full" : "h-full min-h-0 max-h-full",
        className,
      )}
    >
      <div data-widget-header className="shrink-0">
        {header}
      </div>
      {loading ? (
        loadingSkeleton
      ) : items.length === 0 ? (
        empty
      ) : (
        <div
          className={cn(
            allFit ? "shrink-0 w-full" : "flex-1 min-h-0 overflow-y-auto",
          )}
        >
          <div className={cn("flex flex-col gap-1", listClassName)}>
            {items.map((item, index) => children(item, index))}
          </div>
        </div>
      )}
    </div>
  );
}
