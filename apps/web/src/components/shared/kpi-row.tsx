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
  sparkline?: number[];
  sparklineColor?: string;
};

interface KpiRowProps {
  items: KpiItem[];
  loading?: boolean;
  className?: string;
  columns?: 2 | 3 | 4 | 5;
  /** 縦積みレイアウト（列数が多く横並びだと見切れる場合に使用） */
  stacked?: boolean;
}

const KPI_ICON_INNER = "h-3.5 w-3.5 text-white";

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 44;
  const h = 14;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="shrink-0 opacity-80" aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

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
  stacked = false,
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
            <div key={i} className={cn(TEAL_CARD_SM, "px-3 py-2.5 min-w-0", stacked && "h-[88px]")}>
              <Skeleton className="h-6 w-full" />
            </div>
          ))
        : items.map((item, i) => {
            const Icon = item.icon;

            if (stacked) {
              return (
                <div
                  key={i}
                  className={cn(
                    TEAL_CARD_SM,
                    "px-3.5 py-3 flex flex-col gap-1.5 min-w-0 group hover:shadow-md transition-shadow",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-600 leading-tight min-w-0">
                      {item.label}
                    </span>
                    {Icon && (
                      <div className={cn(TEAL_KPI_ICON, "shrink-0")} style={iconStyle}>
                        <Icon className={KPI_ICON_INNER} />
                      </div>
                    )}
                  </div>
                  <p
                    className={cn(
                      "text-xl font-bold tabular-nums tracking-tight leading-none text-slate-900",
                      item.valueClassName,
                    )}
                  >
                    {item.value}
                  </p>
                  <div className="flex items-end justify-between gap-2 mt-auto">
                    {item.sub ? (
                      <span className="text-[11px] text-slate-500 leading-tight min-w-0">
                        {item.sub}
                      </span>
                    ) : <span />}
                    {item.sparkline?.length ? (
                      <MiniSparkline data={item.sparkline} color={item.sparklineColor ?? "var(--brand-dark)"} />
                    ) : null}
                  </div>
                </div>
              );
            }

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
                    "text-xl font-bold tabular-nums tracking-tight leading-none ml-auto whitespace-nowrap shrink-0 text-slate-900",
                    item.valueClassName,
                  )}
                >
                  {item.value}
                </p>
                {item.sparkline?.length ? (
                  <MiniSparkline data={item.sparkline} color={item.sparklineColor ?? "var(--brand-dark)"} />
                ) : null}
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
