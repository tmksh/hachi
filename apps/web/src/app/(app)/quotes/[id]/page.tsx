"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { ArrowLeft, Pencil, Copy, FileDown } from "lucide-react";
import { getEstimate, copyEstimate } from "@/lib/actions/estimates";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type EstimateDetail = Awaited<ReturnType<typeof getEstimate>>;

export default function QuoteDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<EstimateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [copying, setCopying] = useState(false);

  useEffect(() => { if (id) getEstimate(id as string).then(setData).catch(() => {}).finally(() => setLoading(false)); }, [id]);

  if (loading) return <div className="p-4 md:p-8 space-y-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-64" /></div>;
  if (!data) return <div className="p-4 md:p-8 space-y-6"><Link href="/quotes" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"><ArrowLeft className="h-4 w-4" />戻る</Link><p className="mt-4 text-muted-foreground">見つかりません</p></div>;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <Link href="/quotes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />見積一覧</Link>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><div className="flex items-center gap-3"><h1 className="text-2xl font-semibold tracking-tight">{data.estimate_no}</h1><StatusBadge status={data.status} /></div><p className="text-sm text-muted-foreground mt-1">{data.title ?? "無題"} - {data.customer?.name ?? "-"}</p></div>
        <div className="flex items-center gap-3">
          <div className="text-right"><p className="text-sm text-muted-foreground">合計</p><p className="text-xl font-semibold tabular-nums">¥{(data.total ?? 0).toLocaleString()}</p></div>
          <Link href={`/quotes/${id}/edit`}><Button variant="outline" size="sm"><Pencil className="h-4 w-4 mr-1" />編集</Button></Link>
          <Button variant="outline" size="sm" onClick={() => setPdfOpen(true)}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
          <Button variant="outline" size="sm" disabled={copying} onClick={async () => {
            setCopying(true);
            try {
              const copy = await copyEstimate(id as string);
              toast.success("見積をコピーしました");
              router.push(`/quotes/${copy.id}/edit`);
            } catch { toast.error("コピーに失敗"); } finally { setCopying(false); }
          }}><Copy className="h-4 w-4 mr-1" />コピー</Button>
        </div>
      </div>
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>見積書プレビュー — {data.estimate_no}</DialogTitle></DialogHeader>
          <div className="border rounded-lg p-6 space-y-4 text-sm">
            <p className="text-lg font-bold">{data.title ?? "見積書"}</p>
            <p>宛先: {data.customer?.name ?? "—"}</p>
            <table className="w-full text-xs border-collapse">
              <thead><tr className="border-b"><th className="text-left py-1">品名</th><th className="text-right py-1">金額</th></tr></thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className="border-b border-border/40"><td className="py-1">{item.name}</td><td className="text-right tabular-nums">¥{(item.selling_amount ?? 0).toLocaleString()}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="text-right font-bold">合計: ¥{(data.total ?? 0).toLocaleString()}</p>
          </div>
          <Button size="sm" onClick={() => window.print()}>印刷 / PDF保存</Button>
        </DialogContent>
      </Dialog>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">小計</p><p className="text-lg font-semibold tabular-nums">¥{(data.subtotal ?? 0).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">消費税</p><p className="text-lg font-semibold tabular-nums">¥{(data.tax ?? 0).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">粗利</p><p className="text-lg font-semibold tabular-nums">¥{(data.gross_profit ?? 0).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">粗利率</p><p className="text-lg font-semibold tabular-nums">{(data.gross_profit_rate ?? 0).toFixed(1)}%</p></CardContent></Card>
      </div>
      <Card><CardHeader className="pb-3"><CardTitle className="text-sm">明細</CardTitle></CardHeader>
        <CardContent><div className="overflow-x-auto">
          {(data.categories ?? []).length > 0 ? (
            (data.categories ?? []).map((cat) => (
              <div key={cat.id} className="mb-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">{cat.name}</p>
                <Table><TableHeader><TableRow><TableHead>品名</TableHead><TableHead className="text-right">金額</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.items.filter((i) => i.category_id === cat.id).map((item) => (
                      <TableRow key={item.id}><TableCell>{item.name}</TableCell><TableCell className="text-right tabular-nums">¥{(item.selling_amount ?? 0).toLocaleString()}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))
          ) : (
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
          )}
        </div></CardContent>
      </Card>
      {data.notes && <Card><CardHeader className="pb-3"><CardTitle className="text-sm">備考</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{data.notes}</p></CardContent></Card>}
    </div>
  );
}
