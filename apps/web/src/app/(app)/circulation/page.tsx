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
import { Plus, Pin, AlertTriangle, Users } from "lucide-react";
import { getAnnouncements } from "@/lib/actions/announcements";
import { ROLE_LABELS, type Role } from "@/lib/constants";

type Ann = Awaited<ReturnType<typeof getAnnouncements>>[number];

export default function CirculationPage() {
  const [items, setItems] = useState<Ann[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getAnnouncements().then(setItems).catch(() => {}).finally(() => setLoading(false)); }, []);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="回覧・お知らせ" description="社内通知と回覧板"><Link href="/circulation/new"><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />新規作成</Button></Link></PageHeader>
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">お知らせはありません</div>
      ) : (
        <div className="space-y-4">
          {items.map((a) => (
            <Link key={a.id} href={`/circulation/${a.id}`} className="block">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        {a.pinned && <Pin className="h-4 w-4 text-primary shrink-0" />}
                        {a.is_urgent && (
                          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                        )}
                        <h3 className="font-semibold text-[15px] leading-snug truncate">
                          {a.title}
                        </h3>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                        {a.body}
                      </p>
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-1 pt-1 text-xs text-muted-foreground">
                        <span>{a.author?.display_name ?? "-"}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="tabular-nums">
                          {format(parseISO(a.published_at), "yyyy/MM/dd", {
                            locale: ja,
                          })}
                        </span>
                        {a.target_type === "roles" &&
                          Array.isArray(a.target_roles) &&
                          a.target_roles.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px]">
                              <Users className="h-3 w-3" />
                              {(a.target_roles as Role[])
                                .map((r) => ROLE_LABELS[r] ?? r)
                                .join("・")}
                            </span>
                          )}
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5 shrink-0">
                      {a.is_urgent && (
                        <Badge variant="destructive" className="text-[11px]">
                          緊急
                        </Badge>
                      )}
                      {a.pinned && (
                        <Badge variant="secondary" className="text-[11px]">
                          固定
                        </Badge>
                      )}
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
