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
};

export function DonutChart({
  data,
  height = 300,
  innerRadius = 60,
  outerRadius = 100,
  formatValue = (v) => String(v),
  labelColor = "#64748b",
}: DonutChartProps) {
  const width = 480;
  const cx = width * 0.38;
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
    <div className="flex items-center gap-6 w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full min-h-[240px]" role="img" aria-label="ドーナツグラフ">
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
          const labelRadius = outerRadius + 18;
          const angle = ((mid - 90) * Math.PI) / 180;
          const x = cx + labelRadius * Math.cos(angle);
          const y = cy + labelRadius * Math.sin(angle);
          if (slice.percent < 0.06) return null;
          return (
            <text
              key={`${slice.label}-label`}
              x={x}
              y={y}
              textAnchor="middle"
              fontSize={11}
              fill={labelColor}
            >
              {`${slice.label} ${Math.round(slice.percent * 100)}%`}
            </text>
          );
        })}
      </svg>
      <div className="hidden sm:flex flex-col gap-2 min-w-[140px]">
        {slices.map((slice) => (
          <div key={`legend-${slice.label}`} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: slice.color }} />
            <span className="text-muted-foreground">{slice.label}</span>
            <span className="ml-auto font-medium tabular-nums">{formatValue(slice.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
