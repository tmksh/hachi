"use client";

export type HorizontalBarRow = {
  label: string;
  /** 系列ごとの値（bars の順序に対応） */
  values: number[];
};

export type HorizontalBarSeries = {
  label: string;
  color: string;
};

type HorizontalBarChartProps = {
  data: HorizontalBarRow[];
  series: HorizontalBarSeries[];
  formatValue?: (value: number) => string;
  labelColor?: string;
};

/** 部門別などのカテゴリ比較用の横棒グラフ */
export function HorizontalBarChart({
  data,
  series,
  formatValue = (v) => v.toLocaleString(),
  labelColor = "#64748b",
}: HorizontalBarChartProps) {
  const maxValue = Math.max(1, ...data.flatMap((d) => d.values.map((v) => Math.abs(v))));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3.5">
        {data.map((row) => (
          <div key={row.label} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-foreground">{row.label}</span>
            <div className="flex flex-col gap-1">
              {series.map((s, si) => {
                const value = row.values[si] ?? 0;
                const ratio = Math.max(Math.abs(value) / maxValue, 0);
                return (
                  <div key={s.label} className="flex items-center gap-2">
                    <div className="flex-1 h-4 rounded overflow-hidden" style={{ background: "rgba(var(--brand-accent-rgb),0.25)" }}>
                      <div
                        className="h-full rounded transition-all"
                        style={{ width: `${Math.min(ratio * 100, 100)}%`, background: s.color }}
                        title={`${row.label} ${s.label}: ${formatValue(value)}`}
                      />
                    </div>
                    <span className="text-[11px] tabular-nums w-24 text-right shrink-0" style={{ color: labelColor }}>
                      {formatValue(value)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px]" style={{ color: labelColor }}>
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
