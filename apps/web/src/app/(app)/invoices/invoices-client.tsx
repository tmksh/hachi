"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { KpiRow } from "@/components/shared/kpi-row";
import { StatusSelect } from "@/components/shared/status-select";
import { Plus, Receipt, FileText } from "lucide-react";
import { toast } from "sonner";
import { getInvoices, updateInvoiceStatus } from "@/lib/actions/invoices";
import { getStatusOption } from "@/lib/status-config";

type Invoice = Awaited<ReturnType<typeof getInvoices>>[number];

type InvoicesClientProps = {
  initialInvoices: Invoice[];
};

export function InvoicesClient({ initialInvoices }: InvoicesClientProps) {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    setInvoices(initialInvoices);
  }, [initialInvoices]);

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
    </div>
  );
}
