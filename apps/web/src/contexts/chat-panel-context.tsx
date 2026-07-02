"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ChatPanelContextValue = {
  bridgeChatOpen: boolean;
  internalChatOpen: boolean;
  internalChatRefreshKey: number;
  openBridgeChat: () => void;
  openInternalChat: () => void;
  refreshInternalChat: () => void;
};

const ChatPanelContext = createContext<ChatPanelContextValue>({
  bridgeChatOpen: false,
  internalChatOpen: false,
  internalChatRefreshKey: 0,
  openBridgeChat: () => {},
  openInternalChat: () => {},
  refreshInternalChat: () => {},
});

export function ChatPanelProvider({
  open,
  internalChatOpen,
  openBridgeChat,
  openInternalChat,
  children,
}: {
  open: boolean;
  internalChatOpen: boolean;
  openBridgeChat: () => void;
  openInternalChat: () => void;
  children: React.ReactNode;
}) {
  const [internalChatRefreshKey, setInternalChatRefreshKey] = useState(0);
  const refreshInternalChat = useCallback(() => {
    setInternalChatRefreshKey((k) => k + 1);
  }, []);

  const value = useMemo(
    () => ({
      bridgeChatOpen: open,
      internalChatOpen,
      internalChatRefreshKey,
      openBridgeChat,
      openInternalChat,
      refreshInternalChat,
    }),
    [open, internalChatOpen, internalChatRefreshKey, openBridgeChat, openInternalChat, refreshInternalChat],
  );

  return (
    <ChatPanelContext.Provider value={value}>
      {children}
    </ChatPanelContext.Provider>
  );
}

export function useChatPanelOpen() {
  return useContext(ChatPanelContext).bridgeChatOpen;
}

export function useBridgeChat() {
  const { bridgeChatOpen, openBridgeChat } = useContext(ChatPanelContext);
  return { bridgeChatOpen, openBridgeChat };
}

export function useInternalChat() {
  const { internalChatOpen, internalChatRefreshKey, openInternalChat, refreshInternalChat } =
    useContext(ChatPanelContext);
  return { internalChatOpen, internalChatRefreshKey, openInternalChat, refreshInternalChat };
}
