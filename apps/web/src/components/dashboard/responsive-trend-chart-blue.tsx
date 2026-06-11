"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { BLUE } from "@/lib/blue-theme";

export type BlueTrendChartRow = {
  month: string;
  受注額: number;
  パイプライン: number;
};

export function ResponsiveTrendChartBlue({ data }: { data: BlueTrendChartRow[] }) {
  return (
    <div className="flex-1 min-h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%" minHeight={180}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="10%" barGap={2}>
          <defs>
            <linearGradient id="chartWonGradientBlue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BLUE[500]} />
              <stop offset="100%" stopColor={BLUE[700]} />
            </linearGradient>
            <linearGradient id="chartPipelineGradientBlue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BLUE[50]} />
              <stop offset="100%" stopColor={BLUE[100]} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={BLUE[50]} vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: BLUE[500] }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: BLUE[500] }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: `${BLUE[50]}88` }}
            contentStyle={{ background: "#fff", border: `1px solid ${BLUE[100]}`, borderRadius: 10, fontSize: 12, boxShadow: "0 4px 16px rgba(0,75,146,0.08)" }}
            formatter={(v, name) => [`¥${v}万`, name ?? ""]}
          />
          <Bar dataKey="パイプライン" fill="url(#chartPipelineGradientBlue)" radius={[4, 4, 0, 0]} maxBarSize={36} />
          <Bar dataKey="受注額" fill="url(#chartWonGradientBlue)" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
