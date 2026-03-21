"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { ArrowLeft, Pencil } from "lucide-react";
import { getEstimate } from "@/lib/actions/estimates";

type EstimateDetail = Awaited<ReturnType<typeof getEstimate>>;

export default function QuoteDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<EstimateDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (id) getEstimate(id as string).then(setData).catch(() => {}).finally(() => setLoading(false)); }, [id]);

  if (loading) return <div className="p-4 md:p-6 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64" /></div>;
  if (!data) return <div className="p-4 md:p-6"><Link href="/quotes" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"><ArrowLeft className="h-4 w-4" />戻る</Link><p className="mt-4 text-muted-foreground">見つかりません</p></div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Link href="/quotes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />見積一覧</Link>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><div className="flex items-center gap-3"><h1 className="text-xl font-semibold">{data.estimate_no}</h1><StatusBadge status={data.status} /></div><p className="text-sm text-muted-foreground mt-1">{data.title ?? "無題"} - {data.customer?.name ?? "-"}</p></div>
        <div className="flex items-center gap-3">
          <div className="text-right"><p className="text-sm text-muted-foreground">合計</p><p className="text-xl font-semibold tabular-nums">¥{(data.total ?? 0).toLocaleString()}</p></div>
          <Link href={`/quotes/${id}/edit`}><Button variant="outline" size="sm"><Pencil className="h-4 w-4 mr-1" />編集</Button></Link>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">小計</p><p className="text-lg font-semibold tabular-nums">¥{(data.subtotal ?? 0).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">消費税</p><p className="text-lg font-semibold tabular-nums">¥{(data.tax ?? 0).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">粗利</p><p className="text-lg font-semibold tabular-nums">¥{(data.gross_profit ?? 0).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">粗利率</p><p className="text-lg font-semibold tabular-nums">{(data.gross_profit_rate ?? 0).toFixed(1)}%</p></CardContent></Card>
      </div>
      <Card><CardHeader className="pb-3"><CardTitle className="text-sm">明細</CardTitle></CardHeader>
        <CardContent><div className="overflow-x-auto">
          <Table><TableHeader><TableRow><TableHead>品名</TableHead><TableHead>仕様</TableHead><TableHead className="text-right">数量</TableHead><TableHead>単位</TableHead><TableHead className="text-right">単価</TableHead><TableHead className="text-right">金額</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.items.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">明細なし</TableCell></TableRow> : data.items.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.specification ?? "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                  <TableCell>{item.unit ?? "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">¥{(item.selling_price ?? 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">¥{(item.selling_amount ?? 0).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div></CardContent>
      </Card>
      {data.notes && <Card><CardHeader className="pb-3"><CardTitle className="text-sm">備考</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{data.notes}</p></CardContent></Card>}
    </div>
  );
}
