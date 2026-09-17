"use client";

import { useState, useCallback, useMemo, Suspense, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  ChatPanelProvider,
  type BridgeSeed,
  type InternalChatSeed,
  type OpenBridgeChatOptions,
  type OpenInternalChatOptions,
} from "@/contexts/chat-panel-context";
import { AdminSidebar } from "./admin-sidebar";
import { MobileNav } from "./mobile-nav";
import { NavigationProgress } from "./navigation-progress";
import { Sidebar } from "./sidebar";
import { TEAL_PAGE_BG } from "@/lib/teal-theme";
import { useBrandColor } from "@/hooks/use-brand-color";

/** ブランド色適用専用（親レイアウトの再レンダーを起こさない） */
function BrandColorBootstrap() {
  useBrandColor();
  return null;
}

const BRIDGE_AI_PANEL_WIDTH = 400;
const INTERNAL_CHAT_WIDTH = 360;
const SIDEBAR_EXPANDED_PAD = 196 + 12 + 12;
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
  const pathname = usePathname();
  const isAdminLogin = pathname === "/admin/login";
  const isAdminConsole = (pathname?.startsWith("/admin") ?? false) && !isAdminLogin;
  const pageBg = TEAL_PAGE_BG;
  const [expanded, setExpanded] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [bridgeSeed, setBridgeSeed] = useState<BridgeSeed | null>(null);
  const [internalChatSeed, setInternalChatSeed] = useState<InternalChatSeed | null>(null);
  const [internalChatOpen, setInternalChatOpen] = useState(false);

  const openInternalChat = useCallback((opts?: OpenInternalChatOptions) => {
    if (opts?.userId) {
      setInternalChatSeed({
        userId: opts.userId,
        message: opts.message?.trim() || undefined,
        autoSend: opts.autoSend,
      });
    }
    setInternalChatOpen(true);
  }, []);
  const openBridgeChat = useCallback((opts?: OpenBridgeChatOptions) => {
    const prompt = opts?.prompt?.trim();
    if (prompt || opts?.estimateDraft) {
      setBridgeSeed({
        prompt: prompt ?? "",
        displayText: opts?.displayText?.trim() || undefined,
        allowForward: opts?.allowForward,
        estimateDraft: opts?.estimateDraft,
      });
    }
    setChatOpen(true);
  }, []);
  const clearBridgeSeed = useCallback(() => setBridgeSeed(null), []);
  const clearInternalChatSeed = useCallback(() => setInternalChatSeed(null), []);

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
      <div className="min-h-screen" style={{ backgroundColor: pageBg, ...mainStyle }}>
        <BrandColorBootstrap />
        <Suspense fallback={null}>
          <AdminSidebar expanded={expanded} onExpandedChange={setExpanded} />
        </Suspense>
        <main className="w-full min-w-0 pb-20 md:pb-0 md:pl-[var(--main-pl)] transition-[padding] duration-300 ease-out">
          {children}
        </main>
      </div>
    );
  }

  return (
    <ChatPanelProvider open={chatOpen} internalChatOpen={internalChatOpen} openBridgeChat={openBridgeChat} openInternalChat={openInternalChat}>
      <div className="min-h-screen" style={{ backgroundColor: pageBg, ...mainStyle }}>
        <BrandColorBootstrap />
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <Sidebar
          profile={profile}
          onSignOut={signOut}
          expanded={expanded}
          onExpandedChange={setExpanded}
          onInternalChatOpen={openInternalChat}
          onBridgeChatOpen={openBridgeChat}
        />
        <MobileNav profile={profile} />
        <main className="w-full min-w-0 pb-32 md:pb-0 md:pl-[var(--main-pl)] md:pr-[var(--main-pr)] transition-[padding] duration-300 ease-out">
          {children}
        </main>
        {/* FAB（右下ボタン）は閉じているときも必要なので常時マウント */}
        <BridgeAiChat
          open={chatOpen}
          onOpenChange={setChatOpen}
          seed={bridgeSeed}
          onSeedConsumed={clearBridgeSeed}
        />
        {internalChatOpen && (
          <InternalChatPanel
            open={internalChatOpen}
            onOpenChange={setInternalChatOpen}
            seed={internalChatSeed}
            onSeedConsumed={clearInternalChatSeed}
          />
        )}
      </div>
    </ChatPanelProvider>
  );
}
