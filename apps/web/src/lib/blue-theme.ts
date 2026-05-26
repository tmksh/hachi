/** BRIDGE ダッシュボード — ブルーパレット */
export const BLUE = {
  50: "#A3DAF6",
  100: "#7AB4DB",
  300: "#5291C0",
  500: "#2B6EA8",
  700: "#004B92",
} as const;

export const BLUE_PAGE_BG = "#FBFCFE";
export const BLUE_CARD =
  "bg-white rounded-2xl shadow-sm";
export const BLUE_CARD_SM =
  "bg-white rounded-lg shadow-sm";
export const BLUE_WON_GRADIENT =
  `linear-gradient(180deg, ${BLUE[500]} 0%, ${BLUE[700]} 100%)`;
export const BLUE_ACTIVE_GRADIENT =
  `linear-gradient(135deg, ${BLUE[500]} 0%, ${BLUE[700]} 100%)`;
export const BLUE_HOVER = "hover:bg-[#A3DAF6]/50";
export const BLUE_TITLE = "text-[#004B92]";
export const BLUE_MUTED = "text-[#2B6EA8]";

export const BLUE_KPI_ICON =
  "h-7 w-7 rounded-md flex items-center justify-center shrink-0 shadow-sm";
export const BLUE_KPI_ICON_STYLE = {
  background: BLUE_ACTIVE_GRADIENT,
} as const;

export const CHART_WON_LEGEND = BLUE_WON_GRADIENT;
export const CHART_PIPELINE_LEGEND =
  `linear-gradient(180deg, ${BLUE[50]} 0%, ${BLUE[100]} 100%)`;

/** アナログ時計用 */
export const BLUE_CLOCK = {
  hourColor: BLUE[700],
  minuteColor: BLUE[500],
  secondColor: BLUE[300],
  centerColor: BLUE[700],
  faceBorder: BLUE[50],
  tickColor: BLUE[100],
  numColor: BLUE[500],
} as const;
