import { cn } from "@/lib/utils";

/** BRIDGE Linq キューブマーク（SVG） */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 50"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <g className="brand-cube brand-cube-1">
        <path d="M-0.631592 31.9767L14.5263 39.5349V43.6047L-0.631592 36.0465V31.9767Z" fill="#A8A8A8" />
        <path d="M14.5263 39.5349L29.6842 31.9767V36.0465L14.5263 43.6047V39.5349Z" fill="#787878" />
        <path d="M14.5263 24.4186L29.6842 31.9767L14.5263 39.5349L-0.631592 31.9767L14.5263 24.4186Z" fill="#ECECEC" />
      </g>
      <g className="brand-cube brand-cube-2">
        <path d="M5.05261 22.093L20.2105 29.6512V33.7209L5.05261 26.1628V22.093Z" fill="#A8A8A8" />
        <path d="M20.2105 29.6512L35.3684 22.093V26.1628L20.2105 33.7209V29.6512Z" fill="#787878" />
        <path d="M20.2105 14.5349L35.3684 22.0931L20.2105 29.6512L5.05261 22.0931L20.2105 14.5349Z" fill="#ECECEC" />
      </g>
      <g className="brand-cube brand-cube-3">
        <path d="M10.7368 12.2093L25.8947 19.7674V23.8372L10.7368 16.2791V12.2093Z" fill="#159AA4" />
        <path d="M25.8947 19.7674L41.0526 12.2093V16.2791L25.8947 23.8372V19.7674Z" fill="#0E6F77" />
        <path d="M25.8947 4.65118L41.0526 12.2093L25.8947 19.7675L10.7368 12.2093L25.8947 4.65118Z" fill="#1CC8D4" />
      </g>
    </svg>
  );
}

/**
 * BRIDGE Linq ロゴ（マーク + ワードマーク）
 * ワードマークは Space Grotesk Bold / 0.48px トラッキング。
 * BRIDGE の指定色 #ECECEC は白背景で見えないため、ライトモードのみ
 * キューブと同系のグレー #787878 に落として可読性を確保。
 */
export function BrandLogo({
  className,
  compact = false,
}: {
  className?: string;
  /** 狭いサイドバー向けに一回り小さくする */
  compact?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center", compact ? "gap-1" : "gap-1.5", className)}>
      <BrandMark className={cn("w-auto shrink-0", compact ? "h-8" : "h-9")} />
      <span
        className="font-bold whitespace-nowrap leading-none"
        style={{
          fontFamily: "var(--font-space-grotesk), var(--font-geist-sans), sans-serif",
          fontSize: compact ? "20px" : "24px",
          letterSpacing: compact ? "0.4px" : "0.48px",
        }}
      >
        <span className="text-[#787878] dark:text-[#ECECEC]">BRIDGE</span>
        <span className="text-[#1CC8D4]"> Linq</span>
      </span>
    </span>
  );
}
