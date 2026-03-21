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
import { Search, Plus, Phone, Mail, MapPin } from "lucide-react";
import { getCustomers } from "@/lib/actions/customers";
import type { Customer } from "@/lib/database.types";

type CustomerRow = Customer & { assigned_to_profile: { id: string; display_name: string } | null };

export default function CrmPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");

  useEffect(() => { getCustomers().then(d => setCustomers(d as CustomerRow[])).catch(() => {}).finally(() => setLoading(false)); }, []);

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || (c.company_name ?? "").toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q);
    const matchTab = tab === "all" || (tab === "corporation" && c.company_name) || (tab === "individual" && !c.company_name);
    return matchSearch && matchTab;
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="顧客管理" description="顧客情報の一覧と管理">
        <Link href="/crm/new"><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />新規顧客</Button></Link>
      </PageHeader>
      <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="名前・会社名・メールで検索..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="all">すべて ({customers.length})</TabsTrigger><TabsTrigger value="corporation">法人</TabsTrigger><TabsTrigger value="individual">個人</TabsTrigger></TabsList>
        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({length:6}).map((_,i)=><Card key={i}><CardContent className="p-5 space-y-3"><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-48" /><Skeleton className="h-4 w-24" /></CardContent></Card>)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">顧客が見つかりません</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(c => (
                <Link key={c.id} href={`/crm/${c.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><span className="text-sm font-semibold text-primary">{c.name.charAt(0)}</span></div>
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
