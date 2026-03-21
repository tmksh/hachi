"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { Plus, FileText } from "lucide-react";
import { getDocuments } from "@/lib/actions/documents";

type Doc = Awaited<ReturnType<typeof getDocuments>>[number];

export default function MarketingCreativePage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getDocuments().then(setDocs).catch(()=>{}).finally(()=>setLoading(false)); }, []);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="クリエイティブ管理" description="マーケティング素材の管理"><Link href="/marketing/creative/new"><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />新規追加</Button></Link></PageHeader>
      {loading ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({length:6}).map((_,i)=><Skeleton key={i} className="h-32" />)}</div> : docs.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground">クリエイティブ素材なし</CardContent></Card> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map(d => (
            <Card key={d.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><FileText className="h-5 w-5 text-primary" /></div><div className="flex-1 min-w-0"><p className="font-medium truncate">{d.name}</p><p className="text-xs text-muted-foreground">{d.file_name}</p></div></div>
                <p className="text-xs text-muted-foreground">{d.uploader?.display_name ?? "-"} · {format(parseISO(d.created_at), "yyyy/MM/dd", {locale:ja})}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
