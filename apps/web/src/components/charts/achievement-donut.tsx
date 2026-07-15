"use client";

import { describeDonutArc } from "./chart-utils";

type AchievementDonutProps = {
  /** 実績値 */
  actual: number;
  /** 目標値（null = 未設定） */
  target: number | null;
  /** 達成率%（外部計算値。中央に表示） */
  rate: number;
  achievedColor: string;
  remainingColor?: string;
  size?: number;
  formatValue?: (value: number) => string;
};

/** 目標vs実績の達成率ドーナツ（中央に達成率%を表示） */
export function AchievementDonut({
  actual,
  target,
  rate,
  achievedColor,
  remainingColor = "rgba(var(--brand-accent-rgb),0.45)",
  size = 200,
  formatValue = (v) => v.toLocaleString(),
}: AchievementDonutProps) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;
  const innerR = outerR - 22;

  const hasTarget = target != null && target > 0;
  // 100%超過は満円で表示（超過分は中央の%で表現）
  const achievedRatio = hasTarget ? Math.min(actual / target, 1) : actual > 0 ? 1 : 0;
  const achievedAngle = Math.min(achievedRatio * 360, 359.9);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="達成率ドーナツ">
          {achievedAngle < 359.9 && (
            <path
              d={describeDonutArc(cx, cy, innerR, outerR, achievedAngle, 359.9)}
              fill={remainingColor}
            />
          )}
          {achievedAngle > 0 && (
            <path d={describeDonutArc(cx, cy, innerR, outerR, 0, achievedAngle)} fill={achievedColor}>
              <title>{`実績: ${formatValue(actual)}`}</title>
            </path>
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums" style={{ color: achievedColor }}>
            {hasTarget ? `${rate}%` : "—"}
          </span>
          <span className="text-[10px] text-muted-foreground mt-0.5">達成率</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: achievedColor }} />
          実績 {formatValue(actual)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: remainingColor }} />
          {hasTarget ? `残り ${formatValue(Math.max(target - actual, 0))}` : "目標 未設定"}
        </span>
      </div>
    </div>
  );
}
