"use client";

import type { ReactNode } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { FileText, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type EstimateListItem = {
  id: string;
  estimate_no: string;
  title: string | null;
  version?: number;
  status: string;
  total: number;
  subtotal?: number;
  gross_profit_rate?: number;
  created_at: string;
  updated_at?: string;
  construction_id?: string | null;
  created_by_name?: string | null;
  assignee?: { id: string; display_name: string | null } | null;
  customer?: { id: string; name: string } | null;
  construction?: { id: string; title: string; construction_no?: string } | null;
};

const ESTIMATE_STATUS_MAP: Record<string, string> = {
  draft: "下書き",
  issued: "発行済",
  sent: "送付済",
  accepted: "受注",
  rejected: "失注",
};

type EstimateListViewProps = {
  estimateList: EstimateListItem[];
  loadingEstimate?: boolean;
  onSelectEstimate: (id: string) => void;
  onOpenCreate?: () => void;
  title?: string;
  description?: string;
  showSource?: boolean;
  showCustomer?: boolean;
  showConstruction?: boolean;
  hideCreate?: boolean;
  headerExtra?: ReactNode;
  toolbar?: ReactNode;
  loading?: boolean;
};

export function EstimateListView({
  estimateList,
  loadingEstimate = false,
  onSelectEstimate,
  onOpenCreate,
  title = "見積一覧",
  description = "関連する見積を管理",
  showSource = false,
  showCustomer = false,
  showConstruction = false,
  hideCreate = false,
  headerExtra,
  toolbar,
  loading = false,
}: EstimateListViewProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {headerExtra}
          {!hideCreate && onOpenCreate && (
            <Button size="sm" className="gap-1.5" onClick={onOpenCreate}>
              <Plus className="h-4 w-4" />
              見積作成
            </Button>
          )}
        </div>
      </div>

      {toolbar}

      {loading ? (
        <div className="flex items-center justify-center py-16 border rounded-xl text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : estimateList.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center border rounded-xl">見積なし</p>
      ) : (
        <div className="rounded-xl border border-border overflow-x-auto bg-card">
          <table className="w-full min-w-max text-sm border-collapse">
            <thead className="bg-muted/40">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">見積名</th>
                {showCustomer && <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap">顧客</th>}
                {showConstruction && <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap">工事</th>}
                {showSource && <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap">区分</th>}
                <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap">作成日</th>
                <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap">最終更新日</th>
                <th className="text-right px-3 py-2.5 font-medium whitespace-nowrap">合計金額</th>
                <th className="text-right px-3 py-2.5 font-medium whitespace-nowrap">粗利率</th>
                <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap">ステータス</th>
                <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap">作成者</th>
              </tr>
            </thead>
            <tbody>
              {estimateList.map((r) => (
                <tr
                  key={r.id}
                  className={cn(
                    "border-t border-border/40 hover:bg-muted/20 cursor-pointer",
                    loadingEstimate && "opacity-60 pointer-events-none",
                  )}
                  onClick={() => onSelectEstimate(r.id)}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm text-primary hover:underline whitespace-nowrap">
                        {r.estimate_no}
                        {r.title ? `（${r.title}）` : ""}
                      </span>
                    </div>
                  </td>
                  {showCustomer && (
                    <td className="px-3 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {r.customer?.name ?? "—"}
                    </td>
                  )}
                  {showConstruction && (
                    <td className="px-3 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {r.construction?.construction_no
                        ? `${r.construction.construction_no} ${r.construction.title}`
                        : (r.construction?.title ?? "—")}
                    </td>
                  )}
                  {showSource && (
                    <td className="px-3 py-3 whitespace-nowrap">
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {r.construction_id ? "工事" : "営業"}
                      </Badge>
                    </td>
                  )}
                  <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                    {format(new Date(r.created_at), "yyyy/MM/dd", { locale: ja })}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                    {format(new Date(r.updated_at ?? r.created_at), "yyyy/MM/dd", { locale: ja })}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums font-medium whitespace-nowrap">
                    ¥{(r.total ?? 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                    {(r.gross_profit_rate ?? 0).toFixed(1)}%
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted whitespace-nowrap">
                      {ESTIMATE_STATUS_MAP[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground text-xs whitespace-nowrap">
                    {r.created_by_name ?? r.assignee?.display_name ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
