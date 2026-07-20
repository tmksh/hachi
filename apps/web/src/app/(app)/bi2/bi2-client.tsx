"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Settings2,
  ShieldCheck,
  Eye,
  EyeOff,
  RotateCcw,
  TrendingUp,
  Target,
  Briefcase,
  ArrowUpRight,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ComboChart } from "@/components/charts/combo-chart";
import { TrendAreaChart } from "@/components/charts/trend-area-chart";
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { getBiSettings, getBiActuals, getBiProspectSummary, releaseReserve, type BiProspectSummary } from "@/lib/actions/bi";
import { useAuth } from "@/components/providers/auth-provider";
import { useCompanyPermissions } from "@/hooks/use-company-permissions";
import { toast } from "sonner";
import type { BiAnnualSettings, BiActuals } from "@/lib/bi-types";
import { MOCK_OVERHEAD_BUDGET_MAN } from "@/lib/bi-types";
import {
  getCurrentFiscalYear,
  fiscalYearLabel,
  listFiscalYears,
  buildFiscalMonthLabels,
  getForecastStartIndex,
  DEFAULT_FISCAL_MONTH_START,
  normalizeBudgetMan,
  buildRealisticMonthlyComboData,
  shouldUseMonthlyTrendMock,
} from "@/lib/bi-utils";
import {
  buildBiDashboardMock,
  shouldUseBiDashboardMock,
  buildBiDashboardMonthlyCombo,
} from "@/lib/bi-mock-data";
import { BiSettingsDialog } from "@/components/bi/bi-settings-dialog";
import { cn } from "@/lib/utils";
import { useBrandColor } from "@/hooks/use-brand-color";
import { computeBrandFromHex } from "@/lib/brand-color";

const BI_NEGATIVE = "#e11d48";

const FALLBACK_DEPT_ACTUALS = [
  { name: "一般住宅",  label: "A部門", revenue: 0, grossProfit: 0 },
  { name: "新築",      label: "B部門", revenue: 0, grossProfit: 0 },
  { name: "公共工事",  label: "C部門", revenue: 0, grossProfit: 0 },
  { name: "リフォーム", label: "D部門", revenue: 0, grossProfit: 0 },
];

function makeFallbackMonthly(startMonth = DEFAULT_FISCAL_MONTH_START) {
  return buildFiscalMonthLabels(startMonth).map((month) => ({ month, revenue: 0, grossProfit: 0 }));
}

const FALLBACK_FORECAST_TIERS = [
  { id: "contracted", label: "着地（契約済）", revenue: 0, grossProfit: 0 },
  { id: "prospective", label: "着地（A見込含）", revenue: 0, grossProfit: 0 },
];

// ── ユーティリティ ──────────────────────────────────────────────────
function r1(v: number) { return Math.round(v * 10) / 10; }
function pct(part: number, whole: number) { return whole > 0 ? r1((part / whole) * 100) : 0; }
function fmtMan(v: number) { return `¥${Math.abs(v).toLocaleString()}万`; }
function fmtSigned(v: number) { return v < 0 ? `▲${fmtMan(v)}` : fmtMan(v); }
function fmtTargetMan(v: number | null | undefined) {
  if (v == null) return "未設定";
  return fmtMan(v);
}
function deltaLabel(pt: number | null | undefined, unit = "pt") {
  if (pt == null) return undefined;
  const sign = pt > 0 ? "+" : "";
  return `前月比 ${sign}${pt}${unit}`;
}

type MonthlyDetailRow =
  | {
      kind: "actual";
      label: string;
      hasActivity: boolean;
      revenue: number;
      grossProfit: number;
      allocation: number;
      grossProfitTotal: number;
      cumulative: number;
    }
  | { kind: "forecast"; label: string };

/** 月次明細（前半：実績期間を個別行、後半：着地予測1行） */
function buildMonthlyDetailRows(
  monthly: Array<{ month: string; revenue: number; grossProfit: number }>,
  allocations: number[],
  settingsConfigured: boolean,
  overheadForCalc: number,
  forecastStartIdx: number,
): MonthlyDetailRow[] {
  const uniformAlloc =
    settingsConfigured && overheadForCalc > 0 ? Math.round(overheadForCalc / 12) : 0;

  const resolveAlloc = (i: number) => {
    const v = allocations[i] > 0 ? allocations[i] : uniformAlloc;
    return v > 0 ? v : 0;
  };

  const rows: MonthlyDetailRow[] = [];
  let cumulative = 0;

  for (let i = 0; i < forecastStartIdx; i++) {
    const m = monthly[i];
    const hasActivity = m.revenue !== 0 || m.grossProfit !== 0;
    const alloc = resolveAlloc(i);

    if (hasActivity) {
      const grossProfitTotal = m.grossProfit - alloc;
      cumulative += grossProfitTotal;
      rows.push({
        kind: "actual",
        label: m.month,
        hasActivity: true,
        revenue: m.revenue,
        grossProfit: m.grossProfit,
        allocation: alloc,
        grossProfitTotal,
        cumulative,
      });
    } else {
      rows.push({
        kind: "actual",
        label: m.month,
        hasActivity: false,
        revenue: 0,
        grossProfit: 0,
        allocation: alloc,
        grossProfitTotal: 0,
        cumulative,
      });
    }
  }

  const forecastStart = monthly[forecastStartIdx]?.month ?? monthly[forecastStartIdx]?.month ?? "予測";
  const forecastEnd = monthly[monthly.length - 1]?.month ?? "3月";
  rows.push({
    kind: "forecast",
    label: `${forecastStart}〜${forecastEnd}（着地予測）`,
  });

  return rows;
}

/** グラフ用モック系列から月次明細行を生成（表ビューとグラフの連動用） */
function buildMonthlyDetailRowsFromCombo(
  comboData: Array<{ month: string; 粗利額: number; 月次予定配賦: number; 累計: number }>,
  forecastStartIdx: number,
  grossProfitRatePct: number,
): MonthlyDetailRow[] {
  const rate = grossProfitRatePct > 0 ? grossProfitRatePct / 100 : 0.586;
  const rows: MonthlyDetailRow[] = [];

  for (let i = 0; i < forecastStartIdx; i++) {
    const pt = comboData[i];
    if (!pt) continue;
    const grossProfit = pt.粗利額;
    const allocation = Math.abs(pt.月次予定配賦);
    const grossProfitTotal = grossProfit - allocation;
    const hasActivity = grossProfit !== 0 || allocation !== 0;

    rows.push({
      kind: "actual",
      label: pt.month,
      hasActivity,
      revenue: hasActivity && rate > 0 ? Math.round(grossProfit / rate) : 0,
      grossProfit,
      allocation,
      grossProfitTotal,
      cumulative: pt.累計,
    });
  }

  const forecastStart = comboData[forecastStartIdx]?.month ?? "予測";
  const forecastEnd = comboData[comboData.length - 1]?.month ?? "3月";
  rows.push({
    kind: "forecast",
    label: `${forecastStart}〜${forecastEnd}（着地予測）`,
  });

  return rows;
}

function resolveMonthlyAllocation(
  index: number,
  allocations: number[],
  settingsConfigured: boolean,
  overheadForCalc: number,
): number {
  const uniformAlloc =
    settingsConfigured && overheadForCalc > 0 ? Math.round(overheadForCalc / 12) : 0;
  const v = allocations[index] > 0 ? allocations[index] : uniformAlloc;
  return v > 0 ? v : 0;
}

function fmtMonthlyAlloc(allocation: number, settingsConfigured: boolean) {
  if (!settingsConfigured || allocation <= 0) return "—";
  return `▲¥${allocation.toLocaleString()}万`;
}

/** 株主向けBIデザイン案 — 表示設定のブランドカラーに追従 */

/** 部門カードは `dept:部門名` の動的IDで追加される */
type Bi2CardId = string;
const BI2_CARD_ORDER_KEY = "bi2-card-order";

/** 12カラムグリッドでの各カードの占有幅（部門カードは DEPT_CARD_SPAN） */
const BI2_CARD_SPAN: Record<string, string> = {
  "kpi-revenue": "col-span-12 md:col-span-6 xl:col-span-4",
  "kpi-achieve": "col-span-12 md:col-span-6 xl:col-span-4",
  "kpi-op":      "col-span-12 md:col-span-6 xl:col-span-4",
  "sub-gross":    "col-span-6 lg:col-span-3",
  "sub-cum":      "col-span-6 lg:col-span-3",
  "sub-overhead": "col-span-6 lg:col-span-3",
  "sub-yoy":      "col-span-6 lg:col-span-3",
  pnl:          "col-span-12 xl:col-span-4",
  monthly:      "col-span-12 xl:col-span-8",
  yoy:          "col-span-12",
  "dept-donut": "col-span-12 lg:col-span-6",
  forecast:     "col-span-12 lg:col-span-6",
  prospects:    "col-span-12 lg:col-span-6",
};
const DEPT_CARD_SPAN = "col-span-12 sm:col-span-6 xl:col-span-3";

/**
 * 保存済み順序と現在の有効カード一覧をマージ。
 * 新規カードはデフォルト順の直前カードの後ろに挿入する。
 */
function mergeCardOrder(saved: string[], defaultOrder: string[]): Bi2CardId[] {
  const valid = new Set(defaultOrder);
  const out = saved.filter((id) => valid.has(id));
  defaultOrder.forEach((id, i) => {
    if (out.includes(id)) return;
    let insertAt = out.length;
    for (let j = i - 1; j >= 0; j--) {
      const idx = out.indexOf(defaultOrder[j]);
      if (idx >= 0) { insertAt = idx + 1; break; }
    }
    out.splice(insertAt, 0, id);
  });
  return out;
}

function loadCardOrder(defaultOrder: string[]): Bi2CardId[] {
  try {
    const raw = localStorage.getItem(BI2_CARD_ORDER_KEY);
    if (!raw) return [...defaultOrder];
    return mergeCardOrder(JSON.parse(raw) as string[], defaultOrder);
  } catch {
    return [...defaultOrder];
  }
}

function ExecCard({
  title,
  right,
  children,
  className,
  bodyClassName,
  flush,
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  flush?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white shadow-[0_8px_28px_-10px_rgba(var(--brand-dark-rgb),0.16)] ring-1 ring-[rgba(var(--brand-accent-rgb),0.85)] flex flex-col min-h-0",
        className,
      )}
    >
      {(title || right) && (
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-1">
          {title ? (
            <h3 className="text-[15px] font-bold tracking-tight text-slate-900">{title}</h3>
          ) : <span />}
          {right}
        </div>
      )}
      <div className={cn(flush ? "" : "px-4 pb-3", "min-w-0 flex-1", bodyClassName)}>{children}</div>
    </div>
  );
}

function SortableCard({
  id,
  className,
  children,
}: {
  id: Bi2CardId;
  className?: string;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 30 : undefined,
      }}
      className={cn("relative min-w-0 min-h-0", className, isDragging && "opacity-60")}
    >
      {/* 上端の透明ゾーンでドラッグ並び替え（視覚ハンドルなし） */}
      <div
        {...attributes}
        {...listeners}
        aria-label="ドラッグして並び替え"
        className="absolute top-0 left-0 right-0 z-20 h-3 cursor-grab active:cursor-grabbing touch-none select-none"
      />
      {children}
    </div>
  );
}

function SubMetricCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  primary,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof TrendingUp;
  accent: string;
  primary: string;
}) {
  return (
    <div className="h-full rounded-2xl bg-white/90 px-4 py-3.5 ring-1 ring-[rgba(var(--brand-accent-rgb),0.75)] shadow-[0_4px_16px_-8px_rgba(var(--brand-dark-rgb),0.12)] flex items-start gap-3">
      <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: accent }}>
        <Icon className="h-4 w-4" style={{ color: primary }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold" style={{ color: "#64748b" }}>{label}</p>
        <p className="text-xl font-black tabular-nums mt-0.5 leading-tight" style={{ color: "#0f172a" }}>{value}</p>
        <p className="text-xs mt-0.5 truncate" style={{ color: "#64748b" }}>{hint}</p>
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div
      className="inline-flex items-center rounded-full p-1 gap-0.5"
      style={{ background: "rgba(var(--brand-accent-rgb),0.55)" }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "px-3.5 py-1.5 text-xs rounded-full transition-all",
            value === o.value
              ? "font-bold text-white shadow-sm"
              : "font-medium text-slate-500 hover:text-slate-700",
          )}
          style={value === o.value ? { background: "var(--brand-dark)" } : undefined}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 中央%付きリング（株主ダッシュボード向け） */
function ProgressRing({
  rate,
  size = 112,
  label,
  color = "var(--brand-dark)",
  track = "rgba(var(--brand-accent-rgb),0.55)",
}: {
  rate: number;
  size?: number;
  label: string;
  color?: string;
  track?: string;
}) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(rate, 100));
  const offset = c - (clamped / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black tabular-nums leading-none text-slate-900">{Math.round(rate)}%</span>
        <span className="text-[11px] font-medium mt-1 text-slate-500">{label}</span>
      </div>
    </div>
  );
}


export function Bi2Client({
  initialSettings,
  initialActuals,
}: {
  initialSettings: BiAnnualSettings | null;
  initialActuals: BiActuals | null;
}) {
  const searchParams = useSearchParams();
  const { role } = useAuth();
  const { canAccess } = useCompanyPermissions();
  // 予備費の実値確認・決算戻しの操作可否は権限マトリクス（reserve_fee）で制御
  const canManageReserve = role ? canAccess("reserve_fee", [role]) : false;
  const [showActualReserve, setShowActualReserve] = useState(false);
  const [releasingReserve, setReleasingReserve] = useState(false);
  const [settings, setSettings] = useState<BiAnnualSettings | null>(initialSettings);
  const [actuals, setActuals] = useState<BiActuals | null>(initialActuals);
  const [prevActuals, setPrevActuals] = useState<BiActuals | null>(null);
  const [prospectSummary, setProspectSummary] = useState<BiProspectSummary | null>(null);
  const [yoyMode, setYoyMode] = useState<"cumulative" | "monthly">("cumulative");
  const [monthlyView, setMonthlyView] = useState<"chart" | "table">("chart");
  const [includeSpecial, setIncludeSpecial] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fiscalYear, setFiscalYear] = useState(getCurrentFiscalYear());
  const fiscalYearOptions = listFiscalYears(5);
  const [cardOrder, setCardOrder] = useState<Bi2CardId[]>([]);
  const cardSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleCardDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setCardOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as Bi2CardId);
      const newIndex = prev.indexOf(over.id as Bi2CardId);
      if (oldIndex < 0 || newIndex < 0) return prev;
      const next = arrayMove(prev, oldIndex, newIndex);
      try {
        localStorage.setItem(BI2_CARD_ORDER_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const { hex: brandHex } = useBrandColor();
  const brand = computeBrandFromHex(brandHex);
  const CHART_PRIMARY = brandHex;
  const CHART_DARK    = brand.dark;
  const CHART_MID     = brand.mid;
  const CHART_ACCENT  = brand.accent;
  const DEPT_CHART_COLORS = [brand.dark, brandHex, brand.mid, brand.accent];

  useEffect(() => {
    if (searchParams.get("settings") === "1") {
      setSettingsOpen(true);
      window.history.replaceState(null, "", "/bi2");
    }
  }, [searchParams]);

  const loadBiData = useCallback((silent = false, includePrevYear = true) => {
    if (!silent) setSettingsLoaded(false);
    return Promise.all([
      getBiSettings(fiscalYear),
      getBiActuals(fiscalYear),
      // 前年実績は変化がほぼないため、ポーリング時はスキップして負荷を抑える
      includePrevYear ? getBiActuals(fiscalYear - 1) : Promise.resolve(undefined),
      getBiProspectSummary(),
    ])
      .then(([s, a, p, ps]) => {
        setSettings(s);
        setActuals(a);
        if (p !== undefined) setPrevActuals(p);
        setProspectSummary(ps);
      })
      .finally(() => setSettingsLoaded(true));
  }, [fiscalYear]);

  // 初回マウントは SSR の初期データを使い、不足分（前年実績・見込みサマリ）のみ取得。
  // 年度変更時はローディング表示付きで全体を再取得。
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      Promise.all([getBiActuals(fiscalYear - 1), getBiProspectSummary()])
        .then(([p, ps]) => { setPrevActuals(p); setProspectSummary(ps); });
      return;
    }
    loadBiData(false);
  }, [fiscalYear, loadBiData]);

  // 案件データ更新を反映（フォーカス復帰 + 2分ポーリング）。スケルトンを出さず静かに更新
  useEffect(() => {
    const onFocus = () => loadBiData(true, false);
    window.addEventListener("focus", onFocus);
    const interval = setInterval(() => { if (document.visibilityState === "visible") loadBiData(true, false); }, 120000);
    return () => { window.removeEventListener("focus", onFocus); clearInterval(interval); };
  }, [loadBiData]);

  const handleToggleReserveRelease = useCallback(async (release: boolean) => {
    setReleasingReserve(true);
    try {
      const res = await releaseReserve(fiscalYear, release);
      if (!res.ok) { toast.error(res.error ?? "操作に失敗しました"); return; }
      toast.success(release ? "予備費を利益に戻しました（決算）" : "予備費の決算戻しを取り消しました");
      await loadBiData(true);
    } finally {
      setReleasingReserve(false);
    }
  }, [fiscalYear, loadBiData]);

  const fiscalMonthStartRaw       = actuals?.fiscalMonthStart ?? DEFAULT_FISCAL_MONTH_START;
  const useDashboardMock          = shouldUseBiDashboardMock(fiscalYear, fiscalMonthStartRaw);
  const dashboardMock             = useDashboardMock ? buildBiDashboardMock(fiscalMonthStartRaw) : null;

  const effectiveSettings         = dashboardMock?.settings ?? settings;
  const effectiveActuals          = dashboardMock?.actuals ?? actuals;
  const effectivePrevActuals      = dashboardMock?.prevActuals ?? prevActuals;
  const effectiveProspectSummary  = dashboardMock?.prospectSummary ?? prospectSummary;

  const settingsConfigured = effectiveSettings !== null;
  const targetRevenue  = settingsConfigured ? normalizeBudgetMan(effectiveSettings.target_revenue ?? 0)        : null;
  const overheadBudget = settingsConfigured ? normalizeBudgetMan(effectiveSettings.overhead_budget ?? 0)       : null;
  const sgaBudget      = settingsConfigured ? normalizeBudgetMan(effectiveSettings.sga_budget ?? 0)            : null;
  const targetGp       = settingsConfigured ? normalizeBudgetMan(effectiveSettings.target_gross_profit ?? 0)   : null;

  const overheadForCalc      = overheadBudget ?? 0;
  const sgaForCalc           = sgaBudget ?? 0;
  const targetRevenueForCalc = targetRevenue ?? 0;
  const targetGpForCalc      = targetGp ?? 0;

  const fiscalMonthStart          = effectiveActuals?.fiscalMonthStart          ?? DEFAULT_FISCAL_MONTH_START;
  const forecastStartIndex        = getForecastStartIndex(fiscalMonthStart);

  const deptActuals               = effectiveActuals?.deptActuals               ?? FALLBACK_DEPT_ACTUALS;
  const monthlyActuals            = effectiveActuals?.monthly                   ?? makeFallbackMonthly(fiscalMonthStart);
  const monthlyOverheadAllocations = effectiveActuals?.monthlyOverheadAllocations ?? Array(12).fill(0);
  const monthlySgaAllocations     = effectiveActuals?.monthlySgaAllocations     ?? Array(12).fill(0);
  const forecastTiers             = effectiveActuals?.forecastTiers             ?? FALLBACK_FORECAST_TIERS;
  const sparklines                = effectiveActuals?.sparklines;
  const grossProfitRateDelta      = effectiveActuals?.deltas.grossProfitRatePt;

  const deptTargetMap:   Record<string, number> = {};
  const deptGpTargetMap: Record<string, number> = {};
  if (effectiveSettings?.department_targets?.length) {
    effectiveSettings.department_targets.forEach((d) => {
      deptTargetMap[d.department_name]   = d.target_revenue;
      deptGpTargetMap[d.department_name] = d.target_gross_profit;
    });
  }

  const totalRevenue          = deptActuals.reduce((s, d) => s + d.revenue, 0);
  const totalGrossProfitActual = deptActuals.reduce((s, d) => s + d.grossProfit, 0);

  // ── 予備費（非表示%）──────────────────────────────────────────────
  // 会社指定の予備費率で売上から控除額を算出。通常時は利益から控除して保守表示し、
  // 決算で戻す（reserve_released=true）と実値に戻る。管理者は実値トグルで一時的に確認可。
  const reserveRate     = effectiveSettings?.reserve_fee_rate ?? 0;
  const reserveReleased = effectiveSettings?.reserve_released ?? false;
  const reserveAmount   = Math.round(totalRevenue * reserveRate);
  // 控除中か（率>0 かつ 未決算 かつ 実値トグルOFF）
  const reserveActive   = reserveRate > 0 && !reserveReleased && !showActualReserve;
  const totalGrossProfit = totalGrossProfitActual - (reserveActive ? reserveAmount : 0);

  const grossProfitRate  = pct(totalGrossProfit, totalRevenue);
  const achieveRateTotal = pct(totalRevenue, targetRevenueForCalc);
  const grossProfitTotal = totalGrossProfit - overheadForCalc;
  const gptRate          = pct(grossProfitTotal, totalRevenue);
  const operatingProfit  = grossProfitTotal - sgaForCalc;
  const opRate           = pct(operatingProfit, totalRevenue);

  const monthlyComboDataRaw = (() => {
    let cum = 0;
    return monthlyActuals.map((m, i) => {
      const alloc = resolveMonthlyAllocation(
        i,
        monthlyOverheadAllocations,
        settingsConfigured,
        overheadForCalc,
      );
      const grossProfitTotal = m.grossProfit - alloc;
      cum += grossProfitTotal;
      return {
        month: m.month,
        粗利額: m.grossProfit,
        月次予定配賦: alloc > 0 ? -alloc : 0,
        累計: cum,
      };
    });
  })();

  const useTrendMock = useDashboardMock || shouldUseMonthlyTrendMock(monthlyActuals, monthlyComboDataRaw);
  const monthlyComboData = useDashboardMock
    ? buildBiDashboardMonthlyCombo(fiscalMonthStart)
    : useTrendMock
      ? buildRealisticMonthlyComboData(
          monthlyActuals,
          totalGrossProfit > 0 ? totalGrossProfit : 2400,
          settingsConfigured ? overheadForCalc : MOCK_OVERHEAD_BUDGET_MAN,
        )
      : monthlyComboDataRaw;

  const monthlyDetailRows = useTrendMock
    ? buildMonthlyDetailRowsFromCombo(monthlyComboData, forecastStartIndex, grossProfitRate)
    : buildMonthlyDetailRows(
        monthlyActuals,
        monthlyOverheadAllocations,
        settingsConfigured,
        overheadForCalc,
        forecastStartIndex,
      );

  // 月別推移パネルの判断用サマリー（グラフがモックのときはグラフと同じ系列を参照）
  const trendSummarySource = useTrendMock ? monthlyComboData : null;
  const lastActualCumulative = (() => {
    if (trendSummarySource) {
      const idx = Math.min(forecastStartIndex, trendSummarySource.length) - 1;
      return idx >= 0 ? trendSummarySource[idx].累計 : 0;
    }
    let last = 0;
    for (const r of monthlyDetailRows) {
      if (r.kind === "actual" && r.hasActivity) last = r.cumulative;
    }
    return last;
  })();
  const trendGrossProfitTotal = useTrendMock
    ? monthlyComboData.reduce((s, r) => s + r.粗利額, 0)
    : totalGrossProfit;
  // 損益分岐点まで＝年間間接費 − 累計粗利（>0でまだ未達、<=0で超過）
  const breakevenGap = overheadForCalc - trendGrossProfitTotal;

  // ── 昨対比較（売上・月次/累計） ──────────────────────────────────
  const prevMonthly = effectivePrevActuals?.monthly ?? makeFallbackMonthly(fiscalMonthStart);
  const hasPrevData = effectivePrevActuals?.hasData ?? false;
  // 過去年度を選択中は全月が実績。当年度のみ未到来月を除外
  const isCurrentFY = fiscalYear === getCurrentFiscalYear(fiscalMonthStart);
  const yoyActualEndIdx = isCurrentFY ? forecastStartIndex : 12;

  const yoyRows = (() => {
    let curCum = 0;
    let prevCum = 0;
    return monthlyActuals.map((m, i) => {
      const prevRev = prevMonthly[i]?.revenue ?? 0;
      const isFuture = i >= yoyActualEndIdx;
      if (!isFuture) curCum += m.revenue;
      prevCum += prevRev;
      return {
        month: m.month,
        isFuture,
        current: m.revenue,
        prev: prevRev,
        currentCum: curCum,
        prevCum,
        monthlyRatio: !isFuture && prevRev > 0 ? r1((m.revenue / prevRev) * 100) : null,
        cumulativeRatio: !isFuture && prevCum > 0 ? r1((curCum / prevCum) * 100) : null,
      };
    });
  })();

  const curAnnualRevenue = yoyRows.length > 0 ? yoyRows[yoyActualEndIdx - 1]?.currentCum ?? 0 : 0;
  const prevAnnualRevenue = prevMonthly.reduce((s, m) => s + m.revenue, 0);
  const annualYoYRatio = prevAnnualRevenue > 0 ? r1((curAnnualRevenue / prevAnnualRevenue) * 100) : null;

  // 月次モード: 当月棒＋期首からの累計線（例: 6月表示で4〜5月累計と6月が同時に見える）
  const yoyChartData = yoyRows.map((row) => {
    if (yoyMode === "cumulative") {
      return {
        month: row.month,
        当期: row.isFuture ? 0 : row.currentCum,
        前期: row.prevCum,
        当期累計: 0,
      };
    }
    return {
      month: row.month,
      当期: row.isFuture ? 0 : row.current,
      前期: row.prev,
      当期累計: row.isFuture ? 0 : row.currentCum,
    };
  });

  const yoyRatioClass = (ratio: number | null) =>
    ratio == null ? "text-muted-foreground" : ratio >= 100 ? "text-[var(--brand-dark)]" : "text-rose-500";
  const fmtRatio = (ratio: number | null) => (ratio == null ? "—" : `${ratio}%`);

  // 部門別昨対比: 前年度の部門実績を部門名でマッチング
  const prevDeptMap = new Map(
    (effectivePrevActuals?.deptActuals ?? []).map((d) => [d.name, d]),
  );
  const deptYoY = (name: string, currentRevenue: number) => {
    const prevRev = prevDeptMap.get(name)?.revenue ?? 0;
    return {
      prevRevenue: prevRev,
      ratio: prevRev > 0 ? r1((currentRevenue / prevRev) * 100) : null,
    };
  };
  const prevDeptTotalRevenue = (effectivePrevActuals?.deptActuals ?? []).reduce((s, d) => s + d.revenue, 0);
  const deptTotalYoYRatio = prevDeptTotalRevenue > 0 ? r1((totalRevenue / prevDeptTotalRevenue) * 100) : null;

  const deptCards = deptActuals.map((d, i) => {
    const target = deptTargetMap[d.name] ?? null;
    const gpTarget = deptGpTargetMap[d.name] ?? null;
    const rate = target != null && target > 0 ? pct(d.revenue, target) : 0;
    const gpRate = pct(d.grossProfit, d.revenue);
    const deptSga = totalRevenue > 0 ? Math.round(sgaForCalc * (d.revenue / totalRevenue)) : 0;
    const deptOp = d.grossProfit - deptSga;
    const yoy = deptYoY(d.name, d.revenue);
    return {
      id: d.name,
      name: d.name,
      label: d.label,
      revenue: d.revenue,
      grossProfit: d.grossProfit,
      target,
      gpTarget,
      achieveRate: rate,
      yoyRatio: yoy.ratio,
      prevRevenue: yoy.prevRevenue,
      gpRate,
      deptSga,
      deptOp,
      color: DEPT_CHART_COLORS[i % DEPT_CHART_COLORS.length],
    };
  });

  // ── カード並び順（部門カードは動的IDで追加）──────────────────────
  const deptCardIds = deptCards.map((d) => `dept:${d.id}`);
  const defaultCardOrder = [
    "kpi-revenue", "kpi-achieve", "kpi-op",
    "sub-gross", "sub-cum", "sub-overhead", "sub-yoy",
    "pnl", "monthly", "yoy",
    "dept-donut",
    ...deptCardIds,
    "forecast", "prospects",
  ];
  const deptIdsKey = deptCardIds.join("|");
  useEffect(() => {
    const def = [
      "kpi-revenue", "kpi-achieve", "kpi-op",
      "sub-gross", "sub-cum", "sub-overhead", "sub-yoy",
      "pnl", "monthly", "yoy",
      "dept-donut",
      ...deptIdsKey.split("|").filter(Boolean),
      "forecast", "prospects",
    ];
    setCardOrder(loadCardOrder(def));
  }, [deptIdsKey]);
  const effectiveCardOrder = cardOrder.length > 0 ? cardOrder : defaultCardOrder;

  const sparkRevenue = sparklines?.revenue ?? monthlyActuals.map((m) => m.revenue);
  const sparkGp = sparklines?.grossProfitTotal ?? monthlyComboData.map((r) => Number(r.粗利額 ?? 0));
  const sparkOp = sparklines?.operatingProfit ?? sparkGp;
  const sparkRate = sparklines?.grossProfitRate ?? monthlyActuals.map((m) => pct(m.grossProfit, m.revenue || 1));

  const deptDonutData = deptCards
    .filter((d) => d.revenue > 0)
    .map((d) => ({ label: d.name, value: d.revenue, color: d.color }));

  // 部門カード内の実績/目標ミニバーは全部門共通スケールで比較可能にする
  const deptBarMax = Math.max(
    1,
    ...deptCards.map((d) => Math.max(d.revenue, d.target ?? 0)),
  );

  const prospectBars = (effectiveProspectSummary?.rows ?? []).map((row, i) => ({
    label: `見込 ${row.grade}`,
    values: [row.weightedRevenue],
    color: DEPT_CHART_COLORS[i % DEPT_CHART_COLORS.length],
  }));

  const contractedTier = forecastTiers.find((t) => t.id === "contracted") ?? forecastTiers[0];
  const prospectiveTier = forecastTiers.find((t) => t.id === "prospective") ?? forecastTiers[1] ?? forecastTiers[0];

  // 部門構成用カラー（株主向けに青系で統一）
  const execDonut = deptCards
    .filter((d) => d.revenue > 0)
    .map((d, i) => ({ label: d.name, value: d.revenue, color: DEPT_CHART_COLORS[i % DEPT_CHART_COLORS.length] }));

  // 月別ストリーム用: 月次粗利を部門構成で積み上げ（波を部門ごとにずらして立体感を出す）
  const streamSeriesKeys = deptCards.map((d) => d.name);
  const monthlyStreamData = monthlyComboData.map((row, i) => {
    const base = Math.max(0, Number(row.粗利額 ?? 0));
    const weights = deptCards.map((d, di) => {
      const share = totalRevenue > 0 ? d.revenue / totalRevenue : 1 / Math.max(deptCards.length, 1);
      const wobble = 0.35 + 1.35 * Math.abs(Math.sin((i + 1.2) * (di + 1.4) * 0.85));
      return Math.max(share * wobble, 0.04);
    });
    const wSum = weights.reduce((s, w) => s + w, 0) || 1;
    const point: Record<string, string | number> = { month: row.month };
    let allocated = 0;
    deptCards.forEach((d, di) => {
      const v = di === deptCards.length - 1
        ? Math.max(0, base - allocated)
        : Math.round(base * (weights[di] / wSum));
      allocated += v;
      point[d.name] = v;
    });
    return point;
  });
  const streamPalette = [
    { color: brand.dark, colorEnd: brandHex },
    { color: brandHex, colorEnd: brand.mid },
    { color: brand.mid, colorEnd: brand.light },
    { color: brand.light, colorEnd: brand.accent },
  ];

  const remainToTarget = targetRevenue != null && targetRevenue > 0
    ? Math.max(0, targetRevenue - totalRevenue)
    : null;

  return (
    <div className="min-h-screen">
      <div className="p-5 md:p-7 space-y-5 max-w-[1500px] mx-auto">

        {/* ヘッダー */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] uppercase" style={{ color: CHART_PRIMARY }}>Executive Overview</p>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-1" style={{ color: "#0f172a" }}>
              全社ダッシュボード
            </h1>
            <p className="text-sm mt-1 font-medium" style={{ color: "#64748b" }}>{fiscalYearLabel(fiscalYear)} · 経営・株主向けサマリー</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(fiscalYear)} onValueChange={(v) => setFiscalYear(Number(v))}>
              <SelectTrigger className="w-[128px] h-10 text-sm rounded-xl border-0 bg-white shadow-[0_4px_14px_-6px_rgba(var(--brand-dark-rgb),0.16)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fiscalYearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{fiscalYearLabel(y)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-10 gap-1.5 text-sm px-3.5 rounded-xl border-0 bg-white shadow-[0_4px_14px_-6px_rgba(var(--brand-dark-rgb),0.16)]"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 className="h-4 w-4" />期首設定
            </Button>
          </div>
        </div>

        <BiSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          fiscalYear={fiscalYear}
          onSaved={loadBiData}
        />

        {reserveRate > 0 && (
          <div className={cn(
            "rounded-2xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 bg-white/95 text-sm",
            reserveReleased ? "border-emerald-200" : "border-amber-200",
          )}>
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className={cn("h-4 w-4 shrink-0", reserveReleased ? "text-emerald-600" : "text-amber-600")} />
              <span className={reserveReleased ? "text-emerald-800" : "text-amber-800"}>
                {reserveReleased
                  ? `予備費 ${fmtMan(reserveAmount)} を利益計上済み`
                  : reserveActive
                    ? `予備費 ${fmtMan(reserveAmount)} を控除して表示中（${r1(reserveRate * 100)}%）`
                    : `実値表示中（予備費 ${fmtMan(reserveAmount)}）`}
              </span>
            </div>
            {canManageReserve && (
              <div className="flex items-center gap-2 shrink-0">
                {!reserveReleased && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowActualReserve((v) => !v)}>
                    {showActualReserve ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {showActualReserve ? "控除後に戻す" : "実値を表示"}
                  </Button>
                )}
                <Button
                  variant={reserveReleased ? "outline" : "default"}
                  size="sm"
                  className={cn("h-8 gap-1.5 text-xs", !reserveReleased && "bg-emerald-600 hover:bg-emerald-700")}
                  disabled={releasingReserve}
                  onClick={() => void handleToggleReserveRelease(!reserveReleased)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {reserveReleased ? "取消" : "決算戻し"}
                </Button>
              </div>
            )}
          </div>
        )}

        <DndContext sensors={cardSensors} collisionDetection={closestCenter} onDragEnd={handleCardDragEnd}>
          <SortableContext items={effectiveCardOrder} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-12 gap-4">
              {effectiveCardOrder.map((cardId) => (
                <SortableCard key={cardId} id={cardId} className={BI2_CARD_SPAN[cardId] ?? DEPT_CARD_SPAN}>
                  {cardId === "kpi-revenue" && (
                    <div className="h-full rounded-2xl bg-white p-6 shadow-[0_10px_32px_-12px_rgba(var(--brand-dark-rgb),0.18)] ring-1 ring-[rgba(var(--brand-accent-rgb),0.85)] flex items-center gap-5">
                      <div
                        className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ background: `linear-gradient(145deg, ${CHART_MID}, ${CHART_DARK})` }}
                      >
                        <TrendingUp className="h-7 w-7 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold" style={{ color: "#64748b" }}>売上高</p>
                        <p className="text-4xl md:text-[2.75rem] font-black tabular-nums leading-none mt-1.5 tracking-tight" style={{ color: "#0f172a" }}>
                          {fmtMan(totalRevenue)}
                        </p>
                        <p className="text-sm mt-2 font-medium" style={{ color: "#64748b" }}>
                          目標 {fmtTargetMan(targetRevenue)}
                          {remainToTarget != null && remainToTarget > 0 ? ` · あと ${fmtMan(remainToTarget)}` : ""}
                        </p>
                      </div>
                    </div>
                  )}

                  {cardId === "kpi-achieve" && (
                    <div className="h-full rounded-2xl bg-white p-5 shadow-[0_10px_32px_-12px_rgba(var(--brand-dark-rgb),0.18)] ring-1 ring-[rgba(var(--brand-accent-rgb),0.85)] flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4" style={{ color: CHART_PRIMARY }} />
                          <p className="text-sm font-semibold" style={{ color: "#64748b" }}>目標達成率</p>
                        </div>
                        <p className="text-4xl font-black tabular-nums leading-none mt-3 tracking-tight" style={{ color: "#0f172a" }}>
                          {achieveRateTotal}%
                        </p>
                        <p className="text-sm mt-2 font-medium" style={{ color: "#64748b" }}>対年間売上目標</p>
                      </div>
                      <ProgressRing rate={achieveRateTotal} label="達成" color={CHART_PRIMARY} size={118} />
                    </div>
                  )}

                  {cardId === "kpi-op" && (
                    <div className="h-full rounded-2xl bg-white p-5 shadow-[0_10px_32px_-12px_rgba(var(--brand-dark-rgb),0.18)] ring-1 ring-[rgba(var(--brand-accent-rgb),0.85)] flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4" style={{ color: CHART_DARK }} />
                          <p className="text-sm font-semibold" style={{ color: "#64748b" }}>営業利益</p>
                        </div>
                        <p className={cn(
                          "text-4xl font-black tabular-nums leading-none mt-3 tracking-tight",
                          operatingProfit < 0 ? "text-rose-600" : "",
                        )} style={operatingProfit >= 0 ? { color: "#0f172a" } : undefined}>
                          {fmtSigned(operatingProfit)}
                        </p>
                        <p className="text-sm mt-2 font-medium" style={{ color: "#64748b" }}>
                          利益率 {r1(Math.abs(opRate))}% · 粗利率 {grossProfitRate}%
                        </p>
                      </div>
                      <ProgressRing
                        rate={grossProfitRate}
                        label="粗利率"
                        color={operatingProfit < 0 ? BI_NEGATIVE : CHART_DARK}
                        size={118}
                      />
                    </div>
                  )}

                  {cardId === "sub-gross" && (
                    <SubMetricCard
                      label="粗利額"
                      value={fmtMan(totalGrossProfit)}
                      hint={`率 ${grossProfitRate}%`}
                      icon={ArrowUpRight}
                      accent={CHART_ACCENT}
                      primary={CHART_PRIMARY}
                    />
                  )}

                  {cardId === "sub-cum" && (
                    <SubMetricCard
                      label="累計利益"
                      value={fmtSigned(lastActualCumulative)}
                      hint={settingsConfigured
                        ? (breakevenGap > 0 ? `分岐まで ${fmtMan(breakevenGap)}` : `分岐超過 +${fmtMan(Math.abs(breakevenGap))}`)
                        : "—"}
                      icon={TrendingUp}
                      accent={CHART_ACCENT}
                      primary={CHART_PRIMARY}
                    />
                  )}

                  {cardId === "sub-overhead" && (
                    <SubMetricCard
                      label="固定費"
                      value={settingsConfigured ? fmtMan(overheadForCalc) : "未設定"}
                      hint="製造間接費"
                      icon={Target}
                      accent={CHART_ACCENT}
                      primary={CHART_PRIMARY}
                    />
                  )}

                  {cardId === "sub-yoy" && (
                    <SubMetricCard
                      label="昨対（売上）"
                      value={fmtRatio(annualYoYRatio)}
                      hint={`${fiscalYearLabel(fiscalYear - 1)}比`}
                      icon={Briefcase}
                      accent={CHART_ACCENT}
                      primary={CHART_PRIMARY}
                    />
                  )}

                  {cardId === "pnl" && (
                    <div
                      className="h-full rounded-2xl p-7 text-white shadow-[0_14px_36px_-14px_rgba(var(--brand-dark-rgb),0.45)] flex flex-col min-h-[360px]"
                      style={{ background: `linear-gradient(165deg, ${CHART_DARK} 0%, ${CHART_PRIMARY} 55%, ${CHART_MID} 140%)` }}
                    >
                      <p className="text-base font-bold text-white/85">損益フロー</p>
                      <p className="text-sm text-white/60 mt-1.5">上から引いていくと最終利益になります</p>
                      <div className="mt-6 space-y-0 flex-1">
                        {[
                          { label: "売上", value: fmtMan(totalRevenue) },
                          { label: "粗利", value: fmtMan(totalGrossProfit) },
                          { label: "固定費", value: settingsConfigured ? `−${fmtMan(overheadForCalc)}` : "未設定", dim: true },
                          { label: "売上総利益", value: fmtSigned(grossProfitTotal) },
                          { label: "販管費", value: settingsConfigured ? `−${fmtMan(sgaForCalc)}` : "未設定", dim: true },
                        ].map((row, i) => (
                          <div
                            key={row.label}
                            className={cn(
                              "flex items-center justify-between gap-3 py-3.5",
                              i > 0 && "border-t border-white/15",
                              row.dim && "text-rose-100",
                            )}
                          >
                            <span className="text-base font-medium text-white/90">{row.label}</span>
                            <span className="text-2xl font-bold tabular-nums tracking-tight">{row.value}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-5 rounded-xl bg-white/15 backdrop-blur px-5 py-4 border border-white/20">
                        <p className="text-sm font-semibold text-white/75">営業利益</p>
                        <p className="text-4xl font-black tabular-nums mt-1.5 tracking-tight">{fmtSigned(operatingProfit)}</p>
                      </div>
                    </div>
                  )}

                  {cardId === "monthly" && (
                    <ExecCard
                      className="h-full"
                      title="月別推移（全社）"
                      right={
                        <Segmented
                          value={monthlyView}
                          onChange={setMonthlyView}
                          options={[
                            { value: "chart", label: "グラフ" },
                            { value: "table", label: "表" },
                          ]}
                        />
                      }
                    >
                      <div className="flex flex-wrap gap-x-6 gap-y-1 mb-1.5 text-sm" style={{ color: "#64748b" }}>
                        <span>累計利益 <b className="tabular-nums" style={{ color: "#0f172a" }}>{fmtSigned(lastActualCumulative)}</b></span>
                        <span>
                          {settingsConfigured ? (breakevenGap > 0 ? "分岐まで" : "分岐超過") : "分岐"}{" "}
                          <b className="tabular-nums" style={{ color: !settingsConfigured ? "#64748b" : breakevenGap > 0 ? "#d97706" : "#059669" }}>
                            {!settingsConfigured ? "—" : breakevenGap > 0 ? fmtMan(breakevenGap) : `+${fmtMan(Math.abs(breakevenGap))}`}
                          </b>
                        </span>
                        <span>粗利 / 固定費 <b className="tabular-nums" style={{ color: "#0f172a" }}>{fmtMan(trendGrossProfitTotal)}</b> / {settingsConfigured ? fmtMan(overheadForCalc) : "—"}</span>
                      </div>
                      {monthlyView === "chart" ? (
                        <div className="h-[360px]">
                          <TrendAreaChart
                            stacked
                            variant="overview"
                            data={monthlyStreamData}
                            labelKey="month"
                            height={340}
                            unit="万"
                            forecastFromIndex={forecastStartIndex}
                            forecastZoneLabel="着地予測領域"
                            xSubLabel={(i) =>
                              forecastStartIndex != null && i >= forecastStartIndex ? "予測" : "実績"
                            }
                            series={streamSeriesKeys.map((key, i) => ({
                              key,
                              label: key,
                              color: streamPalette[i % streamPalette.length].color,
                              colorEnd: streamPalette[i % streamPalette.length].colorEnd,
                            }))}
                            formatValue={(v) => `¥${Math.abs(Math.round(v)).toLocaleString()}万`}
                          />
                        </div>
                      ) : (
                        <div className="overflow-x-auto max-h-[340px]">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b text-xs" style={{ background: CHART_ACCENT, color: "#64748b" }}>
                                {["月", "売上", "粗利", "間接費", "月次利益", "累計"].map((h) => (
                                  <th key={h} className={cn("py-2.5 font-semibold", h === "月" ? "text-left px-3" : "text-right px-3")}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {monthlyDetailRows.map((row, i) => {
                                if (row.kind === "forecast") {
                                  return (
                                    <tr key={`f-${i}`} className="border-b opacity-45">
                                      <td className="px-3 py-2 italic" style={{ color: "#64748b" }}>{row.label}</td>
                                      <td colSpan={5} className="px-3 py-2 text-right" style={{ color: "#64748b" }}>—</td>
                                    </tr>
                                  );
                                }
                                return (
                                  <tr key={`${row.label}-${i}`} className="border-b last:border-0">
                                    <td className="px-3 py-2 font-semibold whitespace-nowrap" style={{ color: "#0f172a" }}>{row.label}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{row.hasActivity ? fmtMan(row.revenue) : "—"}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{row.hasActivity ? fmtMan(row.grossProfit) : "—"}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-rose-500">{fmtMonthlyAlloc(row.allocation, settingsConfigured)}</td>
                                    <td className={cn("px-3 py-2 text-right tabular-nums font-bold", row.hasActivity && row.grossProfitTotal < 0 && "text-rose-500")}>
                                      {row.hasActivity ? fmtSigned(row.grossProfitTotal) : "—"}
                                    </td>
                                    <td className={cn("px-3 py-2 text-right tabular-nums font-bold", row.hasActivity && row.cumulative < 0 && "text-rose-500")}>
                                      {row.hasActivity ? fmtSigned(row.cumulative) : "—"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </ExecCard>
                  )}

                  {cardId === "yoy" && (
                    <ExecCard
                      className="h-full"
                      title="昨対比較"
                      right={
                        <Segmented
                          value={yoyMode}
                          onChange={setYoyMode}
                          options={[
                            { value: "cumulative", label: "累計" },
                            { value: "monthly", label: "月次" },
                          ]}
                        />
                      }
                    >
                      <div className="h-[280px] md:h-[300px]">
                        <ComboChart
                          thickBars
                          data={yoyChartData}
                          labelKey="month"
                          height={290}
                          unit="万"
                          forecastFromIndex={isCurrentFY ? forecastStartIndex : undefined}
                          forecastZoneLabel="未到来月"
                          gridColor="rgba(var(--brand-accent-rgb),0.9)"
                          labelColor={"#64748b"}
                          tickColor="#94a8c0"
                          bars={[
                            { key: "当期", label: "当期", fill: CHART_DARK },
                            { key: "前期", label: "前期", fill: CHART_MID },
                          ]}
                          line={yoyMode === "monthly" ? { key: "当期累計", label: "当期累計", color: CHART_PRIMARY } : undefined}
                          lineArea={yoyMode === "monthly"}
                          groupAnnotations={yoyRows.map((row) => {
                            const ratio = yoyMode === "cumulative" ? row.cumulativeRatio : row.monthlyRatio;
                            if (row.isFuture || ratio == null) return null;
                            return { text: `${ratio}%`, color: ratio >= 100 ? CHART_DARK : BI_NEGATIVE };
                          })}
                          formatValue={(v) => `¥${Math.abs(v).toLocaleString()}万`}
                        />
                      </div>
                    </ExecCard>
                  )}

                  {cardId === "dept-donut" && (
                    <ExecCard className="h-full" title="部門構成">
                      {execDonut.length > 0 ? (
                        <div className="h-[320px]">
                          <DonutChart
                            largeLegend
                            data={execDonut}
                            height={310}
                            innerRadius={85}
                            outerRadius={130}
                            labelFontSize={14}
                            formatValue={(v) => fmtMan(v)}
                            labelColor={"#475569"}
                          />
                        </div>
                      ) : (
                        <p className="text-sm py-12 text-center" style={{ color: "#64748b" }}>データなし</p>
                      )}
                      <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm font-semibold mt-1" style={{ color: "#64748b" }}>
                        <span>全社 {fmtMan(totalRevenue)}</span>
                        <span>昨対 {fmtRatio(deptTotalYoYRatio)}</span>
                        <span>粗利 {fmtMan(totalGrossProfit)}</span>
                      </div>
                    </ExecCard>
                  )}

                  {cardId.startsWith("dept:") && (() => {
                    const d = deptCards.find((dc) => `dept:${dc.id}` === cardId);
                    if (!d) return null;
                    const color = d.color;
                    const revenueBarPct = Math.min(100, (d.revenue / deptBarMax) * 100);
                    const targetBarPct = d.target != null ? Math.min(100, (d.target / deptBarMax) * 100) : 0;
                    return (
                      <div className="h-full rounded-2xl bg-white p-4 shadow-[0_8px_28px_-10px_rgba(var(--brand-dark-rgb),0.16)] ring-1 ring-[rgba(var(--brand-accent-rgb),0.85)] flex flex-col">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="h-3 w-3 rounded-full shrink-0" style={{ background: color }} />
                            <p className="font-bold text-slate-900 truncate">{d.name}</p>
                          </div>
                          <span className={cn("text-xs font-bold tabular-nums shrink-0", yoyRatioClass(d.yoyRatio))}>
                            昨対 {fmtRatio(d.yoyRatio)}
                          </span>
                        </div>

                        <p className="text-2xl font-black tabular-nums tracking-tight mt-3 text-slate-900">
                          {fmtMan(d.revenue)}
                        </p>

                        {/* 実績 vs 目標（全部門共通スケール） */}
                        <div className="mt-3 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-slate-500 w-6 shrink-0">実績</span>
                            <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(var(--brand-accent-rgb),0.35)" }}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${revenueBarPct}%`, background: color }} />
                            </div>
                            <span className="text-[11px] font-bold tabular-nums text-slate-700 shrink-0 w-16 text-right">{fmtMan(d.revenue)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-slate-500 w-6 shrink-0">目標</span>
                            <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(var(--brand-accent-rgb),0.35)" }}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${targetBarPct}%`, background: CHART_MID }} />
                            </div>
                            <span className="text-[11px] font-bold tabular-nums text-slate-500 shrink-0 w-16 text-right">{d.target != null ? fmtMan(d.target) : "未設定"}</span>
                          </div>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-xs font-semibold">
                          <span style={{ color: CHART_PRIMARY }}>
                            達成 {d.target != null ? `${d.achieveRate}%` : "—"}
                          </span>
                          <span className="text-slate-500">粗利率 {d.gpRate}%</span>
                        </div>

                        <div
                          className="mt-auto pt-3"
                        >
                          <div className="rounded-xl px-3 py-2.5 flex items-center justify-between" style={{ background: "rgba(var(--brand-accent-rgb),0.4)" }}>
                            <span className="text-xs font-semibold text-slate-600">粗利額</span>
                            <span className="text-base font-black tabular-nums text-slate-900">{fmtMan(d.grossProfit)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {cardId === "forecast" && (
                    <ExecCard className="h-full" title="着地予測">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { title: "契約済着地", tier: contractedTier },
                          { title: "A見込含", tier: prospectiveTier },
                        ].map(({ title, tier }) => {
                          if (!tier) return null;
                          const op = tier.grossProfit - overheadForCalc - sgaForCalc;
                          return (
                            <div
                              key={title}
                              className="rounded-2xl bg-white px-4 py-4 shadow-[0_6px_20px_-10px_rgba(var(--brand-dark-rgb),0.18)] ring-1 ring-[rgba(var(--brand-accent-rgb),0.9)]"
                            >
                              <p className="text-xs font-bold" style={{ color: "#64748b" }}>{title}</p>
                              <p className="text-2xl font-black tabular-nums mt-2 tracking-tight" style={{ color: "#0f172a" }}>{fmtMan(tier.revenue)}</p>
                              <p className={cn("text-sm font-semibold mt-2 tabular-nums", op < 0 ? "text-rose-500" : "")} style={op >= 0 ? { color: CHART_PRIMARY } : undefined}>
                                営利 {fmtSigned(op)} · {pct(tier.revenue, targetRevenueForCalc)}%
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </ExecCard>
                  )}

                  {cardId === "prospects" && (
                    <ExecCard
                      className="h-full"
                      title="見込み売上（期待値）"
                      right={
                        <div className="flex items-center gap-2">
                          <Switch
                            id="include-special-exec"
                            checked={includeSpecial}
                            onCheckedChange={setIncludeSpecial}
                            disabled={!effectiveProspectSummary?.hasSpecial}
                          />
                          <Label
                            htmlFor="include-special-exec"
                            className={cn("text-xs cursor-pointer font-medium", effectiveProspectSummary?.hasSpecial ? "" : "opacity-50")}
                            style={{ color: "#64748b" }}
                          >
                            特需
                          </Label>
                        </div>
                      }
                    >
                      <div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-[rgba(var(--brand-accent-rgb),0.85)] shadow-[0_6px_20px_-10px_rgba(var(--brand-dark-rgb),0.14)]">
                        <HorizontalBarChart
                          data={[
                            ...prospectBars.map((p) => ({ label: p.label, values: p.values })),
                            ...(includeSpecial && effectiveProspectSummary?.hasSpecial
                              ? [{ label: "特需", values: [effectiveProspectSummary.special.weightedRevenue] }]
                              : []),
                          ]}
                          series={[{ label: "期待値", color: CHART_PRIMARY }]}
                          formatValue={(v) => `¥${v.toLocaleString()}万`}
                          labelColor={"#64748b"}
                        />
                      </div>
                      <div className="mt-3 rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: CHART_ACCENT }}>
                        <span className="text-sm font-semibold" style={{ color: "#64748b" }}>期待値合計</span>
                        <b className="text-xl font-black tabular-nums" style={{ color: CHART_DARK }}>
                          ¥{(includeSpecial
                            ? (effectiveProspectSummary?.totalWeightedWithSpecial ?? 0)
                            : (effectiveProspectSummary?.totalWeighted ?? 0)
                          ).toLocaleString()}万
                        </b>
                      </div>
                    </ExecCard>
                  )}
                </SortableCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>

      </div>
    </div>
  );
}
