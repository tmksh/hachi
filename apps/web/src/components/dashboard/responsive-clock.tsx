"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";

const AnalogClock = dynamic(
  () => import("@/components/shared/analog-clock").then((m) => m.AnalogClock),
  { ssr: false },
);

export function ResponsiveClock({ flat = false }: { flat?: boolean } = {}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState(76);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      const next = Math.max(48, Math.min(220, Math.floor(Math.min(rect.width, rect.height))));
      setSize((prev) => (prev === next ? prev : next));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={wrapperRef} className="w-full h-full flex items-center justify-center">
      <AnalogClock size={size} flat={flat} />
    </div>
  );
}
