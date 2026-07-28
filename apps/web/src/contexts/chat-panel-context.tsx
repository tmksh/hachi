"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type OpenBridgeChatOptions = {
  /** 開いたあと自動送信するプロンプト（API 向け） */
  prompt?: string;
  /** チャット上に表示する短い文言（未指定時は prompt を表示） */
  displayText?: string;
  /** 応答後に社内チャット転送 UI を出す */
  allowForward?: boolean;
  /** 工事見積 Linq 共同作成モード（入力を見積ドラフト生成に使う） */
  estimateDraft?: {
    estimateId: string;
    onApplied?: (estimate: unknown) => void;
  };
};

export type BridgeSeed = {
  prompt: string;
  displayText?: string;
  allowForward?: boolean;
  estimateDraft?: {
    estimateId: string;
    onApplied?: (estimate: unknown) => void;
  };
};

export type OpenInternalChatOptions = {
  /** 開いたときこの相手の会話を表示 */
  userId?: string;
  /** 入力欄に入れる／自動送信する本文 */
  message?: string;
  /** true なら開いたあと message を自動送信 */
  autoSend?: boolean;
};

export type InternalChatSeed = {
  userId: string;
  message?: string;
  autoSend?: boolean;
};

type ChatPanelContextValue = {
  bridgeChatOpen: boolean;
  internalChatOpen: boolean;
  internalChatRefreshKey: number;
  openBridgeChat: (opts?: OpenBridgeChatOptions) => void;
  openInternalChat: (opts?: OpenInternalChatOptions) => void;
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
  openBridgeChat: (opts?: OpenBridgeChatOptions) => void;
  openInternalChat: (opts?: OpenInternalChatOptions) => void;
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
