import { describeDonutArc } from "./chart-utils";

export type DonutChartSlice = {
  label: string;
  value: number;
  color: string;
};

type DonutChartProps = {
  data: DonutChartSlice[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  formatValue?: (value: number) => string;
  labelColor?: string;
  /** 外周ラベルのフォントサイズ */
  labelFontSize?: number;
  /** 右側凡例を大きく表示 */
  largeLegend?: boolean;
};

export function DonutChart({
  data,
  height = 300,
  innerRadius = 60,
  outerRadius = 100,
  formatValue = (v) => String(v),
  labelColor = "#64748b",
  labelFontSize = 11,
  largeLegend = false,
}: DonutChartProps) {
  const labelPad = Math.max(36, labelFontSize * 3.2);
  const width = Math.max(480, Math.round(outerRadius * 2 + labelPad * 2 + (largeLegend ? 200 : 160)));
  const cx = largeLegend ? width * 0.36 : width * 0.42;
  const cy = height / 2;
  const total = data.reduce((sum, slice) => sum + slice.value, 0) || 1;
  let cursor = 0;

  const slices = data.map((slice) => {
    const angle = (slice.value / total) * 360;
    const start = cursor;
    const end = cursor + angle;
    cursor = end;
    return { ...slice, start, end, percent: slice.value / total };
  });

  return (
    <div className={largeLegend ? "flex items-center gap-8 w-full h-full" : "flex items-center gap-6 w-full h-full"}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full min-w-0 flex-1" role="img" aria-label="ドーナツグラフ">
        {slices.map((slice) => (
          <path
            key={slice.label}
            d={describeDonutArc(cx, cy, innerRadius, outerRadius, slice.start, slice.end - 0.4)}
            fill={slice.color}
          >
            <title>{`${slice.label}: ${formatValue(slice.value)} (${Math.round(slice.percent * 100)}%)`}</title>
          </path>
        ))}
        {slices.map((slice) => {
          const mid = slice.start + (slice.end - slice.start) / 2;
          const labelRadius = outerRadius + labelFontSize * 1.6;
          const angle = ((mid - 90) * Math.PI) / 180;
          const x = cx + labelRadius * Math.cos(angle);
          const y = cy + labelRadius * Math.sin(angle);
          if (slice.percent < 0.05) return null;
          return (
            <text
              key={`${slice.label}-label`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={labelFontSize}
              fontWeight={600}
              fill={labelColor}
            >
              {`${slice.label} ${Math.round(slice.percent * 100)}%`}
            </text>
          );
        })}
      </svg>
      <div className={largeLegend
        ? "hidden sm:flex flex-col gap-3 min-w-[168px] shrink-0"
        : "hidden sm:flex flex-col gap-2 min-w-[140px] shrink-0"
      }>
        {slices.map((slice) => (
          <div
            key={`legend-${slice.label}`}
            className={largeLegend ? "flex items-center gap-2.5 text-sm" : "flex items-center gap-2 text-xs"}
          >
            <span
              className={largeLegend ? "h-3.5 w-3.5 rounded-full shrink-0" : "h-2.5 w-2.5 rounded-full shrink-0"}
              style={{ background: slice.color }}
            />
            <span className="text-muted-foreground font-medium">{slice.label}</span>
            <span className={largeLegend ? "ml-auto font-bold tabular-nums text-foreground" : "ml-auto font-medium tabular-nums"}>
              {formatValue(slice.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
