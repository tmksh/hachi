"use client";

import { createContext, useContext, useMemo } from "react";

type ChatPanelContextValue = {
  bridgeChatOpen: boolean;
  internalChatOpen: boolean;
  openInternalChat: () => void;
};

const ChatPanelContext = createContext<ChatPanelContextValue>({
  bridgeChatOpen: false,
  internalChatOpen: false,
  openInternalChat: () => {},
});

export function ChatPanelProvider({
  open,
  internalChatOpen,
  openInternalChat,
  children,
}: {
  open: boolean;
  internalChatOpen: boolean;
  openInternalChat: () => void;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ bridgeChatOpen: open, internalChatOpen, openInternalChat }),
    [open, internalChatOpen, openInternalChat],
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

export function useInternalChat() {
  const { internalChatOpen, openInternalChat } = useContext(ChatPanelContext);
  return { internalChatOpen, openInternalChat };
}
