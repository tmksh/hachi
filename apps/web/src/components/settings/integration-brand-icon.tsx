"use client";

import Image from "next/image";
import type { AppIntegrationProvider } from "@/lib/app-integrations/types";
import { cn } from "@/lib/utils";

type IntegrationBrandIconProps = {
  provider: AppIntegrationProvider;
  className?: string;
};

const ICON_SRC: Record<AppIntegrationProvider, string> = {
  chatwork: "/integrations/chatwork.svg",
  slack: "/integrations/slack.svg",
  teams: "/integrations/teams.svg",
  google_chat: "/integrations/google_chat.svg",
  discord: "/integrations/discord.svg",
  line_notify: "/integrations/line_notify.svg",
  line_works: "/integrations/line_works.svg",
  kintone: "/integrations/kintone.svg",
};

const ICON_LABEL: Record<AppIntegrationProvider, string> = {
  chatwork: "Chatwork",
  slack: "Slack",
  teams: "Microsoft Teams",
  google_chat: "Google Chat",
  discord: "Discord",
  line_notify: "LINE Notify",
  line_works: "LINE WORKS",
  kintone: "kintone",
};

export function IntegrationBrandIcon({ provider, className }: IntegrationBrandIconProps) {
  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white",
        className
      )}
    >
      <Image
        src={ICON_SRC[provider]}
        alt={ICON_LABEL[provider]}
        width={36}
        height={36}
        className="h-9 w-9 object-cover"
        unoptimized
      />
    </div>
  );
}
