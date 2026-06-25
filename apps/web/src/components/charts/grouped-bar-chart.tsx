"use client";

import { useRef, useState, useEffect } from "react";
import { buildTicks, niceMax } from "./chart-utils";

export type GroupedBarSeries = {
  key: string;
  label: string;
  gradient?: [string, string];
  fill?: string;
};

export type GroupedBarChartRow = Record<string, string | number>;

type GroupedBarChartProps = {
  data: GroupedBarChartRow[];
  labelKey: string;
  series: GroupedBarSeries[];
  idPrefix?: string;
  height?: number;
  formatValue?: (value: number, seriesKey: string) => string;
  gridColor?: string;
  labelColor?: string;
  tickColor?: string;
};

export function GroupedBarChart({
  data,
  labelKey,
  series,
  idPrefix = "grouped-bar",
  height: heightProp = 180,
  formatValue = (v) => String(v),
  gridColor = "currentColor",
  labelColor = "currentColor",
  tickColor = "currentColor",
}: GroupedBarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 480, height: heightProp });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0) setSize({ width: w, height: Math.max(h || 0, heightProp) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [heightProp]);

  const { width, height } = size;
  const pad = { top: 8, right: 8, bottom: 28, left: 36 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const maxValue = Math.max(
    1,
    ...data.flatMap((row) =>
      series.map((s) => Number(row[s.key] ?? 0)),
    ),
  );
  const yMax = niceMax(maxValue);
  const yTicks = buildTicks(yMax, 4);
  const groupWidth = chartW / Math.max(data.length, 1);
  // コンテナが広いほど棒を太く（上限は32px）
  const barWidth = Math.min(32, (groupWidth * 0.7) / series.length);
  const groupGap = groupWidth * 0.15;

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-[180px] w-full text-[var(--brand-light)]"
      style={{ color: labelColor }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="h-full w-full min-h-[180px]"
        role="img"
        aria-label="棒グラフ"
      >
        <defs>
          {series.map((s) =>
            s.gradient ? (
              <linearGradient
                key={s.key}
                id={`${idPrefix}-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.gradient[0]} />
                <stop offset="100%" stopColor={s.gradient[1]} />
              </linearGradient>
            ) : null,
          )}
        </defs>

        {yTicks.map((tick) => {
          const y = pad.top + chartH - (tick / yMax) * chartH;
          return (
            <g key={tick}>
              <line
                x1={pad.left}
                y1={y}
                x2={width - pad.right}
                y2={y}
                stroke={gridColor}
                strokeDasharray="3 3"
                opacity={0.35}
              />
              <text
                x={pad.left - 6}
                y={y + 4}
                textAnchor="end"
                fontSize={11}
                fill={tickColor}
              >
                {tick}
              </text>
            </g>
          );
        })}

        {data.map((row, rowIndex) => {
          const groupX = pad.left + rowIndex * groupWidth + groupGap;
          const label = String(row[labelKey] ?? "");
          return (
            <g key={`${label}-${rowIndex}`}>
              <text
                x={groupX + (groupWidth - groupGap * 2) / 2}
                y={height - 6}
                textAnchor="middle"
                fontSize={11}
                fill={labelColor}
              >
                {label}
              </text>
              {series.map((s, seriesIndex) => {
                const value = Number(row[s.key] ?? 0);
                const barH = (value / yMax) * chartH;
                const x =
                  groupX +
                  seriesIndex * (barWidth + 2) +
                  (groupWidth - groupGap * 2 - series.length * barWidth - (series.length - 1) * 2) / 2;
                const y = pad.top + chartH - barH;
                const fill = s.gradient
                  ? `url(#${idPrefix}-${s.key})`
                  : (s.fill ?? "#888");
                return (
                  <rect
                    key={s.key}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(barH, 0)}
                    rx={4}
                    fill={fill}
                  >
                    <title>{`${s.label}: ${formatValue(value, s.key)}`}</title>
                  </rect>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
