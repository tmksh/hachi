"use client";

import { useState, useEffect } from "react";

interface AnalogClockProps {
  size?: number;
  className?: string;
}

export function AnalogClock({ size = 88, className = "" }: AnalogClockProps) {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;

  const h = time ? ((time.getHours() % 12) + time.getMinutes() / 60) * 30 : 0;
  const m = time ? time.getMinutes() * 6 + time.getSeconds() / 10 : 0;
  const s = time ? time.getSeconds() * 6 : 0;

  const hand = (deg: number, length: number, width: number, color: string) => {
    const rad = (deg - 90) * (Math.PI / 180);
    const x2 = cx + length * Math.cos(rad);
    const y2 = cy + length * Math.sin(rad);
    return (
      <line
        x1={cx} y1={cy}
        x2={x2} y2={y2}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
      />
    );
  };

  const markers = Array.from({ length: 12 }, (_, i) => i * 30);

  return (
    <div
      className={`neumorph-clock shrink-0 ${className}`}
      style={{ width: size, height: size, borderRadius: "50%" }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Clock face inner shadow ring */}
        <circle cx={cx} cy={cy} r={r * 0.88} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={2} />

        {/* Hour markers */}
        {markers.map((deg) => {
          const isMajor = deg % 90 === 0;
          const rad = (deg - 90) * (Math.PI / 180);
          const r1 = r * 0.80;
          const r2 = r * (isMajor ? 0.66 : 0.73);
          return (
            <line
              key={deg}
              x1={cx + r1 * Math.cos(rad)}
              y1={cy + r1 * Math.sin(rad)}
              x2={cx + r2 * Math.cos(rad)}
              y2={cy + r2 * Math.sin(rad)}
              stroke={isMajor ? "#9baacf" : "#c8d0e7"}
              strokeWidth={isMajor ? 2 : 1}
              strokeLinecap="round"
            />
          );
        })}

        {/* Hands */}
        {hand(h, r * 0.46, 2.8, "#8a9cc0")}
        {hand(m, r * 0.62, 2.2, "#6b7fa8")}
        {hand(s, r * 0.70, 1.4, "var(--primary)")}

        {/* Center dot */}
        <circle cx={cx} cy={cy} r={3.5} fill="var(--primary)" />
        <circle cx={cx} cy={cy} r={1.5} fill="white" />
      </svg>
    </div>
  );
}
