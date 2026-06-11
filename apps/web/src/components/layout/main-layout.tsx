"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { ChatPanelProvider } from "@/contexts/chat-panel-context";
import { Sidebar } from "./sidebar";
import { AdminSidebar } from "./admin-sidebar";
import { MobileNav } from "./mobile-nav";
import { BLUE_PAGE_BG } from "@/lib/blue-theme";
import { TEAL_PAGE_BG } from "@/lib/teal-theme";

const BRIDGE_AI_PANEL_WIDTH = 400;
const INTERNAL_CHAT_WIDTH = 360;

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

  if (isAdminLogin) {
    return <>{children}</>;
  }

  if (isAdminConsole) {
    return (
      <div className="min-h-screen">
        <AdminSidebar />
        <main className="hidden md:block" style={{ paddingLeft: 220 + 12 + 12 }}>
          <div className="mx-auto max-w-[1600px] min-w-0">
            {children}
          </div>
        </main>
        <main className="md:hidden pb-20">
          {children}
        </main>
      </div>
    );
  }

  return (
    <ChatPanelProvider open={chatOpen} internalChatOpen={internalChatOpen} openInternalChat={() => setInternalChatOpen(true)}>
      <div className="min-h-screen" style={{ backgroundColor: pageBg }}>
        <Sidebar
          profile={profile}
          onSignOut={signOut}
          expanded={expanded}
          onExpandedChange={setExpanded}
          onInternalChatOpen={() => setInternalChatOpen(true)}
        />
        <MobileNav profile={profile} />
        {/* Desktop */}
        <motion.main
          animate={{
            paddingLeft: expanded ? 220 + 12 + 12 : 68 + 12 + 12,
            paddingRight: (chatOpen ? BRIDGE_AI_PANEL_WIDTH : 0) + (internalChatOpen ? INTERNAL_CHAT_WIDTH : 0),
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="hidden md:block min-w-0"
        >
          <div className="mx-auto max-w-[1600px] min-w-0">
            {children}
          </div>
        </motion.main>
        {chatOpen && <BridgeAiChat open={chatOpen} onOpenChange={setChatOpen} />}
        {internalChatOpen && (
          <InternalChatPanel open={internalChatOpen} onOpenChange={setInternalChatOpen} />
        )}
        {/* Mobile */}
        <main className="md:hidden pb-32">
          {children}
        </main>
      </div>
    </ChatPanelProvider>
  );
}
