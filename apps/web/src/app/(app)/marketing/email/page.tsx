"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { Plus } from "lucide-react";
import { getEmailThreads } from "@/lib/actions/mail";

type Thread = Awaited<ReturnType<typeof getEmailThreads>>[number];

export default function MarketingEmailPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getEmailThreads().then(setThreads).catch(()=>{}).finally(()=>setLoading(false)); }, []);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="メールマーケティング" description="メール配信の管理"><Link href="/marketing/email/new"><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />新規配信</Button></Link></PageHeader>
      <Card><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>件名</TableHead><TableHead>日時</TableHead><TableHead>既読</TableHead></TableRow></TableHeader>
        <TableBody>{loading ? Array.from({length:3}).map((_,i)=><TableRow key={i}><TableCell><Skeleton className="h-4 w-48"/></TableCell><TableCell><Skeleton className="h-4 w-20"/></TableCell><TableCell><Skeleton className="h-4 w-12"/></TableCell></TableRow>) : threads.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">配信なし</TableCell></TableRow> : threads.map(t => (
          <TableRow key={t.id} className="cursor-pointer hover:bg-accent/50" onClick={()=>{}}>
            <TableCell><Link href={`/marketing/email/${t.id}`} className="font-medium text-primary hover:underline">{t.subject || "(件名なし)"}</Link></TableCell>
            <TableCell className="text-sm">{t.last_message_at ? format(parseISO(t.last_message_at), "yyyy/MM/dd", {locale:ja}) : "-"}</TableCell>
            <TableCell>{t.is_read ? "既読" : "未読"}</TableCell>
          </TableRow>
        ))}</TableBody></Table></div></Card>
    </div>
  );
}
