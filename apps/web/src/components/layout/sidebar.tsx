"use client";

import { useState, useEffect, useMemo, memo, useRef } from "react";
import Link from "next/link";
import { BrandLogo, BrandMark } from "@/components/layout/brand-logo";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchRouteData } from "@/lib/nav-prefetch";
import { TEAL_TITLE } from "@/lib/teal-theme";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, ROLE_LABELS } from "@/lib/constants";
import { useCompanyPermissions } from "@/hooks/use-company-permissions";
import { permissionRoleSlugs, roleDisplayLabel } from "@/lib/role-assignment";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  Link2,
  ChevronRight,
  FileText,
  CalendarDays,
  MessageCircle,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Profile } from "@/hooks/use-auth";
import { markAnnouncementAsRead, markAnnouncementsAsRead } from "@/lib/actions/notifications";
import { fetchNotifications, type Notification } from "@/lib/queries/notifications";
import { BombAlert } from "@/components/layout/bomb-alert";

/** 緊急回覧: 未読1件で BombAlert（仕様どおり）。チャット未読では出さない。 */
const ANNOUNCEMENT_BOMB_THRESHOLD = 1;
const BOMB_ACK_KEY = "hachi_bomb_acked_ids";
import { globalSearch, type SearchResult } from "@/lib/actions/search";
import { getUnreadMessageCount } from "@/lib/actions/internal-messages";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

const DISMISSED_NOTIFS_KEY = "hachi_dismissed_notifs";

function readDismissedNotifIds(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISSED_NOTIFS_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function persistDismissedNotifIds(ids: string[]) {
  localStorage.setItem(DISMISSED_NOTIFS_KEY, JSON.stringify([...new Set(ids)].slice(-400)));
}

/** 既読・削除した通知は種別を問わず再表示しない（④ No.15） */
function filterDismissedNotifications(notifs: Notification[]): Notification[] {
  const dismissed = readDismissedNotifIds();
  if (dismissed.length === 0) return notifs;
  return notifs.filter((n) => !dismissed.includes(n.id));
}

function dismissNotificationIds(ids: string[]) {
  persistDismissedNotifIds([...readDismissedNotifIds(), ...ids]);
}

function readAckedBombIds(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(BOMB_ACK_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function persistAckedBombIds(ids: string[]) {
  const next = [...new Set([...readAckedBombIds(), ...ids])].slice(-400);
  localStorage.setItem(BOMB_ACK_KEY, JSON.stringify(next));
}

function urgentForBomb(notifs: Notification[]): Notification[] {
  return notifs.filter((n) => n.is_urgent && n.type === "announcement");
}

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
  onInternalChatOpen?: () => void;
}

export const Sidebar = memo(function Sidebar({ profile, onSignOut, expanded, onExpandedChange, onInternalChatOpen }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const prefetchNav = (href: string) => {
    router.prefetch(href);
    prefetchRouteData(queryClient, href);
  };
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  /** 折りたたみ時: 選択中グループの詳細メニュー */
  const [flyoutGroup, setFlyoutGroup] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    setFlyoutGroup(null);
  }, [pathname]);

  // 他画面から通知パネルを開く（互換イベント）
  useEffect(() => {
    const open = () => setNotifOpen(true);
    window.addEventListener("bridge:open-notifications", open);
    return () => window.removeEventListener("bridge:open-notifications", open);
  }, []);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [showBombAlert, setShowBombAlert] = useState(false);
  const [bombUrgentCount, setBombUrgentCount] = useState(0);
  const [bombUrgentItems, setBombUrgentItems] = useState<Notification[]>([]);
  const bombChecked = useRef(false);
  const skipNotifRefetch = useRef(false);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const count = await getUnreadMessageCount();
        setChatUnreadCount((prev) => (prev === count ? prev : count));
      } catch {}
    };

    let chatTimer: ReturnType<typeof setInterval> | undefined;

    const startPolling = () => {
      void fetchUnread();
      chatTimer = setInterval(fetchUnread, 60_000);
    };

    const stopPolling = () => {
      if (chatTimer) clearInterval(chatTimer);
      chatTimer = undefined;
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        stopPolling();
        startPolling();
      } else {
        stopPolling();
      }
    };

    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const start = () => {
      startPolling();
      document.addEventListener("visibilitychange", onVisibility);
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(start, { timeout: 3000 });
    } else {
      timeoutId = setTimeout(start, 500);
    }

    return () => {
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisibility);
      stopPolling();
    };
  }, []);

  // ログイン時の爆弾チェック。同じ緊急回覧は1回だけ表示し、新着があれば同日でも再表示する。
  // 初期遷移と競合しないよう遅延実行
  useEffect(() => {
    if (bombChecked.current) return;
    bombChecked.current = true;

    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      fetchNotifications().then((notifs) => {
        const filtered = filterDismissedNotifications(notifs);
        setNotifications(filtered);
        const acked = new Set(readAckedBombIds());
        const unseen = urgentForBomb(filtered).filter((n) => !acked.has(n.id));
        if (unseen.length >= ANNOUNCEMENT_BOMB_THRESHOLD) {
          try {
            persistAckedBombIds(unseen.map((n) => n.id));
          } catch { /* ignore */ }
          setBombUrgentItems(unseen);
          setBombUrgentCount(unseen.length);
          setShowBombAlert(true);
        }
      }).catch(() => {});
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(run, { timeout: 8000 });
    } else {
      timeoutId = setTimeout(run, 4000);
    }

    return () => {
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!notifOpen) return;
    if (skipNotifRefetch.current) {
      skipNotifRefetch.current = false;
      return;
    }
    const fetchNotifs = () =>
      fetchNotifications()
        .then((notifs) => setNotifications(filterDismissedNotifications(notifs)))
        .catch(() => {});
    void fetchNotifs();
    const timer = setInterval(fetchNotifs, 60_000);
    return () => clearInterval(timer);
  }, [notifOpen]);

  // デバウンスグローバル検索
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(() => {
      setSearchLoading(true);
      globalSearch(searchQuery)
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const unreadCount = notifications.length;

  const acknowledgeBombAndOpenPanel = () => {
    const items = bombUrgentItems;
    const ids = items.map((n) => n.id);
    try {
      if (ids.length) {
        persistAckedBombIds(ids);
        dismissNotificationIds(ids);
      }
    } catch { /* ignore */ }
    const annIds = items
      .filter((n) => n.type === "announcement")
      .map((n) => n.id.replace("ann_", ""));
    if (annIds.length) {
      void markAnnouncementsAsRead(annIds).catch(() => {});
    }
    skipNotifRefetch.current = true;
    setNotifications(items);
    setShowBombAlert(false);
    setNotifOpen(true);
  };

  const useBlueSidebar = false;

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname.startsWith("/dashboard2");
    }
    return pathname.startsWith(href);
  };

  const isGroupActive = (groupKey: string) => {
    const group = NAV_GROUPS.find((g) => g.key === groupKey);
    return group?.items.some((item) => isActive(item.href)) ?? false;
  };

  const { canAccess, customRoles } = useCompanyPermissions();
  const profileRoleLabel = roleDisplayLabel(profile?.role, profile?.custom_role_id, customRoles);

  /** 権限マトリクスでフィルタされたナビグループ（正本は会社の role_permissions） */
  const visibleGroups = useMemo(
    () =>
      NAV_GROUPS
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            if (!profile?.role) return true;
            return canAccess(item.key, permissionRoleSlugs(profile));
          }),
        }))
        .filter((group) => group.items.length > 0),
    [profile, canAccess],
  );

  const toggleGroup = (key: string) => {
    setOpenGroup((prev) => {
      const next = prev === key ? null : key;
      if (next) {
        const group = visibleGroups.find((g) => g.key === next);
        group?.items.forEach((item) => prefetchNav(item.href));
      }
      return next;
    });
  };

  const sidebarActiveItem = "text-white font-medium shadow-sm";
  const sidebarActiveSubItem = "text-white font-medium shadow-sm";
  const sidebarActiveIndicator = "hidden";
  // CSS 変数参照にすることで全インスタンス即時反映
  const sidebarActiveStyle = { background: "var(--brand-gradient)" } as const;
  const groupActiveText = `${TEAL_TITLE} dark:text-[#D8EDE4]`;

  return (
    <>
      <aside
        style={{ width: expanded ? 196 : 68 }}
        className={cn(
          "fixed left-3 top-3 z-40 hidden md:flex h-[calc(100vh-24px)] flex-col frost-sidebar overflow-hidden rounded-2xl transition-[width] duration-300 ease-out",
          false && "sidebar-theme-blue",
        )}
      >
        {/* Logo — クリックでサイドバー開閉 */}
        <div
          className={cn(
            "flex shrink-0 items-center gap-2",
            expanded ? "h-14 px-3" : "h-12 justify-center px-1",
          )}
        >
          {expanded ? (
            <button
              onClick={() => onExpandedChange(!expanded)}
              aria-label="BRIDGE Linq"
              className="h-10 flex items-center px-1 transition-transform hover:scale-[1.03] shrink-0 rounded-xl sidebar-nav-hover animate-in fade-in slide-in-from-left-2 duration-150"
            >
              <BrandLogo compact />
            </button>
          ) : (
            <button
              onClick={() => onExpandedChange(!expanded)}
              aria-label="BRIDGE Linq"
              className="h-10 w-10 flex items-center justify-center transition-transform hover:scale-105 shrink-0 rounded-xl sidebar-nav-hover"
            >
              <BrandMark className="h-8 w-auto" />
            </button>
          )}
        </div>

        {/* Nav Groups */}
        <nav
          className={cn(
            "flex-1 flex flex-col gap-1 min-h-0 overflow-y-auto",
            expanded ? "py-3 px-2" : "py-2 px-1 items-center",
            false && "text-slate-800",
          )}
        >
          {visibleGroups.map((group) => {
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
                        "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium sidebar-nav-hover",
                        active && groupActiveText,
                      )}
                    >
                      <span className="shrink-0 relative">
                        {Icon && <Icon className="h-5 w-5" />}
                        {active && (
                          <div
                            className={cn(
                              "absolute -left-[14px] top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full",
                              sidebarActiveIndicator,
                            )}
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
                    {isOpen && (
                        <div className="overflow-hidden animate-in fade-in duration-200">
                          <div className="pl-10 pr-1 pb-1 flex flex-col gap-0.5">
                            {group.items.map((item) => (
                              <Link
                                key={item.key}
                                href={item.href}
                                prefetch
                                onMouseEnter={() => prefetchNav(item.href)}
                                onFocus={() => prefetchNav(item.href)}
                                className={cn(
                                  "flex items-center px-3 py-1.5 rounded-lg text-sm whitespace-nowrap overflow-hidden text-ellipsis sidebar-nav-hover",
                                  isActive(item.href)
                                    ? sidebarActiveSubItem
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                                style={isActive(item.href) ? sidebarActiveStyle : undefined}
                              >
                                {item.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                ) : active ? (
                  /* 折りたたみ＋選択中: 再クリックで詳細メニュー */
                  <Popover
                    open={flyoutGroup === group.key}
                    onOpenChange={(open) => setFlyoutGroup(open ? group.key : null)}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label={group.label}
                        className={cn(
                          "relative flex h-11 w-11 items-center justify-center rounded-xl sidebar-nav-hover",
                          sidebarActiveItem,
                        )}
                        style={sidebarActiveStyle}
                      >
                        {Icon && <Icon className="h-5 w-5" />}
                        <div
                          className={cn(
                            "absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[2px] w-1 h-5 rounded-r-full",
                            sidebarActiveIndicator,
                          )}
                        />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="right" align="start" sideOffset={8} className="w-52 p-2">
                      <p className="px-2 pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {group.label}
                      </p>
                      <div className="space-y-0.5">
                        {group.items.map((item) => (
                          <Link
                            key={item.key}
                            href={item.href}
                            prefetch
                            onMouseEnter={() => prefetchNav(item.href)}
                            onFocus={() => prefetchNav(item.href)}
                            onClick={() => setFlyoutGroup(null)}
                            className={cn(
                              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors block sidebar-nav-hover",
                              isActive(item.href) ? sidebarActiveSubItem : "text-foreground",
                            )}
                            style={isActive(item.href) ? sidebarActiveStyle : undefined}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  /* 折りたたみ＋未選択: 先頭ページへ遷移のみ */
                  <Link
                    href={group.items[0]?.href ?? "#"}
                    prefetch
                    onMouseEnter={() => group.items[0] && prefetchNav(group.items[0].href)}
                    aria-label={group.label}
                    className="relative flex h-11 w-11 items-center justify-center rounded-xl sidebar-nav-hover text-muted-foreground"
                  >
                    {Icon && <Icon className="h-5 w-5" />}
                  </Link>
                )}
              </div>
            );
          })}

        </nav>

        {/* Bottom actions */}
        <div
          className={cn(
            "flex shrink-0 flex-col gap-1",
            expanded ? "py-3 px-2" : "py-2 px-1 items-center",
          )}
        >
          {expanded ? (
            <>
              <button onClick={() => setSearchOpen(true)} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-muted-foreground sidebar-nav-hover hover:text-foreground transition-colors">
                <Search className="h-5 w-5 shrink-0" />
                <span className="whitespace-nowrap">検索</span>
              </button>
              <button onClick={() => setNotifOpen(true)} className="relative flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-muted-foreground sidebar-nav-hover hover:text-foreground transition-colors">
                <Bell className="h-5 w-5 shrink-0" />
                <span className="whitespace-nowrap">通知</span>
                {unreadCount > 0 && <span className="absolute top-2.5 left-[30px] h-2 w-2 rounded-full bg-destructive" />}
              </button>
              <button onClick={() => onInternalChatOpen?.()} className="relative flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-muted-foreground sidebar-nav-hover hover:text-foreground transition-colors">
                <MessageCircle className="h-5 w-5 shrink-0" />
                <span className="whitespace-nowrap">社内チャット</span>
                {chatUnreadCount > 0 && (
                  <span className="ml-auto text-[10px] font-bold bg-rose-100 text-rose-600 rounded-full px-1.5 py-0.5">{chatUnreadCount}</span>
                )}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm sidebar-nav-hover transition-colors">
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
                    {profile?.role && (
                      <p className="text-xs text-primary font-medium mt-0.5">
                        {profileRoleLabel || ROLE_LABELS[profile.role]}
                      </p>
                    )}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="gap-2" onMouseEnter={() => prefetchNav("/settings")}>
                      <User className="h-4 w-4" />
                      プロフィール
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="gap-2" onMouseEnter={() => prefetchNav("/settings")}>
                      <Settings className="h-4 w-4" />
                      設定
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings?tab=external_integrations" className="gap-2" onMouseEnter={() => prefetchNav("/settings")}>
                      <Link2 className="h-4 w-4" />
                      外部連携
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
                  <button onClick={() => setSearchOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground sidebar-nav-hover transition-colors">
                    <Search className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">検索</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => setNotifOpen(true)} className="relative flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground sidebar-nav-hover transition-colors">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">通知</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => onInternalChatOpen?.()} className="relative flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground sidebar-nav-hover transition-colors">
                    <MessageCircle className="h-5 w-5" />
                    {chatUnreadCount > 0 && <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-rose-500" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">社内チャット</TooltipContent>
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
                        {profile?.role && (
                          <p className="text-xs text-primary font-medium mt-0.5">
                            {profileRoleLabel || ROLE_LABELS[profile.role]}
                          </p>
                        )}
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/settings" className="gap-2" onMouseEnter={() => prefetchNav("/settings")}>
                          <User className="h-4 w-4" />
                          プロフィール
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/settings" className="gap-2" onMouseEnter={() => prefetchNav("/settings")}>
                          <Settings className="h-4 w-4" />
                          設定
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/settings?tab=external_integrations" className="gap-2" onMouseEnter={() => prefetchNav("/settings")}>
                          <Link2 className="h-4 w-4" />
                          外部連携
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
      </aside>

      {/* 検索ダイアログ — 開いたときだけマウント */}
      {searchOpen && (
      <Dialog open={searchOpen} onOpenChange={(v) => { setSearchOpen(v); if (!v) { setSearchQuery(""); setSearchResults([]); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>検索</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="顧客・工事・商談・見積で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {/* データ検索結果 */}
              {searchQuery.trim() ? (
                searchLoading ? (
                  <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">検索中...</div>
                ) : searchResults.length > 0 ? (
                  <>
                    {(["customer", "construction", "deal", "estimate"] as const).map((type) => {
                      const items = searchResults.filter(r => r.type === type);
                      if (!items.length) return null;
                      const labels = { customer: "顧客", construction: "工事", deal: "商談", estimate: "見積" };
                      const colors = {
                        customer: "text-blue-600 bg-blue-50",
                        construction: "text-amber-600 bg-amber-50",
                        deal: "text-emerald-600 bg-emerald-50",
                        estimate: "text-violet-600 bg-violet-50",
                      };
                      return (
                        <div key={type}>
                          <p className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{labels[type]}</p>
                          {items.map(r => (
                            <Link
                              key={r.id}
                              href={r.href}
                              onClick={() => { setSearchOpen(false); setSearchQuery(""); setSearchResults([]); }}
                              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent transition-colors"
                            >
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${colors[type]}`}>{labels[type]}</span>
                              <span className="flex-1 font-medium">{r.title}</span>
                              <span className="text-xs text-muted-foreground truncate max-w-[100px]">{r.subtitle}</span>
                            </Link>
                          ))}
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">「{searchQuery}」に一致する結果なし</div>
                )
              ) : (
                /* 未入力時：ナビメニュー一覧 */
                <>
                  <p className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">ページ</p>
                  {visibleGroups.flatMap((g) => g.items).map((item) => (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                      className="flex items-center px-3 py-2 rounded-lg text-sm hover:bg-accent transition-colors"
                    >
                      {item.label}
                    </Link>
                  ))}
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      )}

      {/* 通知パネル — 開いたときだけマウント */}
      {notifOpen && (
      <Sheet open={notifOpen} onOpenChange={setNotifOpen}>
        <SheetContent side="right" className="w-80">
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between gap-2 pr-8">
              <span className="flex items-center gap-2">
                通知
                {unreadCount > 0 && (
                  <Badge className="bg-destructive text-destructive-foreground text-xs h-5 px-1.5">{unreadCount}</Badge>
                )}
              </span>
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => {
                    const ids = notifications.map((n) => n.id);
                    const annIds = notifications
                      .filter((n) => n.type === "announcement")
                      .map((n) => n.id.replace("ann_", ""));
                    try {
                      dismissNotificationIds(ids);
                      persistAckedBombIds(ids);
                    } catch { /* ignore */ }
                    void markAnnouncementsAsRead(annIds).catch(() => {});
                    setNotifications([]);
                  }}
                >
                  すべて既読
                </Button>
              )}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-100px)]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bell className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">新しい通知はありません</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="relative group">
                  <button
                    type="button"
                    aria-label="この通知を削除"
                    className="absolute right-1 top-1 z-10 hidden size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground group-hover:flex"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      try {
                        dismissNotificationIds([n.id]);
                      } catch { /* ignore */ }
                      if (n.type === "announcement") {
                        void markAnnouncementAsRead(n.id.replace("ann_", "")).catch(() => {});
                      }
                      setNotifications((prev) => prev.filter((x) => x.id !== n.id));
                    }}
                  >
                    <X className="size-3.5" />
                  </button>
                  <Link
                    href={n.href}
                    onClick={() => {
                      try {
                        dismissNotificationIds([n.id]);
                      } catch { /* ignore */ }
                      if (n.type === "announcement") {
                        void markAnnouncementAsRead(n.id.replace("ann_", "")).catch(() => {});
                      }
                      setNotifications((prev) => prev.filter((x) => x.id !== n.id));
                      setNotifOpen(false);
                    }}
                    className="flex items-start gap-3 px-3 py-3 pr-8 rounded-xl hover:bg-accent transition-colors"
                  >
                    <div className={`mt-0.5 shrink-0 h-8 w-8 rounded-lg flex items-center justify-center ${n.type === "workflow" ? "bg-amber-100" : n.type === "calendar" ? "bg-sky-100" : n.is_urgent ? "bg-rose-100" : ""}`}
                      style={(!n.type || (n.type !== "workflow" && n.type !== "calendar" && !n.is_urgent)) ? { backgroundColor: "rgba(var(--brand-dark-rgb), 0.12)" } : undefined}
                    >
                      {n.type === "workflow" ? (
                        <FileText className={`h-4 w-4 text-amber-600`} />
                      ) : n.type === "calendar" ? (
                        <CalendarDays className="h-4 w-4 text-sky-600" />
                      ) : (
                        <Megaphone className={`h-4 w-4 ${n.is_urgent ? "text-rose-500" : ""}`}
                          style={!n.is_urgent ? { color: "var(--brand-dark)" } : undefined}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-snug line-clamp-2">{n.title}</p>
                      {n.body && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{n.body}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {format(new Date(n.created_at), "M/d HH:mm", { locale: ja })}
                      </p>
                    </div>
                    {n.is_urgent && (
                      <Badge className="shrink-0 text-[9px] h-4 px-1 bg-rose-100 text-rose-600 hover:bg-rose-100">急</Badge>
                    )}
                    {n.type === "calendar" && (
                      <Badge variant="outline" className="shrink-0 text-[9px] h-4 px-1 border-sky-200 text-sky-600">予定</Badge>
                    )}
                  </Link>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
      )}

      {/* 爆弾アラート */}
      {showBombAlert && (
        <BombAlert
          urgentCount={bombUrgentCount}
          onDismiss={acknowledgeBombAndOpenPanel}
        />
      )}

    </>
  );
});
