/** BRIDGE ダッシュボード — グリーンパレット（基調: #0F5132） */
export const TEAL = {
  50: "#D8EDE4",
  100: "#A8D4BC",
  300: "#4A9D6E",
  500: "#2A8055",
  700: "#0F5132",
} as const;

export const TEAL_PAGE_BG = "#FDFEFD";
export const TEAL_CARD =
  "bg-white rounded-2xl shadow-sm";
export const TEAL_CARD_SM =
  "bg-white rounded-lg shadow-sm";
/** 受注額チャートと同系統のアクセントグラデーション */
export const TEAL_WON_GRADIENT =
  `linear-gradient(180deg, ${TEAL[500]} 0%, ${TEAL[700]} 100%)`;
export const TEAL_ACTIVE_GRADIENT =
  `linear-gradient(135deg, ${TEAL[500]} 0%, ${TEAL[700]} 100%)`;
export const TEAL_HOVER = "hover:bg-[#D8EDE4]/50";
export const TEAL_TITLE = "text-[#0F5132]";
export const TEAL_MUTED = "text-[#2A8055]";
export const TEAL_LINK =
  "text-[#A8D4BC] hover:text-[#2A8055] transition-colors";
export const TEAL_ARROW_HOVER = "hover:text-[#2A8055]";

export const TEAL_KPI_ICON =
  "h-7 w-7 rounded-md flex items-center justify-center shrink-0 shadow-sm";
export const TEAL_KPI_ICON_STYLE = {
  background: TEAL_ACTIVE_GRADIENT,
} as const;

export const CHART_WON_LEGEND = TEAL_WON_GRADIENT;
export const CHART_PIPELINE_LEGEND = `linear-gradient(180deg, ${TEAL[50]} 0%, ${TEAL[100]} 100%)`;
