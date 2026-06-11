"use client";

import { createContext, useContext } from "react";

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
  return (
    <ChatPanelContext.Provider value={{ bridgeChatOpen: open, internalChatOpen, openInternalChat }}>
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
