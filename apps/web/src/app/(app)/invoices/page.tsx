"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Plus } from "lucide-react";
import { getInvoices } from "@/lib/actions/invoices";

type Invoice = Awaited<ReturnType<typeof getInvoices>>[number];

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getInvoices().then(setInvoices).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="請求管理" description="請求書の一覧と管理">
        <Link href="/invoices/new">
          <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />新規作成</Button>
        </Link>
      </PageHeader>
      <Card>
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
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              )) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">請求書なし</TableCell>
                </TableRow>
              ) : invoices.map((inv) => (
                <TableRow key={inv.id} className="cursor-pointer hover:bg-accent/50" onClick={() => router.push(`/invoices/${inv.id}`)}>
                  <TableCell className="font-medium">{inv.invoice_no || "-"}</TableCell>
                  <TableCell>{inv.customer?.name || inv.customer?.company_name || "-"}</TableCell>
                  <TableCell>{inv.construction?.title || "-"}</TableCell>
                  <TableCell className="text-sm">{inv.invoice_date ? format(parseISO(inv.invoice_date), "yyyy/MM/dd", { locale: ja }) : "-"}</TableCell>
                  <TableCell className="text-sm">{inv.due_date ? format(parseISO(inv.due_date), "yyyy/MM/dd", { locale: ja }) : "-"}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">¥{inv.total.toLocaleString()}</TableCell>
                  <TableCell><StatusBadge status={inv.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
