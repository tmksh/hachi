import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

type IconProps = { className?: string };

/** LINE 公式カラー */
export function LinePlatformIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn("shrink-0", className)} aria-hidden>
      <path
        fill="#06C755"
        d="M12 2C6.48 2 2 5.58 2 10.02c0 3.98 3.53 7.32 8.3 7.96.64.14 1.52.43 1.74.99.2.52.13 1.33.06 1.86l-.1.62c-.03.18-.13.71.58.39 1.14-.48 6.14-3.6 8.38-6.17C21.95 13.5 22 11.77 22 10.02 22 5.58 17.52 2 12 2z"
      />
      <path
        fill="#fff"
        d="M10.1 8.5h-1.1c-.2 0-.36.16-.36.36v4.28c0 .2.16.36.36.36h1.1c.2 0 .36-.16.36-.36V8.86c0-.2-.16-.36-.36-.36zm2.55 0h-1.1c-.2 0-.36.16-.36.36v4.28c0 .2.16.36.36.36h1.1c.2 0 .36-.16.36-.36V8.86c0-.2-.16-.36-.36-.36zm2.55 0H14.1c-.2 0-.36.16-.36.36v2.95l-1.48-2.01a.36.36 0 0 0-.29-.15h-.95c-.2 0-.36.16-.36.36v4.28c0 .2.16.36.36.36h1.1c.2 0 .36-.16.36-.36v-2.95l1.48 2.01c.06.08.15.15.29.15h.95c.2 0 .36-.16.36-.36V8.86c0-.2-.16-.36-.36-.36z"
      />
    </svg>
  );
}

/** Slack 4色ロゴ */
export function SlackPlatformIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn("shrink-0", className)} aria-hidden>
      <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" />
      <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" />
      <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" />
      <path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  );
}

/** Gmail ロゴ */
export function GmailPlatformIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn("shrink-0", className)} aria-hidden>
      <path fill="#EA4335" d="M5.05 20.5h13.9A2.55 2.55 0 0 0 21.5 17.95V8.5l-9.5 5.9-9.5-5.9v9.45A2.55 2.55 0 0 0 5.05 20.5z" />
      <path fill="#34A853" d="M21.5 6.05v2.45l-9.5 5.9-9.5-5.9V6.05A2.55 2.55 0 0 1 5.05 3.5h13.9A2.55 2.55 0 0 1 21.5 6.05z" />
      <path fill="#FBBC04" d="M12 14.85 21.5 8.95V6.05L12 11.95 2.5 6.05v2.9L12 14.85z" />
      <path fill="#4285F4" d="M5.05 3.5A2.55 2.55 0 0 0 2.5 6.05v2.45l9.5 5.9 9.5-5.9V6.05A2.55 2.55 0 0 0 18.95 3.5H5.05z" />
    </svg>
  );
}

export type MessagingPlatform = "line" | "slack" | "email";

export const MESSAGING_PLATFORMS: {
  key: MessagingPlatform;
  label: string;
  Icon: ComponentType<IconProps>;
  headerBg: string;
  bubbleIn: string;
  bubbleOut: string;
}[] = [
  {
    key: "line",
    label: "LINE",
    Icon: LinePlatformIcon,
    headerBg: "bg-[#06C755]/10 border-[#06C755]/20",
    bubbleIn: "bg-white dark:bg-[#1F2937] border border-border/40",
    bubbleOut: "bg-[#06C755] text-white",
  },
  {
    key: "slack",
    label: "Slack",
    Icon: SlackPlatformIcon,
    headerBg: "bg-[#611F69]/8 border-[#611F69]/15",
    bubbleIn: "bg-white dark:bg-[#1F2937] border border-border/40",
    bubbleOut: "bg-[#611F69] text-white",
  },
  {
    key: "email",
    label: "メール",
    Icon: GmailPlatformIcon,
    headerBg: "bg-blue-50/80 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30",
    bubbleIn: "bg-white dark:bg-[#1F2937] border border-border/40",
    bubbleOut: "bg-blue-600 text-white",
  },
];
