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
import { EyeOff } from "lucide-react";
import {
  getBiDepartmentProjects,
  type BiDepartmentProject,
} from "@/lib/actions/bi";
import { buildBiDepartmentProjectsMock } from "@/lib/bi-mock-data";
import { useAuth } from "@/components/providers/auth-provider";
import { fiscalYearLabel } from "@/lib/bi-utils";
import { cn } from "@/lib/utils";

/** 顧客名を表示できるロール（No.84） */
const CUSTOMER_NAME_VISIBLE_ROLES = ["hq_admin", "admin", "executive"];
const CUSTOMER_NAME_HIDDEN = "（非表示）";

/**
 * 部門クリックで右からスライドインする PJ（案件/工事）一覧パネル（No.75）。
 * 顧客名は hq_admin / admin / executive のみ表示（No.84・実データはサーバー側でマスク）。
 */
export function BiDepartmentProjectsSheet({
  departmentName,
  fiscalYear,
  useMock,
  fmtMan,
  onClose,
}: {
  /** null のときは閉じる */
  departmentName: string | null;
  fiscalYear: number;
  /** BI 本体がモック表示の年度か（同じ見た目のモック行を出す） */
  useMock: boolean;
  /** 万円値のフォーマッタ（表示単位切替に追従） */
  fmtMan: (v: number) => string;
  onClose: () => void;
}) {
  const { role } = useAuth();
  const [rows, setRows] = useState<BiDepartmentProject[]>([]);
  const [canViewCustomer, setCanViewCustomer] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!departmentName) return;
    let cancelled = false;

    if (useMock) {
      const canView = CUSTOMER_NAME_VISIBLE_ROLES.includes(role ?? "");
      setCanViewCustomer(canView);
      setRows(
        buildBiDepartmentProjectsMock(departmentName).map((r) => ({
          ...r,
          customerName: canView ? r.customerName : CUSTOMER_NAME_HIDDEN,
        })),
      );
      return;
    }

    setLoading(true);
    getBiDepartmentProjects(departmentName, fiscalYear)
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
  }, [departmentName, fiscalYear, useMock, role]);

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalGp = rows.reduce((s, r) => s + r.grossProfit, 0);

  return (
    <Sheet open={!!departmentName} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle>{departmentName} のPJ一覧</SheetTitle>
          <SheetDescription>
            {fiscalYearLabel(fiscalYear)} の案件/工事別の売上・粗利
            <span className="ml-1 text-[11px]">※工事粗利ベース</span>
          </SheetDescription>
          {!canViewCustomer && (
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <EyeOff className="h-3 w-3 shrink-0" />
              顧客名はご利用中のロールでは表示されません
            </p>
          )}
        </SheetHeader>

        <div className="px-4 pb-4">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-lg">
              この部門のPJデータはありません
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
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t hover:bg-muted/30">
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
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{r.grossProfitRate}%</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold whitespace-nowrap">{fmtMan(r.grossProfit)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">{fmtMan(r.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-muted/20 font-semibold">
                      <td className="px-3 py-2" colSpan={2}>合計（{rows.length}件）</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmtMan(totalRevenue)}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                        {totalRevenue > 0 ? `${Math.round((totalGp / totalRevenue) * 1000) / 10}%` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmtMan(totalGp)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                        {fmtMan(totalRevenue - totalGp)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                原価未入力のPJは会社設定の粗利率で概算しています。
              </p>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
