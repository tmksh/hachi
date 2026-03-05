"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "@/lib/constants";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  LayoutDashboard,
  Users,
  Factory,
  Briefcase,
  Megaphone,
  Search,
  Bell,
  LogOut,
  Settings,
  User,
  ChevronRight,
} from "lucide-react";
import type { Profile } from "@/hooks/use-auth";

const GROUP_ICONS = {
  dashboard: LayoutDashboard,
  lead: Users,
  production: Factory,
  portal: Briefcase,
  marketing: Megaphone,
} as const;

interface SidebarProps {
  profile: Profile | null;
  onSignOut: () => void;
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
}

export function Sidebar({ profile, onSignOut, expanded, onExpandedChange }: SidebarProps) {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const isGroupActive = (groupKey: string) => {
    const group = NAV_GROUPS.find((g) => g.key === groupKey);
    return group?.items.some((item) => isActive(item.href)) ?? false;
  };

  const toggleGroup = (key: string) => {
    setOpenGroup((prev) => (prev === key ? null : key));
  };

  return (
    <TooltipProvider delayDuration={300}>
      <motion.aside
        animate={{ width: expanded ? 220 : 68 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed left-3 top-3 z-40 hidden md:flex h-[calc(100vh-24px)] flex-col frost-sidebar overflow-hidden rounded-2xl"
      >
        {/* Logo — クリックでサイドバー開閉 */}
        <div className="flex h-16 items-center px-3 gap-2 mb-1">
          <button
            onClick={() => onExpandedChange(!expanded)}
            className="h-10 w-10 flex items-center justify-center transition-transform hover:scale-105 shrink-0 rounded-xl hover:bg-white/20"
          >
            <Image src="/logo.png" alt="BRIDGE" width={40} height={34} className="object-contain w-8 h-auto" />
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="text-sm font-semibold text-foreground whitespace-nowrap overflow-hidden"
              >
                BRIDGE
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Nav Groups */}
        <nav className="flex-1 flex flex-col gap-0.5 py-3 overflow-y-auto px-2">
          {NAV_GROUPS.map((group) => {
            const Icon = GROUP_ICONS[group.key as keyof typeof GROUP_ICONS];
            const active = isGroupActive(group.key);
            const isOpen = openGroup === group.key;

            return (
              <div key={group.key}>
                {expanded ? (
                  /* 展開時: グループヘッダー + サブ項目 */
                  <div>
                    <button
                      onClick={() => toggleGroup(group.key)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium",
                        "hover:bg-accent/60",
                        active ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      <span className="shrink-0 relative">
                        {Icon && <Icon className="h-5 w-5" />}
                        {active && (
                          <motion.div
                            layoutId="sidebar-active"
                            className="absolute -left-[14px] top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-primary"
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          />
                        )}
                      </span>
                      <span className="flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">
                        {group.label}
                      </span>
                      <ChevronRight
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                          isOpen && "rotate-90"
                        )}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="pl-10 pr-1 pb-1 flex flex-col gap-0.5">
                            {group.items.map((item) => (
                              <Link
                                key={item.key}
                                href={item.href}
                                className={cn(
                                  "flex items-center px-3 py-1.5 rounded-lg text-sm transition-all duration-200 whitespace-nowrap overflow-hidden text-ellipsis",
                                  isActive(item.href)
                                    ? "bg-primary text-primary-foreground font-medium shadow-sm"
                                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                                )}
                              >
                                {item.label}
                              </Link>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  /* 折りたたみ時: アイコンのみ + ホバーでメニュー表示 */
                  <HoverCard openDelay={200} closeDelay={100}>
                    <HoverCardTrigger asChild>
                      <button
                        className={cn(
                          "relative flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200",
                          "hover:bg-accent/60",
                          active ? "bg-primary/10 text-primary" : "text-muted-foreground"
                        )}
                      >
                        {Icon && <Icon className="h-5 w-5" />}
                        {active && (
                          <motion.div
                            layoutId="sidebar-active"
                            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[2px] w-1 h-5 rounded-r-full bg-primary"
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          />
                        )}
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent side="right" align="start" sideOffset={8} className="w-52 p-2">
                      <p className="px-2 pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {group.label}
                      </p>
                      <div className="space-y-0.5">
                        {group.items.map((item) => (
                          <Link
                            key={item.key}
                            href={item.href}
                            className={cn(
                              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors block",
                              isActive(item.href)
                                ? "bg-primary text-primary-foreground font-medium"
                                : "hover:bg-accent text-foreground"
                            )}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="flex flex-col gap-0.5 pb-3 pt-3 px-2">
          {expanded ? (
            <>
              <button className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <Search className="h-5 w-5 shrink-0" />
                <span className="whitespace-nowrap">検索</span>
              </button>
              <button className="relative flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <Bell className="h-5 w-5 shrink-0" />
                <span className="whitespace-nowrap">通知</span>
                <span className="absolute top-2.5 left-[30px] h-2 w-2 rounded-full bg-destructive" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm hover:bg-accent transition-colors">
                    <Avatar className="h-6 w-6 shrink-0 border-2 border-transparent hover:border-primary/20 transition-colors">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {profile?.display_name?.charAt(0) ?? "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                      {profile?.display_name ?? "ユーザー"}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="end" className="w-56">
                  <div className="px-2 py-2">
                    <p className="text-sm font-medium">{profile?.display_name ?? "ユーザー"}</p>
                    <p className="text-xs text-muted-foreground">{profile?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="gap-2">
                      <User className="h-4 w-4" />
                      プロフィール
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="gap-2">
                      <Settings className="h-4 w-4" />
                      設定
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onSignOut} className="gap-2 text-destructive">
                    <LogOut className="h-4 w-4" />
                    ログアウト
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent transition-colors">
                    <Search className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">検索</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="relative flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent transition-colors">
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">通知</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex h-11 w-11 items-center justify-center">
                        <Avatar className="h-8 w-8 border-2 border-transparent hover:border-primary/20 transition-colors">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                            {profile?.display_name?.charAt(0) ?? "U"}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="end" className="w-56">
                      <div className="px-2 py-2">
                        <p className="text-sm font-medium">{profile?.display_name ?? "ユーザー"}</p>
                        <p className="text-xs text-muted-foreground">{profile?.email}</p>
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/settings" className="gap-2">
                          <User className="h-4 w-4" />
                          プロフィール
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/settings" className="gap-2">
                          <Settings className="h-4 w-4" />
                          設定
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onSignOut} className="gap-2 text-destructive">
                        <LogOut className="h-4 w-4" />
                        ログアウト
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TooltipTrigger>
                <TooltipContent side="right">アカウント</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </motion.aside>

    </TooltipProvider>
  );
}
