"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { KpiRow } from "@/components/shared/kpi-row";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusSelect } from "@/components/shared/status-select";
import { Search, Plus, TrendingUp, FileText, Trash2, CheckCircle2, ArrowLeft, Users } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getEstimates, deleteEstimate, updateEstimate } from "@/lib/actions/estimates";
import { getCustomers } from "@/lib/actions/customers";
import { getStatusOption } from "@/lib/status-config";

type Row = Awaited<ReturnType<typeof getEstimates>>[number];
type CustomerRow = Awaited<ReturnType<typeof getCustomers>>[number];

function fmt(v: number) { return `¥${Math.round(v / 10000).toLocaleString()}万`; }

function QuotesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerId = searchParams.get("customer");
  const [rows, setRows] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getEstimates(), getCustomers()])
      .then(([e, c]) => { setRows(e); setCustomers(c); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleStatusChange = async (id: string, status: Row["status"]) => {
    const prev = rows;
    setRows((current) => current.map((r) => (r.id === id ? { ...r, status } : r)));
    setUpdating(id);
    try {
      await updateEstimate(id, { status });
      toast.success(`ステータスを「${getStatusOption("estimate", status)?.label ?? status}」に変更しました`);
    } catch {
      setRows(prev);
      toast.error("ステータスの更新に失敗しました");
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteEstimate(deleteTarget.id);
      setRows(prev => prev.filter(r => r.id !== deleteTarget.id));
    } catch { /* ignore */ } finally { setDeleting(false); setDeleteTarget(null); }
  };

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const customerRows = customerId ? rows.filter((r) => r.customer_id === customerId) : rows;

  const filtered = customerRows.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.estimate_no.toLowerCase().includes(q) || (r.title ?? "").toLowerCase().includes(q) || (r.customer?.name ?? "").toLowerCase().includes(q);
    const matchTab = tab === "all" || r.status === tab;
    return matchSearch && matchTab;
  });

  const total = customerRows.reduce((s, r) => s + (r.total ?? 0), 0);

  const customerGroups = customers
    .map((c) => ({
      customer: c,
      estimates: rows.filter((r) => r.customer_id === c.id),
      total: rows.filter((r) => r.customer_id === c.id).reduce((s, r) => s + (r.total ?? 0), 0),
    }))
    .filter((g) => g.estimates.length > 0 || !search)
    .filter((g) => !search || g.customer.name.toLowerCase().includes(search.toLowerCase()));

  if (!customerId) {
    return (
      <div className="p-4 md:p-8 space-y-6">
        <PageHeader title="見積管理" description="顧客を選択して見積一覧へ">
          <Link href="/quotes/new"><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />新規見積</Button></Link>
        </PageHeader>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="顧客名で検索..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        {loading ? <Skeleton className="h-64 w-full" /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {customerGroups.map(({ customer, estimates, total: t }) => (
              <Link key={customer.id} href={`/quotes?customer=${customer.id}`}>
                <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer h-full">
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Users className="h-5 w-5 text-primary" /></div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{customer.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{estimates.length}件 · {fmt(t)}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
            {customerGroups.length === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-12">該当する顧客がありません</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <Link href="/quotes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />顧客一覧
      </Link>
      <PageHeader title={selectedCustomer?.name ?? "見積一覧"} description="この顧客の見積書">
        <Link href={`/quotes/new?customer_id=${customerId}`}><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />新規見積</Button></Link>
      </PageHeader>
      <KpiRow
        loading={loading}
        items={[
          { label: "見積数", value: customerRows.length, sub: "件", icon: FileText },
          { label: "合計金額", value: fmt(total), icon: TrendingUp },
          { label: "受理", value: customerRows.filter((r) => r.status === "accepted").length, sub: "件", icon: CheckCircle2 },
          { label: "下書き", value: customerRows.filter((r) => r.status === "draft").length, sub: "件", icon: FileText },
        ]}
      />
      <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="検索..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="all">すべて</TabsTrigger><TabsTrigger value="draft">下書き</TabsTrigger><TabsTrigger value="sent">送付済</TabsTrigger><TabsTrigger value="accepted">受理</TabsTrigger><TabsTrigger value="rejected">却下</TabsTrigger></TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card variant="inset"><div className="overflow-x-auto">
            <Table><TableHeader><TableRow><TableHead>見積番号</TableHead><TableHead>件名</TableHead><TableHead className="text-right">金額</TableHead><TableHead>ステータス</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? Array.from({length:5}).map((_,i)=><TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-4 w-full"/></TableCell></TableRow>) : filtered.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">該当なし</TableCell></TableRow> : filtered.map(r => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-accent/50 group" onClick={() => router.push(`/quotes/${r.id}`)}>
                    <TableCell><Link href={`/quotes/${r.id}`} className="font-medium text-primary hover:underline" onClick={e => e.stopPropagation()}>{r.estimate_no}</Link></TableCell>
                    <TableCell>{r.title ?? "-"}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{fmt(r.total ?? 0)}</TableCell>
                    <TableCell>
                      <StatusSelect entity="estimate" value={r.status} disabled={updating === r.id} onValueChange={(v) => handleStatusChange(r.id, v as Row["status"])} />
                    </TableCell>
                    <TableCell>
                      <button className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all" onClick={e => { e.stopPropagation(); setDeleteTarget(r); }}><Trash2 className="h-3.5 w-3.5" /></button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div></Card>
        </TabsContent>
      </Tabs>
      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>見積を削除しますか？</AlertDialogTitle><AlertDialogDescription>「{deleteTarget?.estimate_no}」を削除します。</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>キャンセル</AlertDialogCancel><AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={handleDelete} disabled={deleting}>削除</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function QuotesPage() {
  return (
    <Suspense fallback={<div className="p-4 md:p-8"><Skeleton className="h-64 w-full" /></div>}>
      <QuotesPageContent />
    </Suspense>
  );
}
