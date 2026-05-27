"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Phone, Mail, MapPin, LayoutGrid, List, Kanban } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCustomers } from "@/lib/actions/customers";
import { DealsPipelineView } from "@/components/deals/deals-pipeline-view";
import { CustomerAvatar } from "@/components/shared/customer-avatar";
import type { Customer } from "@/lib/database.types";

type CustomerRow = Customer & { assigned_to_profile: { id: string; display_name: string } | null };

type ViewMode = "grid" | "list" | "pipeline";

export default function CrmPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [view, setView] = useState<ViewMode>("list");
  const [addDealOpen, setAddDealOpen] = useState(false);

  useEffect(() => { getCustomers().then(d => setCustomers(d as CustomerRow[])).catch(() => {}).finally(() => setLoading(false)); }, []);

  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("view");
    if (v === "pipeline" || v === "grid" || v === "list") setView(v);
  }, []);

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || (c.company_name ?? "").toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q);
    const matchTab = tab === "all" || (tab === "corporation" && c.company_name) || (tab === "individual" && !c.company_name);
    return matchSearch && matchTab;
  });

  const isPipeline = view === "pipeline";

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title={isPipeline ? "商談パイプライン" : "顧客管理"}
        description={isPipeline ? "商談の進捗を管理" : "顧客情報の一覧と管理"}
      >
        {isPipeline ? (
          <Button size="sm" className="gap-1.5" onClick={() => setAddDealOpen(true)}>
            <Plus className="h-4 w-4" />商談を追加
          </Button>
        ) : (
          <Link href="/crm/new"><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />新規顧客</Button></Link>
        )}
      </PageHeader>
      <div className="flex flex-wrap items-center gap-3">
        {!isPipeline && (
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="名前・会社名・メールで検索..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        )}
        <div className="segmented-control shrink-0 text-xs ml-auto">
          {([
            { key: "list", label: "一覧", Icon: List },
            { key: "grid", label: "カード", Icon: LayoutGrid },
            { key: "pipeline", label: "パイプライン", Icon: Kanban },
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
      {isPipeline ? (
        <DealsPipelineView addOpen={addDealOpen} onAddOpenChange={setAddDealOpen} />
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList><TabsTrigger value="all">すべて ({customers.length})</TabsTrigger><TabsTrigger value="corporation">法人</TabsTrigger><TabsTrigger value="individual">個人</TabsTrigger></TabsList>
          <TabsContent value={tab} className="mt-4">
            {loading ? (
              view === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({length:6}).map((_,i)=><Card key={i}><CardContent className="p-5 space-y-3"><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-48" /><Skeleton className="h-4 w-24" /></CardContent></Card>)}</div>
              ) : (
                <Card variant="inset"><CardContent className="p-0"><div className="p-4 space-y-2">{Array.from({length:6}).map((_,i)=><Skeleton key={i} className="h-10 w-full" />)}</div></CardContent></Card>
              )
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">顧客が見つかりません</div>
            ) : view === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(c => (
                  <Link key={c.id} href={`/crm/${c.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                      <CardContent className="p-5 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <CustomerAvatar seed={c.id} name={c.name} size="md" />
                            <div><p className="font-medium">{c.name}</p><p className="text-sm text-muted-foreground">{c.company_name || "個人"}</p></div>
                          </div>
                          <Badge variant="secondary" className="text-xs">{c.status}</Badge>
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          {c.phone && <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{c.phone}</div>}
                          {c.email && <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{c.email}</div>}
                          {c.address && <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{c.address}</div>}
                        </div>
                        <p className="text-xs text-muted-foreground">登録: {format(new Date(c.created_at), "yyyy/MM/dd", { locale: ja })}</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <Card variant="inset" className="py-0">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">名前</TableHead>
                        <TableHead>会社名</TableHead>
                        <TableHead>電話</TableHead>
                        <TableHead>メール</TableHead>
                        <TableHead>住所</TableHead>
                        <TableHead className="w-[100px]">ステータス</TableHead>
                        <TableHead className="w-[110px]">登録日</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(c => (
                        <TableRow key={c.id} className="cursor-pointer glass-row" onClick={() => { window.location.href = `/crm/${c.id}`; }}>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <CustomerAvatar seed={c.id} name={c.name} />
                              <span className="font-medium">{c.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{c.company_name || "個人"}</TableCell>
                          <TableCell className="text-muted-foreground tabular-nums">{c.phone || "-"}</TableCell>
                          <TableCell className="text-muted-foreground">{c.email || "-"}</TableCell>
                          <TableCell className="text-muted-foreground max-w-[240px] truncate">{c.address || "-"}</TableCell>
                          <TableCell>
                            <Badge className={cn(
                              "text-[10px] h-5 px-1.5",
                              c.status === "active"   && "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
                              c.status === "inactive" && "bg-gray-100 text-gray-500 hover:bg-gray-100",
                              c.status === "pending"  && "bg-amber-100 text-amber-700 hover:bg-amber-100",
                            )}>
                              {c.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground tabular-nums text-xs">{format(new Date(c.created_at), "yyyy/MM/dd", { locale: ja })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
