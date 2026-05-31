"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { KpiRow } from "@/components/shared/kpi-row";
import { StatusSelect } from "@/components/shared/status-select";
import { Search, Plus, FileSignature, TrendingUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getContracts, deleteContract, updateContract } from "@/lib/actions/contracts";
import { getStatusOption } from "@/lib/status-config";

type ContractRow = Awaited<ReturnType<typeof getContracts>>[number];

function fmt(v: number) { return `¥${Math.round(v / 10000).toLocaleString()}万`; }

export default function ContractsListPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [rows, setRows] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ContractRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => { getContracts().then(setRows).catch(() => {}).finally(() => setLoading(false)); }, []);

  const handleStatusChange = async (id: string, status: ContractRow["status"]) => {
    const prev = rows;
    setRows((current) => current.map((r) => (r.id === id ? { ...r, status } : r)));
    setUpdating(id);
    try {
      await updateContract(id, { status });
      toast.success(`ステータスを「${getStatusOption("contract", status)?.label ?? status}」に変更しました`);
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
      await deleteContract(deleteTarget.id);
      setRows(prev => prev.filter(r => r.id !== deleteTarget.id));
    } catch { /* ignore */ } finally { setDeleting(false); setDeleteTarget(null); }
  };

  const filtered = rows.filter((c) => {
    const q = search.toLowerCase();
    const match = !q || c.contract_no.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || (c.customer?.name ?? "").toLowerCase().includes(q);
    const matchTab = tab === "all" || c.status === tab || (tab === "active" && (c.status === "executing" || c.status === "contracted"));
    return match && matchTab;
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="契約管理" description="契約の締結状況を管理します">
        <Link href="/contracts/new"><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />新規契約</Button></Link>
      </PageHeader>

      <KpiRow
        loading={loading}
        items={[
          { label: "総契約数", value: rows.length, sub: "件", icon: FileSignature },
          { label: "総契約金額", value: fmt(rows.reduce((s, c) => s + (c.amount ?? 0), 0)), icon: TrendingUp },
          {
            label: "有効契約",
            value: rows.filter((c) => c.status === "executing" || c.status === "contracted").length,
            sub: "件",
            icon: FileSignature,
          },
          {
            label: "有効金額",
            value: fmt(rows.filter((c) => c.status === "executing" || c.status === "contracted").reduce((s, c) => s + (c.amount ?? 0), 0)),
            icon: TrendingUp,
          },
        ]}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="検索..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <TabsList className="shrink-0">
            <TabsTrigger value="all">すべて</TabsTrigger>
            <TabsTrigger value="active">有効</TabsTrigger>
            <TabsTrigger value="preparing">準備中</TabsTrigger>
            <TabsTrigger value="completed">完了</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value={tab} className="mt-4">
          <Card variant="inset"><div className="overflow-x-auto">
            <Table><TableHeader><TableRow><TableHead>契約番号</TableHead><TableHead>顧客名</TableHead><TableHead>件名</TableHead><TableHead className="text-right">金額</TableHead><TableHead>契約日</TableHead><TableHead>ステータス</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? Array.from({length:5}).map((_,i)=><TableRow key={i}><TableCell><Skeleton className="h-4 w-24"/></TableCell><TableCell><Skeleton className="h-4 w-20"/></TableCell><TableCell><Skeleton className="h-4 w-32"/></TableCell><TableCell><Skeleton className="h-4 w-16"/></TableCell><TableCell><Skeleton className="h-4 w-20"/></TableCell><TableCell><Skeleton className="h-5 w-16"/></TableCell><TableCell /></TableRow>) : filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">該当なし</TableCell></TableRow> : filtered.map(c => (
                <TableRow key={c.id} className="cursor-pointer glass-row group" onClick={() => router.push(`/contracts/${c.id}`)}>
                  <TableCell><Link href={`/contracts/${c.id}`} className="font-medium text-primary hover:underline">{c.contract_no}</Link></TableCell>
                  <TableCell>{c.customer?.name ?? "-"}</TableCell>
                  <TableCell className="text-sm">{c.title}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(c.amount ?? 0)}</TableCell>
                  <TableCell className="text-sm">{c.contract_date ?? "-"}</TableCell>
                  <TableCell>
                    <StatusSelect
                      entity="contract"
                      value={c.status}
                      disabled={updating === c.id}
                      onValueChange={(v) => handleStatusChange(c.id, v as ContractRow["status"])}
                    />
                  </TableCell>
                  <TableCell>
                    <button
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                      onClick={e => { e.stopPropagation(); setDeleteTarget(c); }}
                    ><Trash2 className="h-3.5 w-3.5" /></button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody></Table>
          </div></Card>
        </TabsContent>
      </Tabs>
      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>契約を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>「{deleteTarget?.contract_no} {deleteTarget?.title}」を削除します。この操作は取り消せません。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={handleDelete} disabled={deleting}>削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
