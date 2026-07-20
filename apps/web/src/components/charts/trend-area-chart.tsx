"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import {
  buildSignedTicks,
  buildAsymmetricTicks,
  smoothLinePath,
  smoothAreaPath,
  smoothBandPath,
} from "./chart-utils";
import { cn } from "@/lib/utils";

export type TrendSeries = {
  key: string;
  label: string;
  color: string;
  /** グラデーション終点色（未指定時は color） */
  colorEnd?: string;
  /** 線の下を薄く塗る（既定 true） */
  area?: boolean;
  /** 線を太めのハイライトにする */
  highlight?: boolean;
  /** ピル型ラベルを載せる系列 */
  showPills?: boolean;
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
  /** x軸サブラベル（index → 文字列）。例: 実績 / 予測 */
  xSubLabel?: (index: number) => string | undefined;
  /** 初期状態で非表示にする系列キー */
  defaultHidden?: string[];
  /** 参考UI風のクリーンな見せ方 */
  variant?: "default" | "overview";
  /** 系列を積み上げたストリーム風エリア */
  stacked?: boolean;
};

type HoverState = { index: number };

export function TrendAreaChart({
  data,
  labelKey,
  series,
  height: heightProp = 280,
  unit = "",
  formatValue = (v) => String(v),
  forecastFromIndex,
  forecastZoneLabel = "着地予測",
  xSubLabel,
  defaultHidden = [],
  variant = "default",
  stacked = false,
}: TrendAreaChartProps) {
  const isOverview = variant === "overview";
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

  const stackedTotals = stacked
    ? data.map((row) => visibleSeries.reduce((sum, s) => sum + Math.max(0, Number(row[s.key] ?? 0)), 0))
    : [];
  const values = stacked
    ? stackedTotals
    : visibleSeries.flatMap((s) => data.map((row) => Number(row[s.key] ?? 0)));
  const allValues = [...values, 0];
  const dataMin = stacked ? 0 : Math.min(...allValues);
  const dataMax = Math.max(...allValues);

  const ticks = dataMin < 0
    ? buildSignedTicks(dataMin, dataMax, 2)
    : buildAsymmetricTicks(dataMin, dataMax, 4);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];

  const pad = isOverview
    ? { top: 36, right: 20, bottom: xSubLabel ? 42 : 32, left: 12 }
    : {
        top: 20,
        right: 16,
        bottom: 30,
        left: Math.max(58, 72),
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

  const stackedBands = useMemo(() => {
    if (!stacked) return [] as Array<{
      key: string;
      top: Array<{ x: number; y: number }>;
      bottom: Array<{ x: number; y: number }>;
      mid: Array<{ x: number; y: number }>;
    }>;
    return visibleSeries.map((s, si) => {
      const top: Array<{ x: number; y: number }> = [];
      const bottom: Array<{ x: number; y: number }> = [];
      const mid: Array<{ x: number; y: number }> = [];
      data.forEach((row, i) => {
        let lower = 0;
        for (let k = 0; k < si; k += 1) {
          lower += Math.max(0, Number(row[visibleSeries[k].key] ?? 0));
        }
        const upper = lower + Math.max(0, Number(row[s.key] ?? 0));
        const x = xOf(i);
        top.push({ x, y: yOf(upper) });
        bottom.push({ x, y: yOf(lower) });
        mid.push({ x, y: yOf((lower + upper) / 2) });
      });
      return { key: s.key, top, bottom, mid };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stacked, visibleSeries, data, width, height, yMin, yMax]);

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
  const bandFor = (key: string) => stackedBands.find((b) => b.key === key);

  const forecastStart =
    forecastFromIndex != null && forecastFromIndex < data.length && forecastFromIndex > 0
      ? xOf(forecastFromIndex)
      : null;

  const viewMargin = { left: 4, top: 4, right: 4, bottom: 4 };
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
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  };

  const toggle = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (prev.size < series.length - 1) next.add(key);
      return next;
    });

  const pillSeries = visibleSeries.find((s) => s.showPills) ?? visibleSeries.find((s) => s.highlight);
  const activeIndex = hover?.index
    ?? (forecastFromIndex != null && forecastFromIndex > 0
      ? Math.min(forecastFromIndex - 1, data.length - 1)
      : Math.min(data.length - 1, 5));

  // overview: ピルを載せる index（ホバー月 + 偶数月の実績など）
  const pillIndexes = useMemo(() => {
    if (!isOverview || !pillSeries) return [] as number[];
    const pinned = new Set<number>();
    if (hover) pinned.add(hover.index);
    else pinned.add(activeIndex);
    // 実績期間のピークっぽい位置にも薄く載せる（見栄え用）
    const end = forecastFromIndex != null ? forecastFromIndex : data.length;
    for (let i = 1; i < end; i += 2) pinned.add(i);
    return [...pinned].filter((i) => i >= 0 && i < data.length);
  }, [isOverview, pillSeries, hover, activeIndex, forecastFromIndex, data.length]);

  return (
    <div className="flex h-full w-full flex-col">
      <div className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1.5 pb-2.5 text-[11px]",
        isOverview ? "text-slate-600" : "text-muted-foreground",
      )}>
        {series.map((s) => {
          const on = !hidden.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              className="inline-flex items-center gap-1.5 select-none transition-opacity"
              style={{ opacity: on ? 1 : 0.35 }}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  background: on
                    ? `linear-gradient(135deg, ${s.color}, ${s.colorEnd ?? s.color})`
                    : "transparent",
                  boxShadow: on ? `0 0 0 1.5px ${s.color}` : `inset 0 0 0 1.5px ${s.color}`,
                }}
              />
              <span className={cn(on ? "font-medium text-foreground" : "text-muted-foreground")}>
                {s.label}
              </span>
            </button>
          );
        })}
      </div>

      <div
        ref={containerRef}
        className={cn(
          "relative flex-1 min-h-[200px] w-full",
          isOverview && "rounded-2xl bg-gradient-to-b from-slate-50/90 via-white to-sky-50/40 border border-slate-100/90",
        )}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => setHover({ index: nearestIndex(e.clientX) })}
      >
        <svg
          viewBox={`${-viewMargin.left} ${-viewMargin.top} ${vbW} ${vbH}`}
          width={width}
          height={height}
          className="h-full w-full min-h-[200px]"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="推移グラフ"
        >
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`trend-grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={s.color}
                  stopOpacity={stacked ? 0.95 : isOverview ? 0.45 : 0.28}
                />
                <stop
                  offset="55%"
                  stopColor={s.colorEnd ?? s.color}
                  stopOpacity={stacked ? 0.88 : isOverview ? 0.18 : 0.08}
                />
                <stop
                  offset="100%"
                  stopColor={s.colorEnd ?? s.color}
                  stopOpacity={stacked ? 0.82 : 0.02}
                />
              </linearGradient>
            ))}
            {series.map((s) => (
              <linearGradient key={`stroke-${s.key}`} id={`trend-stroke-${s.key}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={s.color} />
                <stop offset="100%" stopColor={s.colorEnd ?? s.color} />
              </linearGradient>
            ))}
            <filter id="trend-soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.12" />
            </filter>
          </defs>

          {/* 縦ガイド（月区切り） */}
          {isOverview && data.map((_, i) => (
            <line
              key={`vg-${i}`}
              x1={xOf(i)}
              y1={pad.top}
              x2={xOf(i)}
              y2={pad.top + chartH}
              stroke="#cbd5e1"
              strokeWidth={1}
              opacity={0.45}
            />
          ))}

          {/* 予測帯 */}
          {forecastStart != null && (
            <>
              <rect
                x={forecastStart}
                y={pad.top}
                width={Math.max(0, width - pad.right - forecastStart)}
                height={chartH}
                fill="#94a3b8"
                opacity={0.06}
              />
              <text
                x={(forecastStart + width - pad.right) / 2}
                y={pad.top + 14}
                textAnchor="middle"
                fontSize={10}
                fill="#64748b"
                opacity={0.75}
              >
                {forecastZoneLabel}
              </text>
            </>
          )}

          {/* ゼロ線（損益分岐の基準） */}
          <line
            x1={pad.left}
            y1={zeroY}
            x2={width - pad.right}
            y2={zeroY}
            stroke={isOverview ? "#94a3b8" : "currentColor"}
            strokeWidth={isOverview ? 1.25 : 1}
            opacity={isOverview ? 0.7 : 0.5}
          />
          {isOverview && (
            <text
              x={width - pad.right}
              y={zeroY - 6}
              textAnchor="end"
              fontSize={9}
              fill="#94a3b8"
            >
              損益分岐 0
            </text>
          )}

          {/* default 時のみ Y 目盛り */}
          {!isOverview && ticks.map((tick) => {
            const y = yOf(tick);
            return (
              <g key={tick}>
                <line
                  x1={pad.left}
                  y1={y}
                  x2={width - pad.right}
                  y2={y}
                  stroke="#cbd5e1"
                  strokeDasharray={tick === 0 ? undefined : "3 3"}
                  opacity={tick === 0 ? 0.5 : 0.35}
                />
                <text
                  x={pad.left - 8}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={10}
                  fill="#64748b"
                >
                  {`${tick < 0 ? "▲" : ""}${Math.abs(tick).toLocaleString()}${unit}`}
                </text>
              </g>
            );
          })}

          {/* 積み上げストリーム */}
          {stacked
            ? stackedBands.map((band, bi) => {
                const s = visibleSeries.find((v) => v.key === band.key);
                if (!s || s.area === false) return null;
                return (
                  <g key={`stack-${band.key}`}>
                    <path
                      d={smoothBandPath(band.top, band.bottom)}
                      fill={`url(#trend-grad-${s.key})`}
                      opacity={0.92}
                      pointerEvents="none"
                    />
                    <path
                      d={smoothLinePath(band.top)}
                      fill="none"
                      stroke="rgba(255,255,255,0.75)"
                      strokeWidth={bi === stackedBands.length - 1 ? 1.5 : 1.25}
                      strokeLinejoin="round"
                      pointerEvents="none"
                    />
                  </g>
                );
              })
            : (
              <>
                {/* エリア（ハイライト以外を先に） */}
                {visibleSeries
                  .filter((s) => !s.highlight && s.area !== false)
                  .map((s) => (
                    <path
                      key={`area-${s.key}`}
                      d={smoothAreaPath(pointsFor(s.key), zeroY)}
                      fill={`url(#trend-grad-${s.key})`}
                      pointerEvents="none"
                    />
                  ))}
                {visibleSeries
                  .filter((s) => s.highlight && s.area !== false)
                  .map((s) => (
                    <path
                      key={`area-hi-${s.key}`}
                      d={smoothAreaPath(pointsFor(s.key), zeroY)}
                      fill={`url(#trend-grad-${s.key})`}
                      pointerEvents="none"
                    />
                  ))}

                {/* 線 */}
                {visibleSeries.map((s) => {
                  const pts = pointsFor(s.key);
                  const thick = s.highlight || isOverview;
                  return (
                    <path
                      key={`line-${s.key}`}
                      d={smoothLinePath(pts)}
                      fill="none"
                      stroke={`url(#trend-stroke-${s.key})`}
                      strokeWidth={thick ? 2.75 : 2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      pointerEvents="none"
                      filter={s.highlight ? "url(#trend-soft-shadow)" : undefined}
                      opacity={s.highlight ? 1 : 0.9}
                    />
                  );
                })}
              </>
            )}

          {/* x軸ラベル */}
          {data.map((row, i) => {
            const forecast = forecastFromIndex != null && i >= forecastFromIndex;
            const sub = xSubLabel?.(i);
            return (
              <g key={`x-${i}`} opacity={forecast ? 0.5 : 1}>
                <text
                  x={xOf(i)}
                  y={height - (sub ? 18 : 8)}
                  textAnchor="middle"
                  fontSize={isOverview ? 12 : 11}
                  fontWeight={isOverview ? 700 : 400}
                  fill={isOverview ? "#0f172a" : "currentColor"}
                >
                  {String(row[labelKey] ?? "")}
                </text>
                {sub ? (
                  <text
                    x={xOf(i)}
                    y={height - 4}
                    textAnchor="middle"
                    fontSize={9}
                    fill="#94a3b8"
                  >
                    {sub}
                  </text>
                ) : null}
              </g>
            );
          })}

          {/* ホバー縦線 + ドット */}
          {hover && (
            <>
              <line
                x1={xOf(hover.index)}
                y1={pad.top}
                x2={xOf(hover.index)}
                y2={pad.top + chartH}
                stroke="#64748b"
                strokeWidth={1}
                opacity={0.35}
                pointerEvents="none"
              />
              {visibleSeries.map((s) => {
                const band = bandFor(s.key);
                const cy = stacked && band
                  ? band.top[hover.index]?.y ?? yOf(0)
                  : yOf(Number(data[hover.index]?.[s.key] ?? 0));
                return (
                  <circle
                    key={`dot-${s.key}`}
                    cx={xOf(hover.index)}
                    cy={cy}
                    r={s.highlight || stacked ? 5 : 4}
                    fill="#fff"
                    stroke={s.color}
                    strokeWidth={2.5}
                    pointerEvents="none"
                  />
                );
              })}
            </>
          )}

          {/* overview: ピル型ラベル（累計） */}
          {isOverview && pillSeries && pillIndexes.map((i) => {
            const val = Number(data[i]?.[pillSeries.key] ?? 0);
            const cx = xOf(i);
            const cy = yOf(val);
            const label = formatValue(val);
            const pillW = Math.max(52, label.length * 7.2 + 16);
            const pillH = 22;
            const above = cy > pad.top + 36;
            const pillY = above ? cy - pillH - 12 : cy + 12;
            const pillX = Math.min(
              Math.max(cx - pillW / 2, pad.left),
              width - pad.right - pillW,
            );
            const isActive = hover?.index === i || (!hover && i === activeIndex);
            return (
              <g key={`pill-${i}`} opacity={isActive ? 1 : 0.55} pointerEvents="none">
                <circle
                  cx={cx}
                  cy={cy}
                  r={isActive ? 5 : 3.5}
                  fill="#fff"
                  stroke={pillSeries.color}
                  strokeWidth={2.5}
                />
                <rect
                  x={pillX}
                  y={pillY}
                  width={pillW}
                  height={pillH}
                  rx={pillH / 2}
                  fill={pillSeries.color}
                  filter="url(#trend-soft-shadow)"
                />
                <text
                  x={pillX + pillW / 2}
                  y={pillY + pillH / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={11}
                  fontWeight={700}
                  fill="#fff"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* default ホバー詳細カード */}
        {!isOverview && hover && data[hover.index] && (() => {
          const row = data[hover.index];
          const tipLeft = Math.min(Math.max(xOf(hover.index), 90), Math.max(width - 90, 90));
          return (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-border/70 bg-white/95 px-2.5 py-2 shadow-md backdrop-blur-sm"
              style={{ left: tipLeft, top: 8 }}
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

        {/* overview: ホバー時の詳細ミニカード（ピルの下） */}
        {isOverview && hover && data[hover.index] && (
          <div
            className="pointer-events-none absolute z-10 rounded-xl border border-white/80 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm"
            style={{
              left: Math.min(Math.max(xOf(hover.index) + 12, 12), Math.max(width - 180, 12)),
              top: 12,
            }}
          >
            <p className="text-[11px] font-bold text-slate-800 mb-1">
              {String(data[hover.index][labelKey] ?? "")}
              {xSubLabel?.(hover.index) ? (
                <span className="ml-1.5 font-normal text-slate-400">{xSubLabel(hover.index)}</span>
              ) : null}
            </p>
            <div className="space-y-0.5">
              {visibleSeries.map((s) => (
                <p key={s.key} className="text-[11px] text-slate-500 whitespace-nowrap">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full mr-1.5 align-middle"
                    style={{ background: s.color }}
                  />
                  {s.label}{" "}
                  <span className="font-semibold text-slate-800 tabular-nums">
                    {formatValue(Number(data[hover.index][s.key] ?? 0))}
                  </span>
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
