"use client";

import { useState, useEffect, useId } from "react";
import { useBrandColor } from "@/hooks/use-brand-color";
import { computeBrandFromHex } from "@/lib/brand-color";

interface AnalogClockProps {
  size?: number;
  className?: string;
  flat?: boolean;
}

const VB = 350;
const CX = VB / 2;
const CY = VB / 2;
const MINOR_TICK_ANGLES = [30, 60, 120, 150, 210, 240, 300, 330];

function hexToRgbStr(hex: string): string {
  const h = hex.replace("#", "");
  return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`;
}

export function AnalogClock({ size = 88, className = "", flat = false }: AnalogClockProps) {
  const { hex } = useBrandColor();
  const { light, dark, accent, mid } = computeBrandFromHex(hex);

  const shadowRgb = hexToRgbStr(dark);
  const insetRgb  = hexToRgbStr(mid);

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

  const scale  = size / VB;
  const border = 14 * scale;
  const sh     = (n: number) => n * scale;

  return (
    <div
      className={`shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#ffffff",
        border: `${border}px solid ${accent}`,
        boxShadow: flat
          ? `0 ${sh(2)}px ${sh(8)}px rgba(0,0,0,0.12)`
          : [
              `${-sh(8)}px ${-sh(8)}px ${sh(18)}px rgba(255,255,255,1)`,
              `${sh(8)}px ${sh(10)}px ${sh(22)}px rgba(${shadowRgb},0.18)`,
              `0 ${sh(4)}px ${sh(14)}px rgba(${hexToRgbStr(accent)},0.45)`,
              `inset ${-sh(7)}px ${-sh(7)}px ${sh(16)}px rgba(255,255,255,0.95)`,
              `inset ${sh(7)}px ${sh(9)}px ${sh(16)}px rgba(${insetRgb},0.2)`,
            ].join(", "),
      }}
    >
      <svg width="100%" height="100%" viewBox={`0 0 ${VB} ${VB}`}>
        <defs>
          <radialGradient id={faceGradientId} cx="38%" cy="32%" r="68%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="55%" stopColor={accent} />
            <stop offset="100%" stopColor={accent} />
          </radialGradient>
        </defs>
        <circle cx={CX} cy={CY} r={148} fill={`url(#${faceGradientId})`} />
        <circle cx={CX} cy={CY} r={147} fill="none" stroke={`rgba(${hexToRgbStr(mid)},0.55)`} strokeWidth={2} />

        {MINOR_TICK_ANGLES.map((deg) => {
          const rad = ((deg - 90) * Math.PI) / 180;
          return (
            <line
              key={deg}
              x1={CX + 130 * Math.cos(rad)} y1={CY + 130 * Math.sin(rad)}
              x2={CX + 115 * Math.cos(rad)} y2={CY + 115 * Math.sin(rad)}
              stroke={mid} strokeWidth={2} strokeLinecap="round"
            />
          );
        })}

        {([ { n: "3", x: 295, y: 168 }, { n: "6", x: 167, y: 285 }, { n: "9", x: 55, y: 168 }, { n: "12", x: 160, y: 65 } ] as const).map(({ n, x, y }) => (
          <text key={n} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            fill={light} fontSize={30} fontWeight="bold" fontFamily="system-ui, sans-serif">
            {n}
          </text>
        ))}

        {/* 時針 */}
        <g transform={`rotate(${h}, ${CX}, ${CY})`}>
          <line x1={CX} y1={CY} x2={CX} y2={CY - 80} stroke={dark} strokeWidth={7} strokeLinecap="round" />
        </g>
        {/* 分針 */}
        <g transform={`rotate(${m}, ${CX}, ${CY})`}>
          <line x1={CX} y1={CY} x2={CX} y2={CY - 90} stroke={light} strokeWidth={3.5} strokeLinecap="round" />
        </g>
        {/* 秒針 */}
        <g transform={`rotate(${s}, ${CX}, ${CY})`}>
          <line x1={CX} y1={CY} x2={CX} y2={CY - 150} stroke={mid} strokeWidth={1.5} strokeLinecap="round" />
        </g>

        <circle cx={CX} cy={CY} r={6} fill={dark} />
        <circle cx={CX} cy={CY} r={2.5} fill="#ffffff" />
      </svg>
    </div>
  );
}
