"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { Search, Plus, TrendingUp, FileText } from "lucide-react";
import { getEstimates } from "@/lib/actions/estimates";

type Row = Awaited<ReturnType<typeof getEstimates>>[number];

function fmt(v: number) { return `¥${Math.round(v / 10000).toLocaleString()}万`; }

export default function QuotesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");

  useEffect(() => { getEstimates().then(setRows).catch(() => {}).finally(() => setLoading(false)); }, []);

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.estimate_no.toLowerCase().includes(q) || (r.title ?? "").toLowerCase().includes(q) || (r.customer?.name ?? "").toLowerCase().includes(q);
    const matchTab = tab === "all" || r.status === tab;
    return matchSearch && matchTab;
  });

  const total = rows.reduce((s, r) => s + (r.total ?? 0), 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="見積管理" description="見積書の作成と管理">
        <Link href="/quotes/new"><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />新規見積</Button></Link>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "総見積数", val: rows.length, icon: FileText },
          { label: "総見積金額", val: fmt(total), icon: TrendingUp },
          { label: "受理", val: rows.filter(r => r.status === "accepted").length, icon: FileText },
          { label: "下書き", val: rows.filter(r => r.status === "draft").length, icon: FileText },
        ].map((k, i) => (
          <Card key={i}><CardContent className="pt-4 pb-3"><div className="flex items-center justify-between mb-2"><span className="text-xs text-muted-foreground">{k.label}</span><k.icon className="h-4 w-4 text-muted-foreground" /></div>{loading ? <Skeleton className="h-8 w-20" /> : <p className="text-2xl font-semibold tabular-nums">{k.val}</p>}</CardContent></Card>
        ))}
      </div>
      <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="検索..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="all">すべて</TabsTrigger><TabsTrigger value="draft">下書き</TabsTrigger><TabsTrigger value="sent">送付済</TabsTrigger><TabsTrigger value="accepted">受理</TabsTrigger><TabsTrigger value="rejected">却下</TabsTrigger></TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card><div className="overflow-x-auto">
            <Table><TableHeader><TableRow><TableHead>見積番号</TableHead><TableHead>件名</TableHead><TableHead>顧客</TableHead><TableHead className="text-right">金額</TableHead><TableHead>ステータス</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? Array.from({length:5}).map((_,i)=><TableRow key={i}><TableCell><Skeleton className="h-4 w-24"/></TableCell><TableCell><Skeleton className="h-4 w-32"/></TableCell><TableCell><Skeleton className="h-4 w-20"/></TableCell><TableCell><Skeleton className="h-4 w-16"/></TableCell><TableCell><Skeleton className="h-5 w-16"/></TableCell></TableRow>) : filtered.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">該当なし</TableCell></TableRow> : filtered.map(r => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-accent/50" onClick={() => router.push(`/quotes/${r.id}`)}>
                    <TableCell><Link href={`/quotes/${r.id}`} className="font-medium text-primary hover:underline">{r.estimate_no}</Link></TableCell>
                    <TableCell>{r.title ?? "-"}</TableCell>
                    <TableCell>{r.customer?.name ?? "-"}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{fmt(r.total ?? 0)}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
