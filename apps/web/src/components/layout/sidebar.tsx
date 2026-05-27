"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { TEAL_ACTIVE_GRADIENT, TEAL_TITLE } from "@/lib/teal-theme";
import { BLUE_ACTIVE_GRADIENT } from "@/lib/blue-theme";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, canAccessNavItem, ROLE_LABELS } from "@/lib/constants";
import { useKpiColor } from "@/hooks/use-kpi-color";
import { useCompanyPermissions } from "@/hooks/use-company-permissions";
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
  FileText,
  CalendarDays,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth, type Profile } from "@/hooks/use-auth";
import { getNotifications, markAnnouncementAsRead, type Notification } from "@/lib/actions/notifications";
import { globalSearch, type SearchResult } from "@/lib/actions/search";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

/** hex カラーにアルファ値を付与した rgba 文字列を返す */
function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
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
}

export function Sidebar({ profile, onSignOut, expanded, onExpandedChange }: SidebarProps) {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const fetch = () => getNotifications().then(setNotifications).catch(() => {});
    void fetch();
    const timer = setInterval(fetch, 60_000);
    return () => clearInterval(timer);
  }, []);

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

  const useBlueSidebar = pathname.startsWith("/dashboard2");

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

  const { user } = useAuth();
  const { color: kpiColor } = useKpiColor();
  const { canAccess: canAccessCustom } = useCompanyPermissions();

  /** ロールでフィルタされたナビグループ */
  const visibleGroups = NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!profile?.role) return true;
        // システムロール制限チェック
        if (!canAccessNavItem(item.key, profile.role)) return false;
        // カスタム権限チェック（会社設定で上書き可能）
        return canAccessCustom(item.key, [profile.role]);
      }),
    }))
    .filter((group) => group.items.length > 0);

  const toggleGroup = (key: string) => {
    setOpenGroup((prev) => (prev === key ? null : key));
  };

  const sidebarActiveItem = "text-white font-medium shadow-sm";
  const sidebarActiveSubItem = "text-white font-medium shadow-sm";
  const sidebarActiveIndicator = "hidden";
  const sidebarActiveStyle = {
    background: useBlueSidebar ? BLUE_ACTIVE_GRADIENT : TEAL_ACTIVE_GRADIENT,
  };
  const groupActiveText = useBlueSidebar
    ? "text-slate-800 dark:text-slate-200"
    : `${TEAL_TITLE} dark:text-[#D8EDE4]`;

  return (
    <TooltipProvider delayDuration={300}>
      <motion.aside
        animate={{ width: expanded ? 220 : 68 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={cn(
          "fixed left-3 top-3 z-40 hidden md:flex h-[calc(100vh-24px)] flex-col frost-sidebar overflow-hidden rounded-2xl",
          useBlueSidebar && "sidebar-theme-blue",
        )}
      >
        {/* Logo — クリックでサイドバー開閉 */}
        <div
          className={cn(
            "flex shrink-0 items-center gap-2",
            expanded ? "h-14 px-3" : "h-12 justify-center px-1",
          )}
        >
          <button
            onClick={() => onExpandedChange(!expanded)}
            className="h-10 w-10 flex items-center justify-center transition-transform hover:scale-105 shrink-0 rounded-xl sidebar-nav-hover"
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
        <nav
          className={cn(
            "flex-1 flex flex-col gap-1 min-h-0 overflow-y-auto",
            expanded ? "py-3 px-2" : "py-2 px-1 items-center",
            useBlueSidebar && "text-slate-800",
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
                          <motion.div
                            layoutId="sidebar-active"
                            className={cn(
                              "absolute -left-[14px] top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full",
                              sidebarActiveIndicator,
                            )}
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
                          "relative flex h-11 w-11 items-center justify-center rounded-xl sidebar-nav-hover",
                          active ? sidebarActiveItem : "text-muted-foreground",
                        )}
                        style={active ? sidebarActiveStyle : undefined}
                      >
                        {Icon && <Icon className="h-5 w-5" />}
                        {active && (
                          <motion.div
                            layoutId="sidebar-active"
                            className={cn(
                              "absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[2px] w-1 h-5 rounded-r-full",
                              sidebarActiveIndicator,
                            )}
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
                              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors block sidebar-nav-hover",
                              isActive(item.href) ? sidebarActiveSubItem : "text-foreground",
                            )}
                            style={isActive(item.href) ? sidebarActiveStyle : undefined}
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
                        {ROLE_LABELS[profile.role]}
                      </p>
                    )}
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
                            {ROLE_LABELS[profile.role]}
                          </p>
                        )}
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

      {/* 検索ダイアログ */}
      <Dialog open={searchOpen} onOpenChange={(v) => { setSearchOpen(v); if (!v) { setSearchQuery(""); setSearchResults([]); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>検索</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="顧客名・工事名・商談名で検索..."
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
                    {(["customer", "construction", "deal"] as const).map((type) => {
                      const items = searchResults.filter(r => r.type === type);
                      if (!items.length) return null;
                      const labels = { customer: "顧客", construction: "工事", deal: "商談" };
                      const colors = { customer: "text-blue-600 bg-blue-50", construction: "text-amber-600 bg-amber-50", deal: "text-emerald-600 bg-emerald-50" };
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

      {/* 通知パネル */}
      <Sheet open={notifOpen} onOpenChange={setNotifOpen}>
        <SheetContent side="right" className="w-80">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              通知
              {unreadCount > 0 && (
                <Badge className="bg-destructive text-destructive-foreground text-xs h-5 px-1.5">{unreadCount}</Badge>
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
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={() => {
                    if (n.type === "announcement") {
                      const annId = n.id.replace("ann_", "");
                      markAnnouncementAsRead(annId).then(() => {
                        setNotifications((prev) => prev.filter((x) => x.id !== n.id));
                      }).catch(() => {});
                    }
                    setNotifOpen(false);
                  }}
                  className="flex items-start gap-3 px-3 py-3 rounded-xl hover:bg-accent transition-colors"
                >
                  <div className={`mt-0.5 shrink-0 h-8 w-8 rounded-lg flex items-center justify-center ${n.type === "workflow" ? "bg-amber-100" : n.type === "calendar" ? "bg-sky-100" : n.is_urgent ? "bg-rose-100" : ""}`}
                    style={(!n.type || (n.type !== "workflow" && n.type !== "calendar" && !n.is_urgent)) ? { backgroundColor: hexAlpha(kpiColor, 0.12) } : undefined}
                  >
                    {n.type === "workflow" ? (
                      <FileText className={`h-4 w-4 text-amber-600`} />
                    ) : n.type === "calendar" ? (
                      <CalendarDays className="h-4 w-4 text-sky-600" />
                    ) : (
                      <Megaphone className={`h-4 w-4 ${n.is_urgent ? "text-rose-500" : ""}`}
                        style={!n.is_urgent ? { color: kpiColor } : undefined}
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
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

    </TooltipProvider>
  );
}
