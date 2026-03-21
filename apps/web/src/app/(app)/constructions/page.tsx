"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Search, Plus, HardHat } from "lucide-react";
import { getConstructions } from "@/lib/actions/constructions";

type Row = Awaited<ReturnType<typeof getConstructions>>[number];

export default function ConstructionsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");

  useEffect(() => { getConstructions().then(setRows).catch(() => {}).finally(() => setLoading(false)); }, []);

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    const match = !q || r.construction_no.toLowerCase().includes(q) || r.title.toLowerCase().includes(q) || (r.customer?.name ?? "").toLowerCase().includes(q);
    const matchTab = tab === "all" || r.status === tab;
    return match && matchTab;
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="工事管理" description="工事の進捗と原価を管理"><Link href="/constructions/new"><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />新規工事</Button></Link></PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "総工事数", val: rows.length },
          { label: "施工中", val: rows.filter(r => r.status === "in_progress").length },
          { label: "着工前", val: rows.filter(r => r.status === "preparing").length },
          { label: "完了", val: rows.filter(r => r.status === "completed").length },
        ].map((k, i) => (
          <Card key={i}><CardContent className="pt-4 pb-3"><span className="text-xs text-muted-foreground">{k.label}</span>{loading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl font-semibold">{k.val}</p>}</CardContent></Card>
        ))}
      </div>
      <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="検索..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="all">すべて</TabsTrigger><TabsTrigger value="in_progress">施工中</TabsTrigger><TabsTrigger value="preparing">着工前</TabsTrigger><TabsTrigger value="completed">完了</TabsTrigger></TabsList>
        <TabsContent value={tab} className="mt-4">
          {loading ? <div className="space-y-3">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-24" />)}</div> : filtered.length === 0 ? <div className="text-center py-12 text-muted-foreground">該当なし</div> : (
            <div className="space-y-3">
              {filtered.map(r => (
                <Card key={r.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push(`/constructions/${r.id}`)}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <HardHat className="h-5 w-5 text-muted-foreground" />
                        <div><p className="font-medium">{r.title}</p><p className="text-sm text-muted-foreground">{r.construction_no} · {r.customer?.name ?? "-"}</p></div>
                      </div>
                      <div className="flex items-center gap-2"><StatusBadge status={r.status} /><span className="text-sm font-semibold tabular-nums">{r.progress}%</span></div>
                    </div>
                    <Progress value={r.progress} className="h-2" />
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      <span>受注額: ¥{(r.order_amount ?? 0).toLocaleString()}</span>
                      <span>工期: {r.start_date ?? "-"} ~ {r.end_date ?? "-"}</span>
                      {r.assignee && <span>担当: {r.assignee.display_name}</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
