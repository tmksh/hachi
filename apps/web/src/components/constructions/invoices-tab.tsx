"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Receipt, Plus, Loader2, CalendarClock, ExternalLink } from "lucide-react";
import { createInvoiceFromConstruction, generateMonthlyInvoices } from "@/lib/actions/invoices";

type InvoiceRow = {
  id: string;
  invoice_no: string;
  invoice_date: string | null;
  due_date: string | null;
  total: number;
  status: string;
  created_at: string;
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft: { label: "下書き", cls: "bg-gray-100 text-gray-600" },
  sent: { label: "送付済", cls: "bg-blue-100 text-blue-700" },
  paid: { label: "入金済", cls: "bg-green-100 text-green-700" },
  cancelled: { label: "取消", cls: "bg-red-100 text-red-600" },
};

interface Props {
  constructionId: string;
  initialInvoices: InvoiceRow[];
  hasSchedule: boolean;
  closingDayLabel: string;
  onRefresh: () => void;
}

export function InvoicesTab({
  constructionId,
  initialInvoices,
  hasSchedule,
  closingDayLabel,
  onRefresh,
}: Props) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setInvoices(initialInvoices);
  }, [initialInvoices]);

  async function handleCreate() {
    setCreating(true);
    try {
      const inv = await createInvoiceFromConstruction(constructionId);
      toast.success("請求書を作成しました");
      setInvoices(prev => [{
        id: inv.id,
        invoice_no: inv.invoice_no ?? "",
        invoice_date: inv.invoice_date,
        due_date: inv.due_date,
        total: inv.total,
        status: inv.status,
        created_at: inv.created_at,
      }, ...prev]);
      onRefresh();
    } catch {
      toast.error("請求書の作成に失敗しました");
    } finally {
      setCreating(false);
    }
  }

  async function handleGenerateMonthly() {
    setGenerating(true);
    try {
      const created = await generateMonthlyInvoices(constructionId);
      if (created.length === 0) {
        toast.info("新規作成対象の月次請求はありません（既に生成済みの可能性があります）");
      } else {
        toast.success(`${created.length}件の月次請求を生成しました`);
        onRefresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "月次請求の生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">
            工程表と連動した請求管理（締日: {closingDayLabel}）
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {invoices.length} 件の請求書
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleGenerateMonthly}
            disabled={generating || !hasSchedule}
            title={!hasSchedule ? "工期を設定すると月次請求を自動生成できます" : undefined}
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
            月次請求を自動生成
          </Button>
          <Button size="sm" className="gap-1.5 text-xs" onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            請求書を作成
          </Button>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="py-14 text-center text-sm text-muted-foreground rounded-xl border border-dashed border-border">
          <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>請求書がありません</p>
          <p className="text-xs mt-1">「月次請求を自動生成」で工期に応じた請求書を一括作成できます</p>
        </div>
      ) : (
        <Card variant="inset">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground">請求番号</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground">請求日</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground">支払期日</th>
                  <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-muted-foreground">ステータス</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-muted-foreground">金額</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const st = STATUS_MAP[inv.status] ?? STATUS_MAP.draft;
                  return (
                    <tr key={inv.id} className="border-t border-border/40 hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono text-xs">{inv.invoice_no}</td>
                      <td className="px-3 py-3 text-muted-foreground">{inv.invoice_date ?? "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{inv.due_date ?? "—"}</td>
                      <td className="px-3 py-3 text-center">
                        <Badge variant="outline" className={`text-[11px] ${st.cls}`}>{st.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        ¥{(inv.total ?? 0).toLocaleString()}
                      </td>
                      <td className="pr-3 py-3">
                        <Link href={`/invoices/${inv.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
