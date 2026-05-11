"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
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
  ShieldCheck,
  LogOut,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const ADMIN_NAV = [
  { key: "bi", label: "全国加盟店BI", icon: BarChart3 },
  { key: "companies", label: "企業一覧", icon: Building2 },
] as const;

type TabKey = (typeof ADMIN_NAV)[number]["key"];

export function AdminSidebar() {
  const [expanded, setExpanded] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = (searchParams.get("tab") ?? "bi") as TabKey;
  const { user, signOut } = useAuth();

  const goTab = (tab: TabKey) => {
    router.replace(`/admin?tab=${tab}`, { scroll: false });
  };

  const initial = user?.email?.charAt(0).toUpperCase() ?? "A";

  return (
    <TooltipProvider delayDuration={300}>
      <motion.aside
        animate={{ width: expanded ? 220 : 68 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed left-3 top-3 z-40 hidden md:flex h-[calc(100vh-24px)] flex-col frost-sidebar overflow-hidden rounded-2xl"
      >
        {/* Logo */}
        <div className="flex h-16 items-center px-3 gap-2 mb-1">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="h-10 w-10 flex items-center justify-center transition-transform hover:scale-105 shrink-0 rounded-xl hover:bg-white/20"
          >
            <Image src="/logo.png" alt="BRIDGE" width={40} height={34} className="object-contain w-8 h-auto" />
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col leading-tight overflow-hidden"
              >
                <span className="text-sm font-semibold text-foreground whitespace-nowrap">BRIDGE</span>
                <span className="text-[10px] text-amber-600 font-medium whitespace-nowrap flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> 運営管理
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-0.5 py-3 overflow-y-auto px-2">
          {ADMIN_NAV.map(({ key, label, icon: Icon }) => {
            const active = currentTab === key;
            if (expanded) {
              return (
                <button
                  key={key}
                  onClick={() => goTab(key)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium text-left",
                    "hover:bg-accent/60",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <span className="shrink-0 relative">
                    <Icon className="h-5 w-5" />
                    {active && (
                      <motion.div
                        layoutId="admin-sidebar-active"
                        className="absolute -left-[14px] top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-primary"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                  </span>
                  <span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>
                </button>
              );
            }
            return (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => goTab(key)}
                    className={cn(
                      "relative flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200",
                      "hover:bg-accent/60",
                      active ? "bg-primary/10 text-primary" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {active && (
                      <motion.div
                        layoutId="admin-sidebar-active"
                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[2px] w-1 h-5 rounded-r-full bg-primary"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="flex flex-col gap-0.5 pb-3 pt-3 px-2">
          {expanded ? (
            <>
              <Link
                href="/dashboard"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">通常画面に戻る</span>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 hover:bg-accent/60 mt-1">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-amber-100 text-amber-700 text-xs font-semibold">
                        {initial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start text-left overflow-hidden">
                      <span className="text-xs font-medium text-foreground whitespace-nowrap truncate w-[140px]">
                        運営管理者
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap truncate w-[140px]">
                        {user?.email ?? ""}
                      </span>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-52">
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard">
                      <ArrowLeft className="h-4 w-4 mr-2" />通常画面に戻る
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="h-4 w-4 mr-2" />ログアウト
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/dashboard"
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-all"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">通常画面に戻る</TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-accent/60 transition-all">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-amber-100 text-amber-700 text-xs font-semibold">
                        {initial}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="end" className="w-52">
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard">
                      <ArrowLeft className="h-4 w-4 mr-2" />通常画面に戻る
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="h-4 w-4 mr-2" />ログアウト
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}
