import { GroupedBarChart, type GroupedBarChartRow } from "@/components/charts/grouped-bar-chart";
import { BLUE } from "@/lib/blue-theme";

export type BlueTrendChartRow = {
  month: string;
  受注額: number;
  パイプライン: number;
};

export function ResponsiveTrendChartBlue({ data }: { data: BlueTrendChartRow[] }) {
  return (
    <GroupedBarChart
      data={data as GroupedBarChartRow[]}
      labelKey="month"
      idPrefix="dashboard-trend-blue"
      series={[
        {
          key: "パイプライン",
          label: "パイプライン",
          gradient: [BLUE[50], BLUE[100]],
        },
        {
          key: "受注額",
          label: "受注額",
          gradient: [BLUE[500], BLUE[700]],
        },
      ]}
      formatValue={(v) => `¥${v}万`}
      gridColor={BLUE[50]}
      labelColor={BLUE[500]}
      tickColor={BLUE[500]}
    />
  );
}
