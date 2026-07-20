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
  /** 余白を詰めた表示（ダッシュボード密度向け） */
  compact?: boolean;
};

/** 部門別などのカテゴリ比較用の横棒グラフ */
export function HorizontalBarChart({
  data,
  series,
  formatValue = (v) => v.toLocaleString(),
  labelColor = "#64748b",
  compact = false,
}: HorizontalBarChartProps) {
  const maxValue = Math.max(1, ...data.flatMap((d) => d.values.map((v) => Math.abs(v))));

  return (
    <div className={compact ? "flex flex-col gap-2" : "flex flex-col gap-4"}>
      <div className={compact ? "flex flex-col gap-2" : "flex flex-col gap-3.5"}>
        {data.map((row) => (
          <div key={row.label} className={compact ? "flex flex-col gap-0.5" : "flex flex-col gap-1"}>
            <span className={compact ? "text-[11px] font-medium text-foreground" : "text-xs font-medium text-foreground"}>{row.label}</span>
            <div className={compact ? "flex flex-col gap-0.5" : "flex flex-col gap-1"}>
              {series.map((s, si) => {
                const value = row.values[si] ?? 0;
                const ratio = Math.max(Math.abs(value) / maxValue, 0);
                return (
                  <div key={s.label} className="flex items-center gap-2">
                    <div
                      className={compact ? "flex-1 h-3.5 rounded-md overflow-hidden" : "flex-1 h-6 rounded-md overflow-hidden"}
                      style={{ background: "rgba(var(--brand-accent-rgb),0.25)" }}
                    >
                      <div
                        className="h-full rounded transition-all"
                        style={{ width: `${Math.min(ratio * 100, 100)}%`, background: s.color }}
                        title={`${row.label} ${s.label}: ${formatValue(value)}`}
                      />
                    </div>
                    <span className={compact ? "text-[10px] tabular-nums w-20 text-right shrink-0" : "text-[11px] tabular-nums w-24 text-right shrink-0"} style={{ color: labelColor }}>
                      {formatValue(value)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className={compact ? "flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[10px]" : "flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px]"} style={{ color: labelColor }}>
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className={compact ? "h-2 w-2 rounded-sm" : "h-2.5 w-2.5 rounded-sm"} style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
