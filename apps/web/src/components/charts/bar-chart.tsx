"use client";

import { useRef, useState, useEffect } from "react";
import { buildAsymmetricTicks, buildTicks, niceMax } from "./chart-utils";

export type BarChartRow = {
  label: string;
  value: number;
  color?: string;
};

type BarChartProps = {
  data: BarChartRow[];
  height?: number;
  fill?: string;
  formatValue?: (value: number) => string;
  gridColor?: string;
  labelColor?: string;
  tickColor?: string;
  unit?: string;
  allowNegative?: boolean;
  showValueLabels?: boolean;
};

export function BarChart({
  data,
  height = 260,
  fill = "#0F5132",
  formatValue = (v) => String(v),
  gridColor = "#e5e7eb",
  labelColor = "#64748b",
  tickColor = "#64748b",
  unit = "",
  allowNegative = false,
  showValueLabels = false,
}: BarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 480, height });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0) setSize({ width: w, height: h > 0 ? h : height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [height]);

  const { width, height: chartHeight } = size;
  const pad = { top: showValueLabels ? 24 : 8, right: 8, bottom: 28, left: 44 };
  const chartW = width - pad.left - pad.right;
  const chartH = chartHeight - pad.top - pad.bottom;

  const values = data.map((d) => d.value);
  const minValue = allowNegative ? Math.min(0, ...values) : 0;
  const maxValue = Math.max(1, ...values);
  // 上下で必要な分だけ軸を確保（参考UIの非対称軸に準拠）
  const yTicks = allowNegative
    ? buildAsymmetricTicks(minValue, maxValue, 4)
    : buildTicks(maxValue, 4);
  const yMin = yTicks[0];
  const yMax = yTicks[yTicks.length - 1];
  const range = yMax - yMin;
  const zeroY = pad.top + chartH - ((0 - yMin) / range) * chartH;
  const barWidth = Math.min(44, (chartW / Math.max(data.length, 1)) * 0.55);

  return (
    <div ref={containerRef} className="h-full w-full">
    <svg viewBox={`0 0 ${width} ${chartHeight}`} width={width} height={chartHeight} preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="棒グラフ">
      {yTicks.map((tick) => {
        const y = pad.top + chartH - ((tick - yMin) / range) * chartH;
        return (
          <g key={tick}>
            <line
              x1={pad.left}
              y1={y}
              x2={width - pad.right}
              y2={y}
              stroke={gridColor}
              strokeDasharray="3 3"
            />
            <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill={tickColor}>
              {tick}
              {unit}
            </text>
          </g>
        );
      })}

      {allowNegative && (
        <line
          x1={pad.left}
          y1={zeroY}
          x2={width - pad.right}
          y2={zeroY}
          stroke={gridColor}
          strokeWidth={1}
        />
      )}

      {data.map((row, index) => {
        const groupX = pad.left + (index + 0.5) * (chartW / data.length);
        const x = groupX - barWidth / 2;
        const value = row.value;
        const barH = (Math.abs(value) / range) * chartH;
        const y = value >= 0 ? zeroY - barH : zeroY;
        const color = row.color ?? fill;
        return (
          <g key={`${row.label}-${index}`}>
            <rect x={x} y={y} width={barWidth} height={Math.max(barH, 0)} rx={4} fill={color}>
              <title>{`${row.label}: ${formatValue(value)}`}</title>
            </rect>
            {showValueLabels && (
              <text
                x={groupX}
                y={value >= 0 ? y - 6 : y + barH + 12}
                textAnchor="middle"
                fontSize={10}
                fontWeight={600}
                fill={labelColor}
              >
                {formatValue(value)}
              </text>
            )}
            <text
              x={groupX}
              y={chartHeight - 6}
              textAnchor="middle"
              fontSize={11}
              fill={labelColor}
            >
              {row.label}
            </text>
          </g>
        );
      })}
    </svg>
    </div>
  );
}
