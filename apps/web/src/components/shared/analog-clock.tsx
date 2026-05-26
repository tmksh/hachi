"use client";

import { useState, useEffect, useId } from "react";
import { TEAL } from "@/lib/teal-theme";
import { BLUE } from "@/lib/blue-theme";

interface AnalogClockProps {
  size?: number;
  className?: string;
  variant?: "teal" | "blue";
  flat?: boolean;
  hourColor?: string;
  minuteColor?: string;
  secondColor?: string;
  centerColor?: string;
  numColor?: string;
  tickColor?: string;
}

const VB = 350;
const CX = VB / 2;
const CY = VB / 2;

const MINOR_TICK_ANGLES = [30, 60, 120, 150, 210, 240, 300, 330];

export function AnalogClock({
  size = 88,
  className = "",
  variant = "teal",
  flat = false,
  hourColor,
  minuteColor,
  secondColor,
  centerColor,
  numColor,
  tickColor,
}: AnalogClockProps) {
  const palette = variant === "blue" ? BLUE : TEAL;
  const resolvedHour = hourColor ?? palette[700];
  const resolvedMinute = minuteColor ?? palette[500];
  const resolvedSecond = secondColor ?? palette[300];
  const resolvedCenter = centerColor ?? palette[700];
  const resolvedNum = numColor ?? palette[500];
  const resolvedTick = tickColor ?? palette[100];
  const faceMid = variant === "blue" ? "#F5F9FE" : "#F4FAF7";
  const shadowRgb = variant === "blue" ? "43,110,168" : "42,128,85";
  const insetRgb = variant === "blue" ? "122,180,219" : "168,212,188";
  const ringStroke = variant === "blue" ? "rgba(122, 180, 219, 0.55)" : "rgba(168, 212, 188, 0.55)";
  const faceGradientId = useId().replace(/:/g, "");
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const h = time ? (time.getHours() % 12) * 30 + time.getMinutes() / 2 : 0;
  const m = time ? time.getMinutes() * 6 + time.getSeconds() / 10 : 0;
  const s = time ? time.getSeconds() * 6 : 0;

  const scale = size / VB;
  const border = 14 * scale;
  const shadow = (n: number) => n * scale;

  return (
    <div
      className={`shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#ffffff",
        border: `${border}px solid ${palette[50]}`,
        boxShadow: flat
          ? `0 ${shadow(2)}px ${shadow(8)}px rgba(0,0,0,0.12)`
          : [
              `${-shadow(8)}px ${-shadow(8)}px ${shadow(18)}px rgba(255,255,255,1)`,
              `${shadow(8)}px ${shadow(10)}px ${shadow(22)}px rgba(${shadowRgb},0.18)`,
              `0 ${shadow(4)}px ${shadow(14)}px rgba(${variant === "blue" ? "163,218,246" : "216,237,228"},0.45)`,
              `inset ${-shadow(7)}px ${-shadow(7)}px ${shadow(16)}px rgba(255,255,255,0.95)`,
              `inset ${shadow(7)}px ${shadow(9)}px ${shadow(16)}px rgba(${insetRgb},0.2)`,
            ].join(", "),
      }}
    >
      <svg width="100%" height="100%" viewBox={`0 0 ${VB} ${VB}`}>
        <defs>
          <radialGradient id={faceGradientId} cx="38%" cy="32%" r="68%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="55%" stopColor={faceMid} />
            <stop offset="100%" stopColor={palette[50]} />
          </radialGradient>
        </defs>
        <circle cx={CX} cy={CY} r={148} fill={`url(#${faceGradientId})`} />
        <circle
          cx={CX}
          cy={CY}
          r={147}
          fill="none"
          stroke={ringStroke}
          strokeWidth={2}
        />

        {MINOR_TICK_ANGLES.map((deg) => {
          const rad = ((deg - 90) * Math.PI) / 180;
          const r1 = 130;
          const r2 = 115;
          return (
            <line
              key={deg}
              x1={CX + r1 * Math.cos(rad)}
              y1={CY + r1 * Math.sin(rad)}
              x2={CX + r2 * Math.cos(rad)}
              y2={CY + r2 * Math.sin(rad)}
              stroke={resolvedTick}
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })}

        {(
          [
            { n: "3", x: 295, y: 168 },
            { n: "6", x: 167, y: 285 },
            { n: "9", x: 55, y: 168 },
            { n: "12", x: 160, y: 65 },
          ] as const
        ).map(({ n, x, y }) => (
          <text
            key={n}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={resolvedNum}
            fontSize={30}
            fontWeight="bold"
            fontFamily="system-ui, sans-serif"
          >
            {n}
          </text>
        ))}

        <g transform={`rotate(${h}, ${CX}, ${CY})`}>
          <line
            x1={CX}
            y1={CY}
            x2={CX}
            y2={CY - 80}
            stroke={resolvedHour}
            strokeWidth={7}
            strokeLinecap="round"
          />
        </g>
        <g transform={`rotate(${m}, ${CX}, ${CY})`}>
          <line
            x1={CX}
            y1={CY}
            x2={CX}
            y2={CY - 90}
            stroke={resolvedMinute}
            strokeWidth={3.5}
            strokeLinecap="round"
          />
        </g>
        <g transform={`rotate(${s}, ${CX}, ${CY})`}>
          <line
            x1={CX}
            y1={CY}
            x2={CX}
            y2={CY - 150}
            stroke={resolvedSecond}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </g>

        <circle cx={CX} cy={CY} r={6} fill={resolvedCenter} />
        <circle cx={CX} cy={CY} r={2.5} fill="#ffffff" />
      </svg>
    </div>
  );
}
