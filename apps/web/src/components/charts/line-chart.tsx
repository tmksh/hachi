import { buildTicks, linePath, niceMax } from "./chart-utils";

export type LineChartSeries = {
  key: string;
  label: string;
  color: string;
  yAxis?: "left" | "right";
  formatValue?: (value: number) => string;
};

export type LineChartRow = Record<string, string | number>;

type LineChartProps = {
  data: LineChartRow[];
  labelKey: string;
  series: LineChartSeries[];
  height?: number;
  gridColor?: string;
  labelColor?: string;
  tickColor?: string;
};

export function LineChart({
  data,
  labelKey,
  series,
  height = 280,
  gridColor = "#f0f0f0",
  labelColor = "#64748b",
  tickColor = "#64748b",
}: LineChartProps) {
  const width = 480;
  const pad = { top: 12, right: 40, bottom: 28, left: 44 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const leftSeries = series.filter((s) => (s.yAxis ?? "left") === "left");
  const rightSeries = series.filter((s) => s.yAxis === "right");

  const leftMax = Math.max(
    1,
    ...data.flatMap((row) => leftSeries.map((s) => Number(row[s.key] ?? 0))),
  );
  const rightMax = Math.max(
    1,
    ...data.flatMap((row) => rightSeries.map((s) => Number(row[s.key] ?? 0))),
  );
  const leftYMax = niceMax(leftMax);
  const rightYMax = niceMax(rightMax);
  const leftTicks = buildTicks(leftYMax, 4);
  const rightTicks = buildTicks(rightYMax, 4);

  const xStep = chartW / Math.max(data.length - 1, 1);
  const toX = (index: number) => pad.left + index * xStep;
  const toLeftY = (value: number) => pad.top + chartH - (value / leftYMax) * chartH;
  const toRightY = (value: number) => pad.top + chartH - (value / rightYMax) * chartH;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label="折れ線グラフ">
      {leftTicks.map((tick) => {
        const y = toLeftY(tick);
        return (
          <g key={`left-${tick}`}>
            <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke={gridColor} strokeDasharray="3 3" />
            <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize={11} fill={tickColor}>
              {tick >= 1_000_000
                ? `${Math.round(tick / 1_000_000)}M`
                : tick >= 1000
                  ? `${Math.round(tick / 1000)}K`
                  : tick}
            </text>
          </g>
        );
      })}

      {rightTicks.map((tick) => {
        const y = toRightY(tick);
        return (
          <text
            key={`right-${tick}`}
            x={width - pad.right + 6}
            y={y + 4}
            textAnchor="start"
            fontSize={11}
            fill={tickColor}
          >
            {tick}
          </text>
        );
      })}

      {data.map((row, index) => (
        <text
          key={`${row[labelKey]}-${index}`}
          x={toX(index)}
          y={height - 6}
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
          y: (s.yAxis === "right" ? toRightY : toLeftY)(Number(row[s.key] ?? 0)),
        }));
        return (
          <g key={s.key}>
            <path
              d={linePath(points)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((point, index) => (
              <circle key={index} cx={point.x} cy={point.y} r={3} fill={s.color}>
                <title>
                  {`${s.label}: ${
                    s.formatValue
                      ? s.formatValue(Number(data[index][s.key] ?? 0))
                      : String(data[index][s.key] ?? 0)
                  }`}
                </title>
              </circle>
            ))}
          </g>
        );
      })}

      <g transform={`translate(${pad.left}, ${pad.top - 4})`}>
        {series.map((s, index) => (
          <g key={s.key} transform={`translate(${index * 88}, 0)`}>
            <circle cx={0} cy={0} r={4} fill={s.color} />
            <text x={10} y={4} fontSize={11} fill={labelColor}>
              {s.label}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
