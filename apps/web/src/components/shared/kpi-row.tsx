"use client";

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

const GRID_CLASS: Record<2 | 3 | 4 | 5, string> = {
  2: "grid grid-cols-2 gap-2",
  3: "grid grid-cols-2 lg:grid-cols-3 gap-2",
  4: "grid grid-cols-2 lg:grid-cols-4 gap-2",
  5: "grid grid-cols-2 lg:grid-cols-5 gap-2",
};

export function KpiRow({
  items,
  loading,
  className,
  columns = 4,
}: KpiRowProps) {
  useKpiColor(); // CSS 変数初期化のためマウント
  const iconStyle = { background: "var(--brand-gradient)" } as const;

  return (
    <div className={cn(GRID_CLASS[columns], className)}>
      {loading
        ? Array.from({ length: items.length || columns }).map((_, i) => (
            <div key={i} className={cn(TEAL_CARD_SM, "px-3 py-2.5")}>
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
                  "px-3 py-2.5 flex items-center gap-2.5 flex-nowrap min-w-0 group hover:shadow-md transition-shadow",
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
