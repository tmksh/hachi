"use client";

import { useRef, useState, useEffect } from "react";
import { buildSignedTicks, linePath } from "./chart-utils";

export type ComboBarSeries = {
  key: string;
  label: string;
  fill: string;
};

export type ComboLineSeries = {
  key: string;
  label: string;
  color: string;
};

export type ComboChartRow = Record<string, string | number>;

type ComboChartProps = {
  data: ComboChartRow[];
  labelKey: string;
  /** 0 を基準に上下に伸びる棒。複数指定すると同じ x にグループ表示 */
  bars: ComboBarSeries[];
  /** 折れ線（累計など） */
  line?: ComboLineSeries;
  height?: number;
  unit?: string;
  formatValue?: (value: number) => string;
  gridColor?: string;
  labelColor?: string;
  tickColor?: string;
};

export function ComboChart({
  data,
  labelKey,
  bars,
  line,
  height: heightProp = 240,
  unit = "",
  formatValue = (v) => String(v),
  gridColor = "currentColor",
  labelColor = "currentColor",
  tickColor = "currentColor",
}: ComboChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 640, height: heightProp });

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
  const pad = { top: 12, right: 12, bottom: 28, left: 44 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const barValues = data.flatMap((row) => bars.map((b) => Number(row[b.key] ?? 0)));
  const lineValues = line ? data.map((row) => Number(row[line.key] ?? 0)) : [];
  const allValues = [...barValues, ...lineValues, 0];
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);

  const ticks = buildSignedTicks(dataMin, dataMax, 2);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const span = yMax - yMin || 1;
  const yOf = (v: number) => pad.top + chartH - ((v - yMin) / span) * chartH;
  const zeroY = yOf(0);

  const groupWidth = chartW / Math.max(data.length, 1);
  const barWidth = Math.min(18, (groupWidth * 0.6) / bars.length);

  const linePoints = line
    ? data.map((row, i) => ({
        x: pad.left + i * groupWidth + groupWidth / 2,
        y: yOf(Number(row[line.key] ?? 0)),
      }))
    : [];

  return (
    <div className="flex h-full w-full flex-col">
      <div
        ref={containerRef}
        className="flex-1 min-h-[180px] w-full"
        style={{ color: labelColor }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          className="h-full w-full min-h-[180px]"
          role="img"
          aria-label="複合グラフ"
        >
          {ticks.map((tick) => {
            const y = yOf(tick);
            return (
              <g key={tick}>
                <line
                  x1={pad.left}
                  y1={y}
                  x2={width - pad.right}
                  y2={y}
                  stroke={tick === 0 ? tickColor : gridColor}
                  strokeDasharray={tick === 0 ? undefined : "3 3"}
                  opacity={tick === 0 ? 0.5 : 0.35}
                />
                <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize={11} fill={tickColor}>
                  {tick < 0 ? "▲" : ""}{Math.abs(tick).toLocaleString()}{unit}
                </text>
              </g>
            );
          })}

          {data.map((row, rowIndex) => {
            const label = String(row[labelKey] ?? "");
            const groupX = pad.left + rowIndex * groupWidth;
            const barsBlockW = bars.length * barWidth + (bars.length - 1) * 2;
            const startX = groupX + (groupWidth - barsBlockW) / 2;
            return (
              <g key={`${label}-${rowIndex}`}>
                <text
                  x={groupX + groupWidth / 2}
                  y={height - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fill={labelColor}
                >
                  {label}
                </text>
                {bars.map((b, bi) => {
                  const value = Number(row[b.key] ?? 0);
                  const y = value >= 0 ? yOf(value) : zeroY;
                  const barH = Math.abs(yOf(value) - zeroY);
                  const x = startX + bi * (barWidth + 2);
                  return (
                    <rect
                      key={b.key}
                      x={x}
                      y={y}
                      width={barWidth}
                      height={Math.max(barH, 0)}
                      rx={3}
                      fill={b.fill}
                    >
                      <title>{`${b.label}: ${formatValue(value)}`}</title>
                    </rect>
                  );
                })}
              </g>
            );
          })}

          {line && linePoints.length > 0 && (
            <>
              <path d={linePath(linePoints)} fill="none" stroke={line.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {linePoints.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3} fill={line.color}>
                  <title>{`${line.label}: ${formatValue(Number(data[i][line.key] ?? 0))}`}</title>
                </circle>
              ))}
            </>
          )}
        </svg>
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 text-[11px]" style={{ color: tickColor }}>
        {bars.map((b) => (
          <span key={b.key} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: b.fill }} />
            {b.label}
          </span>
        ))}
        {line && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: line.color }} />
            {line.label}
          </span>
        )}
      </div>
    </div>
  );
}
