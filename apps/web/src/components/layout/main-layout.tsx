"use client";

import { useState, useCallback, useMemo, Suspense, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { ChatPanelProvider } from "@/contexts/chat-panel-context";
import { AdminSidebar } from "./admin-sidebar";
import { MobileNav } from "./mobile-nav";
import { BLUE_PAGE_BG } from "@/lib/blue-theme";
import { TEAL_PAGE_BG } from "@/lib/teal-theme";

const Sidebar = dynamic(
  () => import("./sidebar").then((m) => m.Sidebar),
  { loading: () => <aside className="fixed left-3 top-3 z-40 hidden md:block w-[68px] h-[calc(100vh-24px)]" aria-hidden /> },
);

const BRIDGE_AI_PANEL_WIDTH = 400;
const INTERNAL_CHAT_WIDTH = 360;
const SIDEBAR_EXPANDED_PAD = 220 + 12 + 12;
const SIDEBAR_COLLAPSED_PAD = 68 + 12 + 12;

const BridgeAiChat = dynamic(
  () => import("@/components/ai/bridge-ai-chat").then((m) => m.BridgeAiChat),
  { ssr: false },
);

const InternalChatPanel = dynamic(
  () => import("@/components/chat/internal-chat-panel").then((m) => m.InternalChatPanel),
  { ssr: false },
);

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { profile, signOut } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [internalChatOpen, setInternalChatOpen] = useState(false);
  const pathname = usePathname();
  const isAdminLogin = pathname === "/admin/login";
  const isAdminConsole = (pathname?.startsWith("/admin") ?? false) && !isAdminLogin;
  const pageBg = pathname?.startsWith("/dashboard2") ? BLUE_PAGE_BG : TEAL_PAGE_BG;

  const openInternalChat = useCallback(() => setInternalChatOpen(true), []);
  const openBridgeChat = useCallback(() => setChatOpen(true), []);

  const mainStyle = useMemo(
    () =>
      ({
        "--main-pl": `${expanded ? SIDEBAR_EXPANDED_PAD : SIDEBAR_COLLAPSED_PAD}px`,
        "--main-pr": `${(chatOpen ? BRIDGE_AI_PANEL_WIDTH : 0) + (internalChatOpen ? INTERNAL_CHAT_WIDTH : 0)}px`,
      }) as CSSProperties,
    [expanded, chatOpen, internalChatOpen],
  );

  if (isAdminLogin) {
    return <>{children}</>;
  }

  if (isAdminConsole) {
    return (
      <div className="min-h-screen">
        <Suspense fallback={null}>
          <AdminSidebar />
        </Suspense>
        <main
          className="mx-auto max-w-[1600px] min-w-0 pb-20 md:pb-0 md:pl-[244px]"
        >
          {children}
        </main>
      </div>
    );
  }

  return (
    <ChatPanelProvider open={chatOpen} internalChatOpen={internalChatOpen} openBridgeChat={openBridgeChat} openInternalChat={openInternalChat}>
      <div className="min-h-screen" style={{ backgroundColor: pageBg, ...mainStyle }}>
        <Sidebar
          profile={profile}
          onSignOut={signOut}
          expanded={expanded}
          onExpandedChange={setExpanded}
          onInternalChatOpen={openInternalChat}
        />
        <MobileNav profile={profile} />
        <main className="w-full min-w-0 pb-32 md:pb-0 md:pl-[var(--main-pl)] md:pr-[var(--main-pr)] transition-[padding] duration-300 ease-out">
          {children}
        </main>
        <BridgeAiChat open={chatOpen} onOpenChange={setChatOpen} />
        {internalChatOpen && (
          <InternalChatPanel open={internalChatOpen} onOpenChange={setInternalChatOpen} />
        )}
      </div>
    </ChatPanelProvider>
  );
}
