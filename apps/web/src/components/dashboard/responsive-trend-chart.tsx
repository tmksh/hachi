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
    <div className="flex-1 min-h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%" minHeight={180}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="10%" barGap={2}>
          <defs>
            <linearGradient id="chartWonGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--brand-light)" }} />
              <stop offset="100%" style={{ stopColor: "var(--brand-dark)" }} />
            </linearGradient>
            <linearGradient id="chartPipelineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--brand-accent)" }} />
              <stop offset="100%" style={{ stopColor: "var(--brand-mid)" }} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={brandColors.accent} vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: brandColors.light }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: brandColors.light }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: brandColors.accent + "88" }}
            contentStyle={{ background: "#fff", border: `1px solid ${brandColors.mid}`, borderRadius: 10, fontSize: 12, boxShadow: `0 4px 16px rgba(var(--primary-rgb),0.08)` }}
            formatter={(v, name) => [`¥${v}万`, name ?? ""]}
          />
          <Bar dataKey="パイプライン" fill="url(#chartPipelineGradient)" radius={[4, 4, 0, 0]} maxBarSize={36} />
          <Bar dataKey="受注額" fill="url(#chartWonGradient)" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
