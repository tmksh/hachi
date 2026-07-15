"use client";

import { useRef, useState, useEffect } from "react";
import { buildAsymmetricTicks } from "./chart-utils";

export type WaterfallStep = {
  label: string;
  /** 増減額（減少はマイナス）。isTotal=true の場合は累計そのものを表示 */
  value: number;
  /** 小計・合計バー（0起点で描画） */
  isTotal?: boolean;
  color: string;
};

type WaterfallChartProps = {
  steps: WaterfallStep[];
  height?: number;
  formatValue?: (value: number) => string;
  gridColor?: string;
  labelColor?: string;
  tickColor?: string;
  unit?: string;
};

/** P&L ウォーターフォールチャート（透明ベース + 表示バー方式） */
export function WaterfallChart({
  steps,
  height: heightProp = 260,
  formatValue = (v) => String(v),
  gridColor = "#e5e7eb",
  labelColor = "#64748b",
  tickColor = "#64748b",
  unit = "",
}: WaterfallChartProps) {
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

  // 各段の開始/終了累計を計算
  let running = 0;
  const bars = steps.map((s) => {
    if (s.isTotal) {
      running = s.value;
      return { ...s, start: 0, end: s.value };
    }
    const start = running;
    running += s.value;
    return { ...s, start, end: running };
  });

  const allEdges = bars.flatMap((b) => [b.start, b.end, 0]);
  const ticks = buildAsymmetricTicks(Math.min(...allEdges), Math.max(...allEdges), 4);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const span = yMax - yMin || 1;

  const formatTickLabel = (tick: number) =>
    `${tick < 0 ? "▲" : ""}${Math.abs(tick).toLocaleString()}${unit}`;
  const maxTickChars = Math.max(...ticks.map((t) => formatTickLabel(t).length), 1);

  const pad = {
    top: 24,
    right: 16,
    bottom: 32,
    left: Math.max(60, Math.ceil(maxTickChars * 7) + 16),
  };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const yOf = (v: number) => pad.top + chartH - ((v - yMin) / span) * chartH;

  const groupWidth = chartW / Math.max(bars.length, 1);
  const barWidth = Math.min(52, groupWidth * 0.6);

  return (
    <div ref={containerRef} className="h-full w-full min-h-[200px]">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="ウォーターフォールチャート"
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
              <text x={pad.left - 10} y={y} textAnchor="end" dominantBaseline="middle" fontSize={10} fill={tickColor}>
                {formatTickLabel(tick)}
              </text>
            </g>
          );
        })}

        {bars.map((bar, i) => {
          const centerX = pad.left + i * groupWidth + groupWidth / 2;
          const x = centerX - barWidth / 2;
          const yTop = yOf(Math.max(bar.start, bar.end));
          const barH = Math.max(Math.abs(yOf(bar.start) - yOf(bar.end)), 2);

          return (
            <g key={`${bar.label}-${i}`}>
              {/* 次の段への接続線 */}
              {i < bars.length - 1 && (
                <line
                  x1={centerX + barWidth / 2}
                  y1={yOf(bar.end)}
                  x2={pad.left + (i + 1) * groupWidth + groupWidth / 2 - barWidth / 2}
                  y2={yOf(bar.end)}
                  stroke={tickColor}
                  strokeDasharray="3 3"
                  opacity={0.5}
                />
              )}
              <rect x={x} y={yTop} width={barWidth} height={barH} rx={3} fill={bar.color}>
                <title>{`${bar.label}: ${formatValue(bar.value)}`}</title>
              </rect>
              <text
                x={centerX}
                y={yTop - 6}
                textAnchor="middle"
                fontSize={10}
                fontWeight={600}
                fill={labelColor}
              >
                {formatValue(bar.value)}
              </text>
              <text x={centerX} y={height - 6} textAnchor="middle" fontSize={11} fill={labelColor}>
                {bar.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
