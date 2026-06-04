"use client";

import { createContext, useContext } from "react";

const ChatPanelContext = createContext(false);

export function ChatPanelProvider({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <ChatPanelContext.Provider value={open}>{children}</ChatPanelContext.Provider>
  );
}

export function useChatPanelOpen() {
  return useContext(ChatPanelContext);
}
