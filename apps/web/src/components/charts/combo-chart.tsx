"use client";

import { useRef, useState, useEffect } from "react";
import { buildSignedTicks, linePath, areaPath } from "./chart-utils";

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
  lineArea = false,
  forecastFromIndex,
  forecastZoneLabel = "着地予測領域",
  centered = false,
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

  const barValues = data.flatMap((row) => bars.map((b) => Number(row[b.key] ?? 0)));
  const lineValues = line ? data.map((row) => Number(row[line.key] ?? 0)) : [];
  const allValues = [...barValues, ...lineValues, 0];
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);

  const ticks = buildSignedTicks(dataMin, dataMax, 2);
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
    ? Math.min(22, groupWidth * 0.42)
    : Math.min(18, (groupWidth * 0.6) / bars.length);

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
        className="flex-1 min-h-[180px] w-full pl-1"
        style={{ color: labelColor }}
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
              : bars.length * barWidth + (bars.length - 1) * 2;
            const startX = centered
              ? centerX - barWidth / 2
              : groupX + (groupWidth - barsBlockW) / 2;

            return (
              <g key={`${label}-${rowIndex}`}>
                <text
                  x={centerX}
                  y={height - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fill={labelColor}
                  opacity={forecast ? 0.55 : 1}
                >
                  {label}
                </text>
                {bars.map((b, bi) => {
                  const value = Number(row[b.key] ?? 0);
                  const y = value >= 0 ? yOf(value) : zeroY;
                  const barH = Math.abs(yOf(value) - zeroY);
                  const x = centered ? startX : startX + bi * (barWidth + 2);
                  const fill = forecast && b.forecastFill ? b.forecastFill : b.fill;
                  return (
                    <rect
                      key={b.key}
                      x={x}
                      y={y}
                      width={barWidth}
                      height={Math.max(barH, 0)}
                      rx={3}
                      fill={fill}
                      opacity={forecast && !b.forecastFill ? 0.45 : 1}
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
              <path
                d={linePath(linePoints)}
                fill="none"
                stroke={line.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {linePoints.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={3}
                  fill={line.color}
                  opacity={isForecast(i) ? 0.55 : 1}
                >
                  <title>{`${line.label}: ${formatValue(Number(data[i][line.key] ?? 0))}`}</title>
                </circle>
              ))}
            </>
          )}
        </svg>
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
