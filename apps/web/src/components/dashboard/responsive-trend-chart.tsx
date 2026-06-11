import { GroupedBarChart, type GroupedBarChartRow } from "@/components/charts/grouped-bar-chart";
import type { BrandColors } from "@/lib/brand-color";

export type TrendChartRow = {
  month: string;
  受注額: number;
  パイプライン: number;
};

export function ResponsiveTrendChart({
  data,
  brandColors,
}: {
  data: TrendChartRow[];
  brandColors: BrandColors;
}) {
  return (
    <GroupedBarChart
      data={data as GroupedBarChartRow[]}
      labelKey="month"
      idPrefix="dashboard-trend"
      series={[
        {
          key: "パイプライン",
          label: "パイプライン",
          gradient: ["var(--brand-accent)", "var(--brand-mid)"],
        },
        {
          key: "受注額",
          label: "受注額",
          gradient: ["var(--brand-light)", "var(--brand-dark)"],
        },
      ]}
      formatValue={(v) => `¥${v}万`}
      gridColor={brandColors.accent}
      labelColor={brandColors.light}
      tickColor={brandColors.light}
    />
  );
}
