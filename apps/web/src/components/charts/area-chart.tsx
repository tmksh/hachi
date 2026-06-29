"use client";

import { useRef, useState, useEffect } from "react";
import { areaPath, buildTicks, linePath, niceMax } from "./chart-utils";

export type AreaChartSeries = {
  key: string;
  label: string;
  color: string;
};

export type AreaChartRow = Record<string, string | number>;

type AreaChartProps = {
  data: AreaChartRow[];
  labelKey: string;
  series: AreaChartSeries[];
  height?: number;
  gridColor?: string;
  labelColor?: string;
  tickColor?: string;
  unit?: string;
  formatValue?: (value: number, label: string) => string;
};

export function AreaChart({
  data,
  labelKey,
  series,
  height = 280,
  gridColor = "#e2e8f0",
  labelColor = "#64748b",
  tickColor = "#64748b",
  unit = "",
  formatValue = (v) => String(v),
}: AreaChartProps) {
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
  const pad = { top: 28, right: 12, bottom: 28, left: 50 };
  const chartW = width - pad.left - pad.right;
  const chartH = chartHeight - pad.top - pad.bottom;

  const maxValue = Math.max(
    1,
    ...data.flatMap((row) => series.map((s) => Number(row[s.key] ?? 0))),
  );
  const yMax = niceMax(maxValue);
  const yTicks = buildTicks(yMax, 4);
  const xStep = chartW / Math.max(data.length - 1, 1);
  const baselineY = pad.top + chartH;
  const toX = (index: number) => pad.left + index * xStep;
  const toY = (value: number) => pad.top + chartH - (value / yMax) * chartH;

  return (
    <div ref={containerRef} className="h-full w-full">
    <svg viewBox={`0 0 ${width} ${chartHeight}`} width={width} height={chartHeight} preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="エリアグラフ">
      {yTicks.map((tick) => {
        const y = toY(tick);
        return (
          <g key={tick}>
            <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke={gridColor} strokeDasharray="3 3" />
            <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill={tickColor}>
              {tick}
              {unit}
            </text>
          </g>
        );
      })}

      {data.map((row, index) => (
        <text
          key={`${row[labelKey]}-${index}`}
          x={toX(index)}
          y={chartHeight - 6}
          textAnchor="middle"
          fontSize={11}
          fill={labelColor}
        >
          {String(row[labelKey] ?? "")}
        </text>
      ))}

      {series.map((s) => {
        const points = data.map((row, index) => ({
          x: toX(index),
          y: toY(Number(row[s.key] ?? 0)),
        }));
        return (
          <g key={s.key}>
            <path d={areaPath(points, baselineY)} fill={s.color} fillOpacity={0.15} />
            <path
              d={linePath(points)}
              fill="none"
              stroke={s.color}
              strokeWidth={1.8}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((point, index) => (
              <circle key={index} cx={point.x} cy={point.y} r={2.5} fill={s.color}>
                <title>{`${s.label}: ${formatValue(Number(data[index][s.key] ?? 0), s.label)}`}</title>
              </circle>
            ))}
          </g>
        );
      })}

      <g transform={`translate(${pad.left}, 12)`}>
        {series.map((s, index) => (
          <g key={s.key} transform={`translate(${index * 96}, 0)`}>
            <circle cx={0} cy={0} r={4} fill={s.color} />
            <text x={10} y={4} fontSize={11} fill={labelColor}>
              {s.label}
            </text>
          </g>
        ))}
      </g>
    </svg>
    </div>
  );
}
