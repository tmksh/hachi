"use client";

import { useRef, useState, useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TEAL_CARD_SM, TEAL_KPI_ICON } from "@/lib/teal-theme";
import { useKpiColor } from "@/hooks/use-kpi-color";

export type KpiItem = {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  valueClassName?: string;
};

interface KpiRowProps {
  items: KpiItem[];
  loading?: boolean;
  className?: string;
  columns?: 2 | 3 | 4 | 5;
}

const KPI_ICON_INNER = "h-3.5 w-3.5 text-white";

/** コンテナ幅に応じて列数を決定（チャットパネル開閉に追従） */
function useResponsiveColumns(requested: 2 | 3 | 4 | 5) {
  const ref = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(requested);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const breakpoints: Record<2 | 3 | 4 | 5, number> = {
      2: 0,
      3: 480,
      4: 560,
      5: 720,
    };
    const min = breakpoints[requested];

    const update = () => {
      const w = el.clientWidth;
      if (requested === 2) {
        setCols(2);
        return;
      }
      if (w < min) {
        setCols(2);
      } else if (requested === 5 && w < breakpoints[5]) {
        setCols(3);
      } else {
        setCols(requested);
      }
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [requested]);

  return { ref, cols };
}

export function KpiRow({
  items,
  loading,
  className,
  columns = 4,
}: KpiRowProps) {
  useKpiColor();
  const { ref, cols } = useResponsiveColumns(columns);
  const iconStyle = { background: "var(--brand-gradient)" } as const;

  return (
    <div
      ref={ref}
      className={cn("grid gap-2 min-w-0 w-full", className)}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {loading
        ? Array.from({ length: items.length || cols }).map((_, i) => (
            <div key={i} className={cn(TEAL_CARD_SM, "px-3 py-2.5 min-w-0")}>
              <Skeleton className="h-6 w-full" />
            </div>
          ))
        : items.map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={i}
                className={cn(
                  TEAL_CARD_SM,
                  "px-3 py-2.5 flex items-center gap-2.5 flex-nowrap min-w-0 overflow-hidden group hover:shadow-md transition-shadow",
                )}
              >
                {Icon && (
                  <div className={TEAL_KPI_ICON} style={iconStyle}>
                    <Icon className={KPI_ICON_INNER} />
                  </div>
                )}
                <span className="text-xs font-semibold truncate min-w-0 text-slate-600">
                  {item.label}
                </span>
                <p
                  className={cn(
                    "text-xl font-black tabular-nums tracking-tight leading-none ml-auto whitespace-nowrap shrink-0 text-slate-900",
                    item.valueClassName,
                  )}
                >
                  {item.value}
                </p>
                {item.sub ? (
                  <span className="text-xs shrink-0 whitespace-nowrap text-slate-500">
                    {item.sub}
                  </span>
                ) : null}
              </div>
            );
          })}
    </div>
  );
}
