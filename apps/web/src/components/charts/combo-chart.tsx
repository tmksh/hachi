"use client";

import { useRef, useState, useEffect } from "react";
import { buildSignedTicks, buildAsymmetricTicks, linePath, areaPath } from "./chart-utils";

export type ComboBarSeries = {
  key: string;
  label: string;
  fill: string;
  /** 予測領域での半透明色（未指定時は fill + opacity） */
  forecastFill?: string;
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
  /** 0 を基準に上下に伸びる棒。centered=true で同一 x 中心に重ね表示 */
  bars: ComboBarSeries[];
  /** 折れ線（累計など） */
  line?: ComboLineSeries;
  /** 折れ線下をゼロ基準線まで塗る */
  lineArea?: boolean;
  /** この index 以降を着地予測領域として表示（背景帯 + 棒半透明） */
  forecastFromIndex?: number;
  forecastZoneLabel?: string;
  /** 同一 x 中心に上下棒を重ねる（参考UI） */
  centered?: boolean;
  /** 各グループ（x軸項目）のホバー詳細用注記（昨対比%など）。常時は出さずホバー時に表示 */
  groupAnnotations?: (GroupAnnotation | null)[];
  height?: number;
  unit?: string;
  formatValue?: (value: number) => string;
  gridColor?: string;
  labelColor?: string;
  tickColor?: string;
  /** 棒を太くして見やすくする（株主向けダッシュボード等） */
  thickBars?: boolean;
};

export type GroupAnnotation = {
  text: string;
  color?: string;
};

type HoverTip = {
  rowIndex: number;
  x: number;
  y: number;
};

export function ComboChart({
  data,
  labelKey,
  bars,
  line,
  lineArea = false,
  forecastFromIndex,
  forecastZoneLabel = "着地予測領域",
  centered = false,
  groupAnnotations,
  height: heightProp = 240,
  unit = "",
  formatValue = (v) => String(v),
  gridColor = "currentColor",
  labelColor = "currentColor",
  tickColor = "currentColor",
  thickBars = false,
}: ComboChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 640, height: heightProp });
  const [hover, setHover] = useState<HoverTip | null>(null);

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

  const barValues = data.flatMap((row) => bars.map((b) => Number(row[b.key] ?? 0)));
  const lineValues = line ? data.map((row) => Number(row[line.key] ?? 0)) : [];
  const allValues = [...barValues, ...lineValues, 0];
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);

  // 負値がないデータでは 0 起点の目盛りにする（昨対比較など正値のみのグラフ用）
  const ticks = dataMin < 0
    ? buildSignedTicks(dataMin, dataMax, 2)
    : buildAsymmetricTicks(dataMin, dataMax, 4);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];

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
  const span = yMax - yMin || 1;
  const yOf = (v: number) => pad.top + chartH - ((v - yMin) / span) * chartH;
  const zeroY = yOf(0);

  const groupWidth = chartW / Math.max(data.length, 1);
  const barWidth = centered
    ? Math.min(thickBars ? 52 : 22, groupWidth * (thickBars ? 0.72 : 0.42))
    : Math.min(thickBars ? 48 : 18, (groupWidth * (thickBars ? 0.88 : 0.6)) / Math.max(bars.length, 1));
  const barGap = thickBars ? 6 : 2;
  const barRadius = thickBars ? 8 : 3;

  const linePoints = line
    ? data.map((row, i) => ({
        x: pad.left + i * groupWidth + groupWidth / 2,
        y: yOf(Number(row[line.key] ?? 0)),
      }))
    : [];

  const forecastStart =
    forecastFromIndex != null && forecastFromIndex < data.length
      ? pad.left + forecastFromIndex * groupWidth
      : null;
  const forecastWidth =
    forecastStart != null ? (data.length - forecastFromIndex!) * groupWidth : 0;

  const viewMargin = { left: 6, top: 6, right: 0, bottom: 0 };
  const vbW = width + viewMargin.left + viewMargin.right;
  const vbH = height + viewMargin.top + viewMargin.bottom;

  const isForecast = (rowIndex: number) =>
    forecastFromIndex != null && rowIndex >= forecastFromIndex;

  return (
    <div className="flex h-full w-full flex-col">
      <div
        ref={containerRef}
        className="relative flex-1 min-h-[180px] w-full pl-1"
        style={{ color: labelColor }}
        onMouseLeave={() => setHover(null)}
      >
        <svg
          viewBox={`${-viewMargin.left} ${-viewMargin.top} ${vbW} ${vbH}`}
          width={width}
          height={height}
          className="h-full w-full min-h-[180px]"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="複合グラフ"
        >
          {forecastStart != null && forecastWidth > 0 && (
            <>
              <rect
                x={forecastStart}
                y={pad.top}
                width={forecastWidth}
                height={chartH}
                fill="currentColor"
                opacity={0.06}
              />
              <text
                x={forecastStart + forecastWidth / 2}
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

          {line && lineArea && linePoints.length > 0 && (
            <path
              d={areaPath(linePoints, zeroY)}
              fill={line.color}
              opacity={0.12}
            />
          )}

          {data.map((row, rowIndex) => {
            const label = String(row[labelKey] ?? "");
            const groupX = pad.left + rowIndex * groupWidth;
            const centerX = groupX + groupWidth / 2;
            const forecast = isForecast(rowIndex);
            const barsBlockW = centered
              ? barWidth
              : bars.length * barWidth + (bars.length - 1) * barGap;
            const startX = centered
              ? centerX - barWidth / 2
              : groupX + (groupWidth - barsBlockW) / 2;

            return (
              <g key={`${label}-${rowIndex}`}>
                <text
                  x={centerX}
                  y={height - 6}
                  textAnchor="middle"
                  fontSize={thickBars ? 12 : 11}
                  fill={labelColor}
                  opacity={forecast ? 0.55 : 1}
                >
                  {label}
                </text>
                {bars.map((b, bi) => {
                  const value = Number(row[b.key] ?? 0);
                  const y = value >= 0 ? yOf(value) : zeroY;
                  const barH = Math.abs(yOf(value) - zeroY);
                  const x = centered ? startX : startX + bi * (barWidth + barGap);
                  const fill = forecast && b.forecastFill ? b.forecastFill : b.fill;
                  return (
                    <rect
                      key={b.key}
                      x={x}
                      y={y}
                      width={barWidth}
                      height={Math.max(barH, 0)}
                      rx={barRadius}
                      fill={fill}
                      opacity={forecast && !b.forecastFill ? 0.45 : 1}
                      pointerEvents="none"
                    />
                  );
                })}
                {/* ホバー用ヒット領域（月グループ全体） */}
                <rect
                  x={groupX}
                  y={pad.top}
                  width={groupWidth}
                  height={chartH}
                  fill="transparent"
                  className="cursor-default"
                  onMouseEnter={(e) => {
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    setHover({
                      rowIndex,
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                    });
                  }}
                  onMouseMove={(e) => {
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    setHover({
                      rowIndex,
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                    });
                  }}
                />
              </g>
            );
          })}

          {line && linePoints.length > 0 && (
            <>
              <path
                d={linePath(linePoints)}
                fill="none"
                stroke={line.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                pointerEvents="none"
              />
              {linePoints.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={3}
                  fill={line.color}
                  opacity={isForecast(i) ? 0.55 : 1}
                  pointerEvents="none"
                />
              ))}
            </>
          )}
        </svg>

        {hover && (() => {
          const row = data[hover.rowIndex];
          if (!row) return null;
          const label = String(row[labelKey] ?? "");
          const annotation = groupAnnotations?.[hover.rowIndex];
          const tipLeft = Math.min(Math.max(hover.x, 80), Math.max(width - 80, 80));
          const tipTop = Math.max(hover.y - 12, 8);
          return (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-border/70 bg-white/95 px-2.5 py-2 shadow-md backdrop-blur-sm dark:bg-[#1F2937]/95"
              style={{ left: tipLeft, top: tipTop }}
            >
              <p className="text-[11px] font-semibold text-foreground mb-1">{label}</p>
              <div className="space-y-0.5">
                {bars.map((b) => (
                  <p key={b.key} className="text-[11px] text-muted-foreground whitespace-nowrap">
                    <span className="inline-block h-1.5 w-1.5 rounded-sm mr-1.5 align-middle" style={{ background: b.fill }} />
                    {b.label}: <span className="font-medium text-foreground tabular-nums">{formatValue(Number(row[b.key] ?? 0))}</span>
                  </p>
                ))}
                {line && (
                  <p className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {line.label}: <span className="font-medium text-foreground tabular-nums">{formatValue(Number(row[line.key] ?? 0))}</span>
                  </p>
                )}
                {annotation && (
                  <p className="text-[11px] font-semibold pt-1 mt-1 border-t border-border/50 whitespace-nowrap" style={{ color: annotation.color ?? tickColor }}>
                    昨対比 {annotation.text}
                  </p>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      <div
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 text-[11px]"
        style={{ color: tickColor }}
      >
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
