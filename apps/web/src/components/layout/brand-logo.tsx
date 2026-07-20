import { cn } from "@/lib/utils";

/** BRIDGE Linq キューブマーク（SVG） */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 52 46"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <g className="brand-cube brand-cube-1">
        <path d="M7.74467 23L19.9149 29.1707V41.5122L7.74467 35.3415V23Z" fill="#A8A8A8" />
        <path d="M19.9149 29.1707L32.0851 23V35.3415L19.9149 41.5122V29.1707Z" fill="#787878" />
        <path d="M19.9149 16.8293L32.0851 23L19.9149 29.1707L7.74467 23L19.9149 16.8293Z" fill="#ECECEC" />
      </g>
      <g className="brand-cube brand-cube-2">
        <path d="M15.4894 15.7073L27.6596 21.8781V34.2195L15.4894 28.0488V15.7073Z" fill="#A8A8A8" />
        <path d="M27.6596 21.8781L39.8298 15.7073V28.0488L27.6596 34.2195V21.8781Z" fill="#787878" />
        <path d="M27.6596 9.53656L39.8298 15.7073L27.6596 21.878L15.4894 15.7073L27.6596 9.53656Z" fill="#ECECEC" />
      </g>
      <g className="brand-cube brand-cube-3">
        <path d="M23.234 8.41461L35.4043 14.5853V26.9268L23.234 20.7561V8.41461Z" fill="#159AA4" />
        <path d="M35.4043 14.5853L47.5745 8.41461V20.7561L35.4043 26.9268V14.5853Z" fill="#0E6F77" />
        <path d="M35.4043 2.2439L47.5745 8.41463L35.4043 14.5854L23.234 8.41463L35.4043 2.2439Z" fill="#1CC8D4" />
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
export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <BrandMark className="h-9 w-auto shrink-0" />
      <span
        className="font-bold whitespace-nowrap leading-none"
        style={{
          fontFamily: "var(--font-space-grotesk), var(--font-geist-sans), sans-serif",
          fontSize: "24px",
          letterSpacing: "0.48px",
        }}
      >
        <span className="text-[#787878] dark:text-[#ECECEC]">BRIDGE</span>
        <span className="text-[#1CC8D4]"> Linq</span>
      </span>
    </span>
  );
}
