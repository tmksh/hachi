"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { BrandLogo, BrandMark } from "@/components/layout/brand-logo";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BarChart3,
  Building2,
  LogOut,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const ADMIN_NAV = [
  { key: "bi", label: "全国加盟店BI", icon: BarChart3 },
  { key: "companies", label: "企業一覧", icon: Building2 },
  { key: "ai", label: "AI設定", icon: Sparkles },
] as const;

type TabKey = (typeof ADMIN_NAV)[number]["key"];

const sidebarActiveStyle = { background: "var(--brand-gradient)" } as const;

export function AdminSidebar({
  expanded,
  onExpandedChange,
}: {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = (searchParams.get("tab") ?? "bi") as TabKey;
  const { user, profile, signOut } = useAuth();

  const goTab = (tab: TabKey) => {
    router.replace(`/admin?tab=${tab}`, { scroll: false });
  };

  const displayName = profile?.display_name?.trim() || "運営管理者";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        style={{ width: expanded ? 196 : 68 }}
        className="fixed left-3 top-3 z-40 hidden md:flex h-[calc(100vh-24px)] flex-col frost-sidebar overflow-hidden rounded-2xl transition-[width] duration-300 ease-out"
      >
        <div
          className={cn(
            "flex shrink-0 items-center gap-2",
            expanded ? "h-14 px-3" : "h-12 justify-center px-1",
          )}
        >
          {expanded ? (
            <button
              type="button"
              onClick={() => onExpandedChange(!expanded)}
              aria-label="BRIDGE Linq"
              className="h-10 flex items-center px-1 transition-transform hover:scale-[1.03] shrink-0 rounded-xl sidebar-nav-hover animate-in fade-in slide-in-from-left-2 duration-150"
            >
              <BrandLogo compact />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onExpandedChange(!expanded)}
              aria-label="BRIDGE Linq"
              className="h-10 w-10 flex items-center justify-center transition-transform hover:scale-105 shrink-0 rounded-xl sidebar-nav-hover"
            >
              <BrandMark className="h-8 w-auto" />
            </button>
          )}
        </div>

        <nav
          className={cn(
            "flex-1 flex flex-col gap-1 min-h-0 overflow-y-auto",
            expanded ? "py-3 px-2" : "py-2 px-1 items-center",
          )}
        >
          {ADMIN_NAV.map(({ key, label, icon: Icon }) => {
            const active = currentTab === key;
            if (expanded) {
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => goTab(key)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left sidebar-nav-hover",
                    active ? "text-white shadow-sm" : "text-muted-foreground",
                  )}
                  style={active ? sidebarActiveStyle : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>
                </button>
              );
            }
            return (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => goTab(key)}
                    aria-label={label}
                    className={cn(
                      "relative flex h-11 w-11 items-center justify-center rounded-xl sidebar-nav-hover",
                      active ? "text-white shadow-sm" : "text-muted-foreground",
                    )}
                    style={active ? sidebarActiveStyle : undefined}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        <div
          className={cn(
            "flex shrink-0 flex-col gap-1",
            expanded ? "py-3 px-2" : "py-2 px-1 items-center",
          )}
        >
          {expanded ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm sidebar-nav-hover">
                  <Avatar className="h-6 w-6 shrink-0 border-2 border-transparent hover:border-primary/20 transition-colors">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                    {displayName}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-56">
                <div className="px-2 py-2">
                  <p className="text-sm font-medium">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{user?.email ?? ""}</p>
                  <p className="text-xs text-primary font-medium mt-0.5">運営管理</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="gap-2 text-destructive">
                  <LogOut className="h-4 w-4" />
                  ログアウト
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex h-11 w-11 items-center justify-center rounded-xl sidebar-nav-hover">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-56">
                <div className="px-2 py-2">
                  <p className="text-sm font-medium">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{user?.email ?? ""}</p>
                  <p className="text-xs text-primary font-medium mt-0.5">運営管理</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="gap-2 text-destructive">
                  <LogOut className="h-4 w-4" />
                  ログアウト
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
