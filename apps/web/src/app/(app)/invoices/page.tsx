"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { getInvoices, updateInvoiceStatus } from "@/lib/actions/invoices";

type Invoice = Awaited<ReturnType<typeof getInvoices>>[number];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:     { label: "下書き",   color: "text-muted-foreground" },
  sent:      { label: "送付済み", color: "text-blue-600" },
  paid:      { label: "入金済み", color: "text-emerald-600" },
  cancelled: { label: "キャンセル", color: "text-rose-500" },
};

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    getInvoices().then(setInvoices).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleStatusChange = async (id: string, status: "draft" | "sent" | "paid" | "cancelled") => {
    const prev = invoices;
    setInvoices(prev.map(inv => inv.id === id ? { ...inv, status } : inv));
    setUpdating(id);
    try {
      await updateInvoiceStatus(id, status);
      toast.success(`ステータスを「${STATUS_CONFIG[status].label}」に変更しました`);
    } catch {
      setInvoices(prev);
      toast.error("ステータスの更新に失敗しました");
    } finally {
      setUpdating(null);
    }
  };

  // 集計
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0);
  const totalSent = invoices.filter(i => i.status === "sent").reduce((s, i) => s + i.total, 0);
  const draftCount = invoices.filter(i => i.status === "draft").length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="請求管理" description="請求書の一覧と管理">
        <Link href="/invoices/new">
          <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />新規作成</Button>
        </Link>
      </PageHeader>

      {/* サマリー */}
      {!loading && invoices.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "入金済み", val: `¥${Math.round(totalPaid / 10000).toLocaleString()}万`, color: "text-emerald-600" },
            { label: "送付済み（未入金）", val: `¥${Math.round(totalSent / 10000).toLocaleString()}万`, color: "text-blue-600" },
            { label: "下書き", val: `${draftCount}件`, color: "text-muted-foreground" },
          ].map((k, i) => (
            <Card key={i} className="py-0">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className={`text-lg font-semibold tabular-nums ${k.color}`}>{k.val}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : invoices.length === 0 ? (
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
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={inv.status}
                      disabled={updating === inv.id}
                      onValueChange={(v) => handleStatusChange(inv.id, v as "draft" | "sent" | "paid" | "cancelled")}
                    >
                      <SelectTrigger className={`h-7 text-xs w-[110px] ${STATUS_CONFIG[inv.status]?.color ?? ""}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                          <SelectItem key={k} value={k} className="text-xs">
                            <span className={v.color}>{v.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
