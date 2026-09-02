"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, EyeOff } from "lucide-react";
import {
  getBiDepartmentProjects,
  getBiLocationProjects,
  type BiDepartmentProject,
} from "@/lib/actions/bi";
import { getDepartmentMarginRates } from "@/lib/actions/deals";
import { buildBiDepartmentProjectsMock } from "@/lib/bi-mock-data";
import { useAuth } from "@/components/providers/auth-provider";
import { useCompanyPermissions } from "@/hooks/use-company-permissions";
import { permissionRoleSlugs } from "@/lib/role-assignment";
import { fiscalYearLabel, DEFAULT_FISCAL_MONTH_START } from "@/lib/bi-utils";
import { cn } from "@/lib/utils";

const CUSTOMER_NAME_HIDDEN = "（非表示）";

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

/** 表示用の期間ラベル（期首〜今日、または期首〜期末） */
function periodLabel(fiscalYear: number, fiscalMonthStart: number): string {
  const start = new Date(fiscalYear, fiscalMonthStart - 1, 1);
  const endExclusive = new Date(fiscalYear + 1, fiscalMonthStart - 1, 1);
  const fyEnd = new Date(endExclusive.getTime() - 86400000);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = today < fyEnd && today >= start ? today : fyEnd;
  return `${fiscalYearLabel(fiscalYear)}（${formatYmd(start)}～${formatYmd(end)}）`;
}

/**
 * 部門クリックで右からスライドインする 案件/工事一覧パネル（No.75）。
 * 顧客名は権限マトリクス「BI顧客名表示」(bi_customer_name) で制御（No.84・実データはサーバー側でマスク）。
 */
export function BiDepartmentProjectsSheet({
  departmentName,
  locationId = null,
  departmentLabel,
  displayName,
  fiscalYear,
  fiscalMonthStart = DEFAULT_FISCAL_MONTH_START,
  useMock,
  /** 部門の売上達成率（%） */
  achieveRate,
  /** 部門カード側の売上・粗利（KPI用・万円） */
  deptRevenue,
  deptGrossProfit,
  fmtMan,
  onClose,
}: {
  /** 部門名。拠点モード時は null */
  departmentName: string | null;
  /** 拠点ID。部門モード時は null（No.80） */
  locationId?: string | null;
  departmentLabel?: string | null;
  /** タイトル用の表示名（拠点名など） */
  displayName?: string | null;
  fiscalYear: number;
  fiscalMonthStart?: number;
  /** BI 本体がモック表示の年度か（同じ見た目のモック行を出す） */
  useMock: boolean;
  achieveRate?: number | null;
  deptRevenue?: number | null;
  deptGrossProfit?: number | null;
  /** 万円値のフォーマッタ（表示単位切替に追従） */
  fmtMan: (v: number) => string;
  onClose: () => void;
}) {
  const { role, profile } = useAuth();
  const { canAccess } = useCompanyPermissions();
  const roleSlugs = permissionRoleSlugs(profile ?? { role });
  const [rows, setRows] = useState<BiDepartmentProject[]>([]);
  const [canViewCustomer, setCanViewCustomer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [standardMarginRate, setStandardMarginRate] = useState<number | null>(null);
  const openKey = departmentName ?? locationId;
  const isLocation = Boolean(locationId);

  useEffect(() => {
    if (!departmentName) {
      setStandardMarginRate(null);
      return;
    }
    let cancelled = false;
    getDepartmentMarginRates()
      .then((list) => {
        if (cancelled) return;
        const hit = list.find((d) => d.department_name === departmentName);
        setStandardMarginRate(hit ? hit.margin_rate_percent : null);
      })
      .catch(() => {
        if (!cancelled) setStandardMarginRate(null);
      });
    return () => {
      cancelled = true;
    };
  }, [departmentName]);

  useEffect(() => {
    if (!openKey) return;
    let cancelled = false;

    if (useMock) {
      const canView = roleSlugs.length ? canAccess("bi_customer_name", roleSlugs) : false;
      setCanViewCustomer(canView);
      const mockKey = departmentName ?? displayName ?? openKey;
      setRows(
        buildBiDepartmentProjectsMock(mockKey).map((r) => ({
          ...r,
          customerName: canView ? r.customerName : CUSTOMER_NAME_HIDDEN,
        })),
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    const fetch = isLocation
      ? getBiLocationProjects(locationId!, fiscalYear)
      : getBiDepartmentProjects(departmentName!, fiscalYear);
    fetch
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows);
        setCanViewCustomer(res.canViewCustomer);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [openKey, departmentName, locationId, displayName, fiscalYear, useMock, role, isLocation, canAccess]);

  const tableRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const tableGp = rows.reduce((s, r) => s + r.grossProfit, 0);
  const summaryRevenue = deptRevenue ?? tableRevenue;
  const summaryGp = deptGrossProfit ?? tableGp;
  const summaryGpRate = summaryRevenue > 0
    ? Math.round((summaryGp / summaryRevenue) * 1000) / 10
    : 0;
  const threshold = standardMarginRate ?? 50;
  const belowCount = rows.filter((r) => r.grossProfitRate < threshold - 1e-9).length;
  const titleName = displayName ?? departmentName;
  const titleLabel = [titleName, departmentLabel].filter(Boolean).join(" ");

  return (
    <Sheet open={!!openKey} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-1">
          <SheetTitle>{titleLabel}</SheetTitle>
          <SheetDescription>
            案件一覧　{periodLabel(fiscalYear, fiscalMonthStart)}
            {isLocation ? <span className="ml-1 text-[11px]">※拠点別</span> : null}
          </SheetDescription>
          {!canViewCustomer && (
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <EyeOff className="h-3 w-3 shrink-0" />
              顧客名はご利用中のロールでは表示されません
            </p>
          )}
        </SheetHeader>

        <div className="px-4 pb-4 space-y-3">
          {/* サマリーKPI（No.75） */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-lg border bg-muted/20 px-2.5 py-2">
              <p className="text-[10px] text-muted-foreground leading-tight">売上</p>
              <p className="text-sm font-bold tabular-nums mt-0.5">{fmtMan(summaryRevenue)}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 px-2.5 py-2">
              <p className="text-[10px] text-muted-foreground leading-tight">粗利率（工事）</p>
              <p className="text-sm font-bold tabular-nums mt-0.5 text-emerald-700">{summaryGpRate.toFixed(1)}%</p>
            </div>
            <div className="rounded-lg border bg-muted/20 px-2.5 py-2">
              <p className="text-[10px] text-muted-foreground leading-tight">規定粗利率</p>
              <p className="text-sm font-bold tabular-nums mt-0.5">{threshold.toFixed(1)}%</p>
            </div>
            <div className="rounded-lg border bg-muted/20 px-2.5 py-2">
              <p className="text-[10px] text-muted-foreground leading-tight">目標達成</p>
              <p className="text-sm font-bold tabular-nums mt-0.5">
                {achieveRate != null ? `${Math.round(achieveRate)}%` : "—"}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-lg">
              この部門の案件データはありません
            </p>
          ) : (
            <>
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium whitespace-nowrap">顧客名</th>
                      <th className="text-left px-3 py-2 font-medium whitespace-nowrap">PJ名</th>
                      <th className="text-right px-3 py-2 font-medium whitespace-nowrap">売上</th>
                      <th className="text-right px-3 py-2 font-medium whitespace-nowrap">粗利率</th>
                      <th className="text-right px-3 py-2 font-medium whitespace-nowrap">工事粗利</th>
                      <th className="text-right px-3 py-2 font-medium whitespace-nowrap">原価</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const isLow = r.grossProfitRate < threshold - 1e-9;
                      return (
                        <tr
                          key={r.id}
                          className={cn(
                            "border-t",
                            isLow ? "bg-amber-50/80" : "hover:bg-muted/30",
                          )}
                        >
                          <td className={cn(
                            "px-3 py-2 whitespace-nowrap",
                            r.customerName === CUSTOMER_NAME_HIDDEN && "text-muted-foreground",
                          )}>
                            {r.customerName}
                          </td>
                          <td className="px-3 py-2 max-w-[200px] truncate" title={r.projectName}>
                            {r.projectName}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmtMan(r.revenue)}</td>
                          <td className={cn(
                            "px-3 py-2 text-right tabular-nums whitespace-nowrap font-medium",
                            isLow ? "text-amber-700" : "text-emerald-700",
                          )}>
                            {r.grossProfitRate.toFixed(1)}%
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold whitespace-nowrap">{fmtMan(r.grossProfit)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">{fmtMan(r.cost)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-muted/20 font-semibold">
                      <td className="px-3 py-2" colSpan={2}>合計（{rows.length}件）</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmtMan(tableRevenue)}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-emerald-700">
                        {tableRevenue > 0 ? `${Math.round((tableGp / tableRevenue) * 1000) / 10}%` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmtMan(tableGp)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                        {fmtMan(tableRevenue - tableGp)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {belowCount > 0 && (
                <p className="flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2 leading-relaxed">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    オレンジの{belowCount}件が規定粗利率 {threshold.toFixed(1)}% を下回っている案件です。
                    部門の粗利率が落ちたとき、原因の案件をここで特定できます。
                  </span>
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                ※工事粗利ベース。原価未入力の案件は会社設定の粗利率で概算しています。
              </p>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
