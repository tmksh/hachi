/** BRIDGE — ブランドカラー管理（任意 hex 対応） */

/** BRIDGE Linq ロゴのティール */
export const DEFAULT_HEX = "#1CC8D4";

// ── 色変換ユーティリティ ───────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function hexToHsl(hex: string): [number, number, number] {
  const [ri, gi, bi] = hexToRgb(hex);
  const r = ri / 255, g = gi / 255, b = bi / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100, ln = l / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// ── バリアント計算 ─────────────────────────────────────────────────────

export type BrandColors = { light: string; dark: string; accent: string; mid: string };

export function computeBrandFromHex(hex: string): BrandColors {
  const [h, s, l] = hexToHsl(hex);
  const light  = hslToHex(h, s,              Math.min(65,  l + 8));
  const dark   = hslToHex(h, s,              Math.max(15,  l - 20));
  const accent = hslToHex(h, Math.max(12, s - 30), Math.min(93, l + 52));
  const mid    = hslToHex(h, Math.max(18, s - 15), Math.min(80, l + 30));
  return { light, dark, accent, mid };
}

export function getGradient(light: string, dark: string): string {
  return `linear-gradient(135deg, ${light} 0%, ${dark} 100%)`;
}

// ── CSS カスタムプロパティ一括書き込み ────────────────────────────────

export type BrandMode = "gradient" | "solid";

export function applyBrandColor(hex: string, mode: BrandMode = "gradient"): void {
  if (typeof document === "undefined") return;
  const { light, dark, accent, mid } = computeBrandFromHex(hex);

  // solid モードでは単色、gradient モードではグラデーション
  const gradient = mode === "solid" ? hex : getGradient(light, dark);
  const usedLight = mode === "solid" ? hex : light;
  const usedDark  = mode === "solid" ? hex : dark;

  const [r, g, b]   = hexToRgb(usedDark);
  const [lr, lg, lb] = hexToRgb(usedLight);
  const [ar, ag, ab] = hexToRgb(accent);
  const root = document.documentElement;

  root.style.setProperty("--brand-gradient",  gradient);
  root.style.setProperty("--brand-light",     usedLight);
  root.style.setProperty("--brand-dark",      usedDark);
  root.style.setProperty("--brand-accent",    accent);
  root.style.setProperty("--brand-mid",       mid);
  root.style.setProperty("--brand-accent-rgb",`${ar}, ${ag}, ${ab}`);
  root.style.setProperty("--brand-light-rgb", `${lr}, ${lg}, ${lb}`);
  root.style.setProperty("--brand-dark-rgb",  `${r}, ${g}, ${b}`);

  // Tailwind / shadcn トークン上書き
  root.style.setProperty("--primary",                   usedDark);
  root.style.setProperty("--primary-rgb",               `${r}, ${g}, ${b}`);
  root.style.setProperty("--primary-dark-rgb",          `${r}, ${g}, ${b}`);
  root.style.setProperty("--ring",                      usedDark);
  root.style.setProperty("--accent",                    accent);
  root.style.setProperty("--accent-foreground",         usedDark);
  root.style.setProperty("--sidebar-primary",           usedDark);
  root.style.setProperty("--sidebar-accent",            accent);
  root.style.setProperty("--sidebar-accent-foreground", usedDark);
  root.style.setProperty("--sidebar-ring",              usedDark);
  root.style.setProperty("--teal",                      usedDark);
  root.style.setProperty("--teal-light",                accent);
  root.style.setProperty("--success",                   usedDark);
  root.style.setProperty("--chart-1",                   usedDark);
  root.style.setProperty("--chart-2",                   usedLight);
  root.style.setProperty("--chart-3",                   mid);
}
