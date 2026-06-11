"use client";

import { useState, useMemo, memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, canAccessNavItem } from "@/lib/constants";
import type { Profile } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  Users,
  Factory,
  Briefcase,
  Megaphone,
} from "lucide-react";

const GROUP_ICONS = {
  dashboard: LayoutDashboard,
  lead: Users,
  production: Factory,
  portal: Briefcase,
  marketing: Megaphone,
} as const;

export const MobileNav = memo(function MobileNav({ profile }: { profile: Profile | null }) {
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

  /** ロールでフィルタされたナビグループ */
  const visibleGroups = useMemo(
    () =>
      NAV_GROUPS
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) => !profile?.role || canAccessNavItem(item.key, profile.role),
          ),
        }))
        .filter((group) => group.items.length > 0),
    [profile?.role],
  );

  return (
    <>
      {/* Overlay */}
      <AnimatePresence>
        {openGroup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
            onClick={() => setOpenGroup(null)}
          />
        )}
      </AnimatePresence>

      {/* Sub-menu popup */}
      <AnimatePresence>
        {openGroup && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-20 left-4 right-4 z-50 md:hidden"
          >
            <div className="bg-white dark:bg-[#1a1f2e] rounded-2xl p-3 shadow-2xl border border-border/60">
              <p className="px-2 pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {visibleGroups.find((g) => g.key === openGroup)?.label}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {visibleGroups.find((g) => g.key === openGroup)?.items.map(
                  (item) => (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => setOpenGroup(null)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors",
                        isActive(item.href)
                          ? "bg-primary text-primary-foreground font-medium"
                          : "hover:bg-accent",
                      )}
                    >
                      {item.label}
                    </Link>
                  ),
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden pb-safe bg-white/95 dark:bg-[#0f1117]/95 backdrop-blur-md border-t border-border/60">
        <div className="flex items-center justify-around h-16 px-2">
            {visibleGroups.map((group) => {
              const Icon = GROUP_ICONS[group.key as keyof typeof GROUP_ICONS];
              const active = isGroupActive(group.key);

              return (
                <button
                  key={group.key}
                  onClick={() =>
                    setOpenGroup(openGroup === group.key ? null : group.key)
                  }
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 w-14 h-12 rounded-xl transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {Icon && <Icon className="h-5 w-5" />}
                  <span className="text-[10px] font-medium">{group.label}</span>
                  {active && (
                    <motion.div
                      layoutId="mobile-active"
                      className="absolute -bottom-0.5 w-5 h-0.5 rounded-full bg-primary"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
      </nav>
    </>
  );
});
