"use client";

import { useState, useEffect, useMemo, memo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createNavigationIntent } from "@/lib/navigation-intent";
import { prefetchRouteData } from "@/lib/nav-prefetch";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "@/lib/constants";
import type { Profile } from "@/hooks/use-auth";
import { useCompanyPermissions } from "@/hooks/use-company-permissions";
import { permissionRoleSlugs } from "@/lib/role-assignment";
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const { canAccess } = useCompanyPermissions();

  const navIntent = useMemo(() => createNavigationIntent((href) => {
    router.prefetch(href);
    prefetchRouteData(queryClient, href);
  }), [router, queryClient]);
  useEffect(() => () => navIntent.cancel(), [navIntent]);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const isGroupActive = (groupKey: string) => {
    const group = NAV_GROUPS.find((g) => g.key === groupKey);
    return group?.items.some((item) => isActive(item.href)) ?? false;
  };

  const visibleGroups = useMemo(
    () =>
      NAV_GROUPS
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) => !profile?.role || canAccess(item.key, permissionRoleSlugs(profile)),
          ),
        }))
        .filter((group) => group.items.length > 0),
    [profile, canAccess],
  );

  return (
    <>
      {openGroup && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden animate-in fade-in duration-150"
          onClick={() => setOpenGroup(null)}
        />
      )}

      {openGroup && (
        <div className="fixed bottom-20 left-4 right-4 z-50 md:hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
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
                    prefetch={false}
                    onMouseEnter={() => navIntent.schedule(item.href)}
                    onMouseLeave={navIntent.cancel}
                    onFocus={() => navIntent.now(item.href)}
                    onTouchStart={() => navIntent.now(item.href)}
                    onClick={() => setOpenGroup(null)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors",
                      isActive(item.href)
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                ),
              )}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-4 left-4 right-4 z-50 md:hidden">
        <div className="frost-sidebar rounded-2xl px-2 py-2 shadow-lg">
          <div className="flex items-center justify-around">
            {visibleGroups.map((group) => {
              const Icon = GROUP_ICONS[group.key as keyof typeof GROUP_ICONS];
              const active = isGroupActive(group.key);
              return (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => {
                    const next = openGroup === group.key ? null : group.key;
                    setOpenGroup(next);
                  }}
                  className={cn(
                    "relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {Icon && <Icon className="h-5 w-5" />}
                  <span className="text-[10px] font-medium">{group.label}</span>
                  {active && (
                    <div className="absolute -bottom-0.5 w-5 h-0.5 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
});
