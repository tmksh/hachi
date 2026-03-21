"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { Plus, Pin, AlertTriangle } from "lucide-react";
import { getAnnouncements } from "@/lib/actions/announcements";

type Ann = Awaited<ReturnType<typeof getAnnouncements>>[number];

export default function CirculationPage() {
  const [items, setItems] = useState<Ann[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getAnnouncements().then(setItems).catch(() => {}).finally(() => setLoading(false)); }, []);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="回覧・お知らせ" description="社内通知と回覧板"><Link href="/circulation/new"><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />新規作成</Button></Link></PageHeader>
      {loading ? <div className="space-y-3">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-20" />)}</div> : items.length === 0 ? <div className="text-center py-12 text-muted-foreground">お知らせはありません</div> : (
        <div className="space-y-3">
          {items.map(a => (
            <Link key={a.id} href={`/circulation/${a.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {a.pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                        {a.is_urgent && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                        <h3 className="font-medium truncate">{a.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{a.body}</p>
                      <p className="text-xs text-muted-foreground mt-2">{a.author?.display_name ?? "-"} · {format(parseISO(a.published_at), "yyyy/MM/dd", { locale: ja })}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {a.is_urgent && <Badge variant="destructive" className="text-xs">緊急</Badge>}
                      {a.pinned && <Badge variant="secondary" className="text-xs">固定</Badge>}
                    </div>
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
