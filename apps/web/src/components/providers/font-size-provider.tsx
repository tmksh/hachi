"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  applyFontSize,
  DEFAULT_FONT_SIZE,
  getStoredFontSize,
  isFontSize,
  type FontSize,
} from "@/lib/font-size";

type FontSizeContextValue = {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  saving: boolean;
};

const FontSizeContext = createContext<FontSizeContextValue | null>(null);

export function FontSizeProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSize>(() => getStoredFontSize() ?? DEFAULT_FONT_SIZE);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    applyFontSize(fontSize);
  }, [fontSize]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const meta = user?.user_metadata?.font_size;
      if (isFontSize(meta) && meta !== fontSize) {
        setFontSizeState(meta);
        applyFontSize(meta);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setFontSize = useCallback(async (size: FontSize) => {
    setFontSizeState(size);
    applyFontSize(size);
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.auth.updateUser({
          data: { ...user.user_metadata, font_size: size },
        });
      }
    } catch {
      /* localStorage のみでも利用可能 */
    } finally {
      setSaving(false);
    }
  }, [supabase]);

  return (
    <FontSizeContext.Provider value={{ fontSize, setFontSize, saving }}>
      {children}
    </FontSizeContext.Provider>
  );
}

export function useFontSize() {
  const ctx = useContext(FontSizeContext);
  if (!ctx) {
    throw new Error("useFontSize must be used within FontSizeProvider");
  }
  return ctx;
}
