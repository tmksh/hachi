"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import { KpiRow } from "@/components/shared/kpi-row";
import { StatusSelect } from "@/components/shared/status-select";
import { Plus, Receipt, FileText, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { getInvoices, updateInvoiceStatus, generateMonthlyInvoicesForMonth } from "@/lib/actions/invoices";
import { getStatusOption } from "@/lib/status-config";

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

type Invoice = Awaited<ReturnType<typeof getInvoices>>[number];

type InvoicesClientProps = {
  initialInvoices: Invoice[];
};

export function InvoicesClient({ initialInvoices }: InvoicesClientProps) {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [updating, setUpdating] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMonth, setBulkMonth] = useState(currentMonth);
  const [bulkGenerating, setBulkGenerating] = useState(false);

  useEffect(() => {
    setInvoices(initialInvoices);
  }, [initialInvoices]);

  const handleBulkGenerate = async () => {
    if (!bulkMonth) {
      toast.error("対象月を選択してください");
      return;
    }
    setBulkGenerating(true);
    try {
      const result = await generateMonthlyInvoicesForMonth(bulkMonth);
      const failNote = result.failures?.length
        ? `（失敗${result.failures.length}件）`
        : "";
      if (result.created === 0) {
        toast.message(
          `新規作成はありませんでした（対象月の未生成工事なし / スキップ${result.skipped}件）${failNote}`,
        );
      } else {
        toast.success(
          `${result.created}件の請求書を生成しました（スキップ${result.skipped}件）${failNote}`,
        );
      }
      setBulkOpen(false);
      try {
        setInvoices(await getInvoices());
      } catch {
        // 一覧再取得失敗でも生成自体は成功しているので refresh にフォールバック
        router.refresh();
      }
    } catch (e) {
      const msg = e instanceof Error
        ? e.message
        : (typeof e === "object" && e && "message" in e && typeof (e as { message: unknown }).message === "string")
          ? (e as { message: string }).message
          : "月次一括生成に失敗しました";
      toast.error(msg);
    } finally {
      setBulkGenerating(false);
    }
  };

  const handleStatusChange = async (id: string, status: "draft" | "sent" | "paid" | "cancelled") => {
    const prev = invoices;
    setInvoices(prev.map(inv => inv.id === id ? { ...inv, status } : inv));
    setUpdating(id);
    try {
      await updateInvoiceStatus(id, status);
      toast.success(`ステータスを「${getStatusOption("invoice", status)?.label ?? status}」に変更しました`);
    } catch {
      setInvoices(prev);
      toast.error("ステータスの更新に失敗しました");
    } finally {
      setUpdating(null);
    }
  };

  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0);
  const totalSent = invoices.filter(i => i.status === "sent").reduce((s, i) => s + i.total, 0);
  const draftCount = invoices.filter(i => i.status === "draft").length;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="請求管理" description="請求書の一覧と管理">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setBulkOpen(true)}>
          <CalendarClock className="h-4 w-4" />月次一括生成
        </Button>
        <Link href="/invoices/new">
          <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />新規作成</Button>
        </Link>
      </PageHeader>

      <KpiRow
        columns={3}
        items={[
          {
            label: "入金済み",
            value: `¥${Math.round(totalPaid / 10000).toLocaleString()}万`,
            icon: Receipt,
            valueClassName: "text-emerald-700",
          },
          {
            label: "送付済み",
            value: `¥${Math.round(totalSent / 10000).toLocaleString()}万`,
            sub: "未入金",
            icon: Receipt,
            valueClassName: "text-blue-700",
          },
          {
            label: "下書き",
            value: draftCount,
            sub: "件",
            icon: FileText,
          },
        ]}
      />

      <Card variant="inset">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>請求番号</TableHead>
                <TableHead>顧客</TableHead>
                <TableHead>工事</TableHead>
                <TableHead>請求日</TableHead>
                <TableHead>支払期限</TableHead>
                <TableHead className="text-right">合計</TableHead>
                <TableHead>ステータス</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">請求書なし</TableCell>
                </TableRow>
              ) : invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell
                    className="font-medium cursor-pointer hover:text-primary"
                    onClick={() => router.push(`/invoices/${inv.id}`)}
                  >
                    {inv.invoice_no || "-"}
                  </TableCell>
                  <TableCell>{inv.customer?.name || inv.customer?.company_name || "-"}</TableCell>
                  <TableCell>{inv.construction?.title || "-"}</TableCell>
                  <TableCell className="text-sm">{inv.invoice_date ? format(parseISO(inv.invoice_date), "yyyy/MM/dd", { locale: ja }) : "-"}</TableCell>
                  <TableCell className="text-sm">{inv.due_date ? format(parseISO(inv.due_date), "yyyy/MM/dd", { locale: ja }) : "-"}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">¥{inv.total.toLocaleString()}</TableCell>
                  <TableCell>
                    <StatusSelect
                      entity="invoice"
                      value={inv.status}
                      disabled={updating === inv.id}
                      onValueChange={(v) => handleStatusChange(inv.id, v as "draft" | "sent" | "paid" | "cancelled")}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>月次請求書の一括生成</DialogTitle>
            <DialogDescription>
              準備中・施工中・完了の工事（契約金額あり・対象月と工期が重なるもの）のうち、
              未生成分について会社設定の締日（invoice_closing_day）を請求日・翌月末を支払期限とした
              下書き請求書を一括作成します。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="bulk-month">対象月</Label>
            <Input
              id="bulk-month"
              type="month"
              value={bulkMonth}
              onChange={(e) => setBulkMonth(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkGenerating}>
              キャンセル
            </Button>
            <Button onClick={handleBulkGenerate} disabled={bulkGenerating}>
              {bulkGenerating ? "生成中..." : "一括生成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
