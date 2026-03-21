"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { Search, Plus, Phone, Mail, HardHat } from "lucide-react";
import { getCraftsmen } from "@/lib/actions/craftsmen";
import type { Craftsman } from "@/lib/database.types";

const SPEC_LABELS: Record<string, string> = { carpenter:"大工", electrical:"電気", interior:"内装", plumbing:"配管", general:"総合" };

export default function CraftsmenPage() {
  const [data, setData] = useState<Craftsman[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [specFilter, setSpecFilter] = useState("all");

  useEffect(() => { getCraftsmen().then(setData).catch(() => {}).finally(() => setLoading(false)); }, []);

  const filtered = data.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || (c.company_name ?? "").toLowerCase().includes(q);
    const matchSpec = specFilter === "all" || c.specialty === specFilter;
    return matchSearch && matchSpec;
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="職人管理" description="協力業者・職人の一覧"><Link href="/craftsmen/new"><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />新規登録</Button></Link></PageHeader>
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="名前・会社名で検索..." value={search} onChange={e=>setSearch(e.target.value)} className="pl-9" /></div>
        <div className="flex gap-1">{["all","carpenter","electrical","interior","plumbing","general"].map(s => <Button key={s} size="sm" variant={specFilter===s?"default":"outline"} onClick={()=>setSpecFilter(s)}>{s === "all" ? "すべて" : SPEC_LABELS[s]}</Button>)}</div>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({length:6}).map((_,i)=><Card key={i}><CardContent className="p-5 space-y-3"><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-48" /></CardContent></Card>)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">職人が見つかりません</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <Link key={c.id} href={`/craftsmen/${c.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center"><HardHat className="h-5 w-5 text-primary" /></div>
                      <div><p className="font-medium">{c.name}</p><p className="text-sm text-muted-foreground">{c.company_name || "-"}</p></div>
                    </div>
                    <div className="flex gap-1">{c.specialty && <Badge variant="secondary" className="text-xs">{SPEC_LABELS[c.specialty] || c.specialty}</Badge>}{c.rank && <Badge className="text-xs">{c.rank}</Badge>}</div>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>進行中: {c.active_projects}件</span><span>累計: {c.total_projects}件</span>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {c.phone && <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{c.phone}</div>}
                    {c.email && <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{c.email}</div>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
