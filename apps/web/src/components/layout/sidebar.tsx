"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "@/lib/constants";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
}

export function Sidebar({ profile, onSignOut }: SidebarProps) {
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

  return (
    <aside className="fixed left-0 top-0 z-40 hidden md:flex h-screen w-[72px] flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b">
        <Link href="/dashboard" className="flex items-center justify-center">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center transition-transform hover:scale-105">
            <span className="text-primary-foreground font-bold text-base">B</span>
          </div>
        </Link>
      </div>

      {/* Nav Groups */}
      <nav className="flex-1 flex flex-col items-center gap-1 py-3 overflow-y-auto">
        {NAV_GROUPS.map((group) => {
          const Icon = GROUP_ICONS[group.key as keyof typeof GROUP_ICONS];
          const active = isGroupActive(group.key);

          return (
            <Popover
              key={group.key}
              open={openGroup === group.key}
              onOpenChange={(open) => setOpenGroup(open ? group.key : null)}
            >
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "relative flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200",
                    "hover:bg-accent",
                    active && "bg-primary/10 text-primary",
                    !active && "text-muted-foreground",
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
              </PopoverTrigger>
              <PopoverContent
                side="right"
                align="start"
                sideOffset={8}
                className="w-52 p-2"
              >
                <p className="px-2 pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => setOpenGroup(null)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                        isActive(item.href)
                          ? "bg-primary text-primary-foreground font-medium"
                          : "hover:bg-accent text-foreground",
                      )}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="flex flex-col items-center gap-1 pb-3 border-t pt-3">
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

        {/* User menu */}
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
      </div>
    </aside>
  );
}
