"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import {
  buildSignedTicks,
  buildAsymmetricTicks,
  smoothLinePath,
  smoothAreaPath,
} from "./chart-utils";

export type TrendSeries = {
  key: string;
  label: string;
  color: string;
  /** 線の下を薄く塗る（既定 true） */
  area?: boolean;
};

export type TrendAreaRow = Record<string, string | number>;

type TrendAreaChartProps = {
  data: TrendAreaRow[];
  labelKey: string;
  series: TrendSeries[];
  height?: number;
  unit?: string;
  formatValue?: (value: number) => string;
  /** この index 以降を予測領域として背景帯表示 */
  forecastFromIndex?: number;
  forecastZoneLabel?: string;
  gridColor?: string;
  labelColor?: string;
  tickColor?: string;
  /** 初期状態で非表示にする系列キー */
  defaultHidden?: string[];
};

type HoverState = { index: number; x: number; y: number };

export function TrendAreaChart({
  data,
  labelKey,
  series,
  height: heightProp = 260,
  unit = "",
  formatValue = (v) => String(v),
  forecastFromIndex,
  forecastZoneLabel = "着地予測領域",
  gridColor = "currentColor",
  labelColor = "currentColor",
  tickColor = "currentColor",
  defaultHidden = [],
}: TrendAreaChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 640, height: heightProp });
  const [hover, setHover] = useState<HoverState | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(defaultHidden));

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
  const visibleSeries = series.filter((s) => !hidden.has(s.key));

  const values = visibleSeries.flatMap((s) => data.map((row) => Number(row[s.key] ?? 0)));
  const allValues = [...values, 0];
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);

  const ticks = dataMin < 0
    ? buildSignedTicks(dataMin, dataMax, 2)
    : buildAsymmetricTicks(dataMin, dataMax, 4);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];

  const formatTickLabel = (tick: number) =>
    `${tick < 0 ? "▲" : ""}${Math.abs(tick).toLocaleString()}${unit}`;
  const maxTickChars = Math.max(...ticks.map((t) => formatTickLabel(t).length), 1);

  const pad = {
    top: 20,
    right: 16,
    bottom: 30,
    left: Math.max(58, Math.ceil(maxTickChars * 7) + 14),
  };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const span = yMax - yMin || 1;
  const yOf = (v: number) => pad.top + chartH - ((v - yMin) / span) * chartH;
  const zeroY = yOf(0);

  const xOf = (i: number) =>
    data.length <= 1
      ? pad.left + chartW / 2
      : pad.left + (i / (data.length - 1)) * chartW;

  const seriesPoints = useMemo(
    () =>
      series.map((s) => ({
        key: s.key,
        points: data.map((row, i) => ({ x: xOf(i), y: yOf(Number(row[s.key] ?? 0)) })),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, data, width, height, yMin, yMax],
  );
  const pointsFor = (key: string) => seriesPoints.find((p) => p.key === key)?.points ?? [];

  const forecastStart =
    forecastFromIndex != null && forecastFromIndex < data.length && forecastFromIndex > 0
      ? xOf(forecastFromIndex)
      : null;

  const viewMargin = { left: 6, top: 6, right: 0, bottom: 0 };
  const vbW = width + viewMargin.left + viewMargin.right;
  const vbH = height + viewMargin.top + viewMargin.bottom;

  const nearestIndex = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const localX = clientX - rect.left;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < data.length; i += 1) {
      const dist = Math.abs(xOf(i) - localX);
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
    return best;
  };

  const toggle = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      // 全部消えないよう最後の1つは残す
      else if (prev.size < series.length - 1) next.add(key);
      return next;
    });

  return (
    <div className="flex h-full w-full flex-col">
      {/* 凡例（チェックで表示切替） */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pb-2 text-[11px]" style={{ color: tickColor }}>
        {series.map((s) => {
          const on = !hidden.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              className="inline-flex items-center gap-1.5 select-none transition-opacity"
              style={{ opacity: on ? 1 : 0.4 }}
            >
              <span
                className="flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border"
                style={{
                  background: on ? s.color : "transparent",
                  borderColor: s.color,
                }}
              >
                {on && (
                  <svg viewBox="0 0 10 10" className="h-2.5 w-2.5">
                    <path d="M1 5 L4 8 L9 2" fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className={on ? "font-medium text-foreground" : "text-muted-foreground"}>{s.label}</span>
            </button>
          );
        })}
      </div>

      <div
        ref={containerRef}
        className="relative flex-1 min-h-[180px] w-full pl-1"
        style={{ color: labelColor }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = containerRef.current?.getBoundingClientRect();
          if (!rect) return;
          const index = nearestIndex(e.clientX);
          setHover({ index, x: xOf(index), y: e.clientY - rect.top });
        }}
      >
        <svg
          viewBox={`${-viewMargin.left} ${-viewMargin.top} ${vbW} ${vbH}`}
          width={width}
          height={height}
          className="h-full w-full min-h-[180px]"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="推移グラフ"
        >
          <defs>
            {visibleSeries.map((s) => (
              <linearGradient key={s.key} id={`trend-grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>

          {forecastStart != null && (
            <>
              <rect
                x={forecastStart}
                y={pad.top}
                width={width - pad.right - forecastStart}
                height={chartH}
                fill="currentColor"
                opacity={0.05}
              />
              <text
                x={(forecastStart + width - pad.right) / 2}
                y={pad.top + 10}
                textAnchor="middle"
                fontSize={9}
                fill={tickColor}
                opacity={0.55}
              >
                {forecastZoneLabel}
              </text>
            </>
          )}

          {ticks.map((tick) => {
            const y = yOf(tick);
            const isTop = tick === yMax;
            const isBottom = tick === yMin;
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
                <text
                  x={pad.left - 10}
                  y={y}
                  textAnchor="end"
                  dominantBaseline={isTop ? "hanging" : isBottom ? "auto" : "middle"}
                  fontSize={10}
                  fill={tickColor}
                >
                  {formatTickLabel(tick)}
                </text>
              </g>
            );
          })}

          {/* 塗り */}
          {visibleSeries.map((s) => {
            if (s.area === false) return null;
            const pts = pointsFor(s.key);
            return (
              <path
                key={`area-${s.key}`}
                d={smoothAreaPath(pts, zeroY)}
                fill={`url(#trend-grad-${s.key})`}
                pointerEvents="none"
              />
            );
          })}

          {/* 線 */}
          {visibleSeries.map((s) => {
            const pts = pointsFor(s.key);
            return (
              <path
                key={`line-${s.key}`}
                d={smoothLinePath(pts)}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                pointerEvents="none"
              />
            );
          })}

          {/* x軸ラベル */}
          {data.map((row, i) => {
            const forecast = forecastFromIndex != null && i >= forecastFromIndex;
            return (
              <text
                key={`x-${i}`}
                x={xOf(i)}
                y={height - 6}
                textAnchor="middle"
                fontSize={11}
                fill={labelColor}
                opacity={forecast ? 0.55 : 1}
              >
                {String(row[labelKey] ?? "")}
              </text>
            );
          })}

          {/* ホバーガイド + ドット */}
          {hover && (
            <>
              <line
                x1={xOf(hover.index)}
                y1={pad.top}
                x2={xOf(hover.index)}
                y2={pad.top + chartH}
                stroke={tickColor}
                strokeWidth={1}
                opacity={0.3}
                pointerEvents="none"
              />
              {visibleSeries.map((s) => (
                <circle
                  key={`dot-${s.key}`}
                  cx={xOf(hover.index)}
                  cy={yOf(Number(data[hover.index]?.[s.key] ?? 0))}
                  r={3.5}
                  fill="#fff"
                  stroke={s.color}
                  strokeWidth={2}
                  pointerEvents="none"
                />
              ))}
            </>
          )}
        </svg>

        {hover && data[hover.index] && (() => {
          const row = data[hover.index];
          const tipLeft = Math.min(Math.max(hover.x, 90), Math.max(width - 90, 90));
          const tipTop = Math.max(hover.y - 12, 8);
          return (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-border/70 bg-white/95 px-2.5 py-2 shadow-md backdrop-blur-sm dark:bg-[#1F2937]/95"
              style={{ left: tipLeft, top: tipTop }}
            >
              <p className="text-[11px] font-semibold text-foreground mb-1">{String(row[labelKey] ?? "")}</p>
              <div className="space-y-0.5">
                {visibleSeries.map((s) => (
                  <p key={s.key} className="text-[11px] text-muted-foreground whitespace-nowrap">
                    <span className="inline-block h-1.5 w-1.5 rounded-sm mr-1.5 align-middle" style={{ background: s.color }} />
                    {s.label}: <span className="font-medium text-foreground tabular-nums">{formatValue(Number(row[s.key] ?? 0))}</span>
                  </p>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
