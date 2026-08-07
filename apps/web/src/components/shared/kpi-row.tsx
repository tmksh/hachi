"use client";

import { useRef, useState, useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TEAL_CARD_SM, TEAL_KPI_ICON } from "@/lib/teal-theme";

export type KpiItem = {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  /** BI2 と同じ3Dイラスト（指定時は icon より優先） */
  illustration?: string;
  valueClassName?: string;
  sparkline?: number[];
  sparklineColor?: string;
};

interface KpiRowProps {
  items: KpiItem[];
  loading?: boolean;
  className?: string;
  columns?: 2 | 3 | 4 | 5 | 6;
  /** 縦積みレイアウト（列数が多く横並びだと見切れる場合に使用） */
  stacked?: boolean;
}

const KPI_ICON_INNER = "h-3.5 w-3.5 text-white";

/** 円表示など桁が多い値向けに文字サイズを落とす */
function valueSizeClass(value: string | number, stacked: boolean): string {
  const len = String(value).length;
  if (stacked) {
    if (len >= 14) return "text-sm";
    if (len >= 11) return "text-base";
    if (len >= 9) return "text-lg";
    return "text-xl";
  }
  if (len >= 12) return "text-sm";
  if (len >= 9) return "text-base";
  return "text-xl";
}

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
function useResponsiveColumns(requested: 2 | 3 | 4 | 5 | 6) {
  const ref = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(requested);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // 円表示（¥12,345,678）でも1セルに収まるよう、6列は広めの閾値
    const breakpoints: Record<2 | 3 | 4 | 5 | 6, number> = {
      2: 0,
      3: 480,
      4: 560,
      5: 780,
      6: 1100,
    };
    const min = breakpoints[requested];

    const update = () => {
      const w = el.clientWidth;
      if (requested === 2) {
        setCols(2);
        return;
      }
      if (requested === 6) {
        if (w < breakpoints[5]) setCols(3);
        else if (w < breakpoints[6]) setCols(5);
        else setCols(6);
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
  // CSS 変数のみ参照（useBrandColor は呼ばない＝KPI毎の再レンダーを避ける）
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
            <div key={i} className={cn(TEAL_CARD_SM, "px-3 py-2.5 min-w-0", stacked && "h-[104px]")}>
              <Skeleton className="h-6 w-full" />
            </div>
          ))
        : items.map((item, i) => {
            const Icon = item.icon;
            const illust = item.illustration ? (
              <img
                src={item.illustration}
                alt=""
                aria-hidden
                className="h-full w-full object-contain pointer-events-none select-none"
              />
            ) : null;

            if (stacked) {
              return (
                <div
                  key={i}
                  className={cn(
                    TEAL_CARD_SM,
                    "relative px-3.5 py-3 min-h-[104px] flex flex-col gap-1.5 min-w-0 overflow-hidden group hover:shadow-md transition-shadow",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-600 leading-tight min-w-0 pr-14">
                      {item.label}
                    </span>
                    {illust ? (
                      <div className="absolute right-0.5 top-0.5 h-14 w-14 shrink-0 opacity-90 pointer-events-none">
                        {illust}
                      </div>
                    ) : Icon ? (
                      <div className={cn(TEAL_KPI_ICON, "shrink-0")} style={iconStyle}>
                        <Icon className={KPI_ICON_INNER} />
                      </div>
                    ) : null}
                  </div>
                  <p
                    className={cn(
                      "font-bold tabular-nums tracking-tight leading-tight text-slate-900 min-w-0 pr-10 break-all",
                      valueSizeClass(item.value, true),
                      item.valueClassName,
                    )}
                  >
                    {item.value}
                  </p>
                  <div className="flex items-end justify-between gap-2 mt-auto min-w-0">
                    {item.sub ? (
                      <span className="text-[11px] text-slate-500 leading-tight min-w-0 line-clamp-2 break-all">
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
                {illust ? (
                  <div className="h-9 w-9 shrink-0">{illust}</div>
                ) : Icon ? (
                  <div className={TEAL_KPI_ICON} style={iconStyle}>
                    <Icon className={KPI_ICON_INNER} />
                  </div>
                ) : null}
                <span className="text-xs font-semibold truncate min-w-0 text-slate-600">
                  {item.label}
                </span>
                <p
                  className={cn(
                    "font-bold tabular-nums tracking-tight leading-none ml-auto min-w-0 truncate text-slate-900",
                    valueSizeClass(item.value, false),
                    item.valueClassName,
                  )}
                >
                  {item.value}
                </p>
                {item.sparkline?.length ? (
                  <MiniSparkline data={item.sparkline} color={item.sparklineColor ?? "var(--brand-dark)"} />
                ) : null}
                {item.sub ? (
                  <span className="text-xs shrink min-w-0 truncate text-slate-500">
                    {item.sub}
                  </span>
                ) : null}
              </div>
            );
          })}
    </div>
  );
}
