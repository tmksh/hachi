export type FontSize = "sm" | "md" | "lg";

export const FONT_SIZE_STORAGE_KEY = "hachi-font-size";

export const FONT_SIZE_LABELS: Record<FontSize, string> = {
  sm: "小",
  md: "中",
  lg: "大",
};

export const DEFAULT_FONT_SIZE: FontSize = "md";

export function isFontSize(v: unknown): v is FontSize {
  return v === "sm" || v === "md" || v === "lg";
}

export function applyFontSize(size: FontSize) {
  if (typeof document === "undefined") return;
  if (size === "md") {
    document.documentElement.removeAttribute("data-font-size");
  } else {
    document.documentElement.setAttribute("data-font-size", size);
  }
  try {
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, size);
  } catch {
    /* ignore */
  }
}

export function getStoredFontSize(): FontSize | null {
  try {
    const v = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    if (isFontSize(v)) return v;
  } catch {
    /* ignore */
  }
  return null;
}

/** 初回描画前に localStorage から適用（layout inline script 用） */
export const FONT_SIZE_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem("${FONT_SIZE_STORAGE_KEY}");if(s==="sm"||s==="lg")document.documentElement.setAttribute("data-font-size",s);}catch(e){}})();`;
