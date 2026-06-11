"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { CustomerAvatar } from "@/components/shared/customer-avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Phone, Mail, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Craftsman } from "@/lib/database.types";

const SPEC_LABELS: Record<string, string> = { carpenter:"大工", electrical:"電気", interior:"内装", plumbing:"配管", general:"総合" };

type ViewMode = "grid" | "list";

type CraftsmenClientProps = {
  initialRows: Craftsman[];
};

export function CraftsmenClient({ initialRows }: CraftsmenClientProps) {
  const router = useRouter();
  const [data, setData] = useState<Craftsman[]>(initialRows);
  const [search, setSearch] = useState("");
  const [specFilter, setSpecFilter] = useState("all");
  const [view, setView] = useState<ViewMode>("list");

  useEffect(() => {
    setData(initialRows);
  }, [initialRows]);

  const filtered = data.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || (c.company_name ?? "").toLowerCase().includes(q);
    const matchSpec = specFilter === "all" || c.specialty === specFilter;
    return matchSearch && matchSpec;
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="職人管理" description="協力業者・職人の一覧"><Link href="/craftsmen/new"><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />新規登録</Button></Link></PageHeader>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="名前・会社名で検索..." value={search} onChange={e=>setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-1">
          {["all","carpenter","electrical","interior","plumbing","general"].map(s => (
            <Button key={s} size="sm" variant={specFilter===s?"default":"outline"} onClick={()=>setSpecFilter(s)}>
              {s === "all" ? "すべて" : SPEC_LABELS[s]}
            </Button>
          ))}
        </div>
        <div className="segmented-control shrink-0 text-xs ml-auto">
          {([
            { key: "list", label: "一覧", Icon: List },
            { key: "grid", label: "カード", Icon: LayoutGrid },
          ] as const).map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={cn(
                "segmented-control-btn",
                view === key && "segmented-control-btn-active",
              )}
              aria-label={`${label}表示`}
            >
              <Icon className="shrink-0" />{label}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">職人が見つかりません</div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <Link key={c.id} href={`/craftsmen/${c.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <CustomerAvatar seed={c.id} name={c.name} size="md" />
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
      ) : (
        <Card variant="inset">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">名前</TableHead>
                  <TableHead>会社名</TableHead>
                  <TableHead className="w-[80px]">専門</TableHead>
                  <TableHead className="w-[70px]">ランク</TableHead>
                  <TableHead className="w-[90px] text-right">進行中</TableHead>
                  <TableHead className="w-[80px] text-right">累計</TableHead>
                  <TableHead>電話</TableHead>
                  <TableHead>メール</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c.id} className="cursor-pointer glass-row" onClick={() => router.push(`/craftsmen/${c.id}`)}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <CustomerAvatar seed={c.id} name={c.name} />
                        <span className="font-medium">{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.company_name || "-"}</TableCell>
                    <TableCell>{c.specialty ? <Badge variant="secondary" className="text-xs">{SPEC_LABELS[c.specialty] || c.specialty}</Badge> : "-"}</TableCell>
                    <TableCell>{c.rank ? <Badge className="text-xs">{c.rank}</Badge> : "-"}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.active_projects}件</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{c.total_projects}件</TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">{c.phone || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.email || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
