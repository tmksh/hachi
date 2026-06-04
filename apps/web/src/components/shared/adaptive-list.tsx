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

/**
 * ウィジェット高さに応じて表示件数を自動調整するリスト。
 * - 全件がコンテナに収まる場合: 内容分の高さに縮み、下余白を残さない。
 * - 全件が収まらない場合: flex-1 でコンテナを占有しスクロール可能にする。
 */
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
    return empty ? (
      <div ref={ref} className={cn("flex-1 min-h-0", className)}>
        {empty}
      </div>
    ) : null;
  }

  // 全件収まる場合はすべて表示、収まらない場合は count 件をスクロール表示
  const allFit = items.length <= count;
  const visible = allFit ? items : items.slice(0, count);

  return (
    // ref は常に flex-1 コンテナに当てて「利用可能な高さ」を計測し続ける
    <div ref={ref} className="flex-1 min-h-0">
      <div
        className={cn(
          "flex flex-col gap-1",
          // 全件収まる → 内容分の高さだけ取る（余白なし）
          // 収まらない → コンテナ全体を使ってスクロール
          allFit ? "" : "h-full overflow-y-auto",
          className,
        )}
      >
        {visible.map((item, index) => children(item, index))}
      </div>
    </div>
  );
}
