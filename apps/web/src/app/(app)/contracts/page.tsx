"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Search, Plus, FileSignature, TrendingUp } from "lucide-react";
import { getContracts } from "@/lib/actions/contracts";

type ContractRow = Awaited<ReturnType<typeof getContracts>>[number];

function fmt(v: number) { return `¥${Math.round(v / 10000).toLocaleString()}万`; }

export default function ContractsListPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [rows, setRows] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getContracts().then(setRows).catch(() => {}).finally(() => setLoading(false)); }, []);

  const filtered = rows.filter((c) => {
    const q = search.toLowerCase();
    const match = !q || c.contract_no.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || (c.customer?.name ?? "").toLowerCase().includes(q);
    const matchTab = tab === "all" || c.status === tab || (tab === "active" && (c.status === "executing" || c.status === "contracted"));
    return match && matchTab;
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="契約管理" description="契約の締結状況を管理します">
        <Link href="/contracts/new"><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />新規契約</Button></Link>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "総契約数", val: rows.length, icon: FileSignature },
          { label: "総契約金額", val: fmt(rows.reduce((s, c) => s + (c.amount ?? 0), 0)), icon: TrendingUp },
          { label: "有効契約", val: rows.filter(c => c.status === "executing" || c.status === "contracted").length, icon: FileSignature },
          { label: "有効金額", val: fmt(rows.filter(c => c.status === "executing" || c.status === "contracted").reduce((s, c) => s + (c.amount ?? 0), 0)), icon: TrendingUp },
        ].map((k, i) => (
          <Card key={i}><CardContent className="pt-4 pb-3"><div className="flex items-center justify-between mb-2"><span className="text-xs text-muted-foreground">{k.label}</span><k.icon className="h-4 w-4 text-muted-foreground" /></div>{loading ? <Skeleton className="h-8 w-20" /> : <p className="text-2xl font-semibold tabular-nums">{k.val}</p>}</CardContent></Card>
        ))}
      </div>

      <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="検索..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="all">すべて</TabsTrigger><TabsTrigger value="active">有効</TabsTrigger><TabsTrigger value="preparing">準備中</TabsTrigger><TabsTrigger value="completed">完了</TabsTrigger></TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card><div className="overflow-x-auto">
            <Table><TableHeader><TableRow><TableHead>契約番号</TableHead><TableHead>顧客名</TableHead><TableHead>件名</TableHead><TableHead className="text-right">金額</TableHead><TableHead>契約日</TableHead><TableHead>ステータス</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? Array.from({length:5}).map((_,i)=><TableRow key={i}><TableCell><Skeleton className="h-4 w-24"/></TableCell><TableCell><Skeleton className="h-4 w-20"/></TableCell><TableCell><Skeleton className="h-4 w-32"/></TableCell><TableCell><Skeleton className="h-4 w-16"/></TableCell><TableCell><Skeleton className="h-4 w-20"/></TableCell><TableCell><Skeleton className="h-5 w-16"/></TableCell></TableRow>) : filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">該当なし</TableCell></TableRow> : filtered.map(c => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-accent/50" onClick={() => router.push(`/contracts/${c.id}`)}>
                  <TableCell><Link href={`/contracts/${c.id}`} className="font-medium text-primary hover:underline">{c.contract_no}</Link></TableCell>
                  <TableCell>{c.customer?.name ?? "-"}</TableCell>
                  <TableCell className="text-sm">{c.title}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(c.amount ?? 0)}</TableCell>
                  <TableCell className="text-sm">{c.contract_date ?? "-"}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody></Table>
          </div></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
