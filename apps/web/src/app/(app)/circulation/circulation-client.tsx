"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { Plus, Pin, AlertTriangle, Users, Search, X, SlidersHorizontal } from "lucide-react";
import { getAnnouncements } from "@/lib/actions/announcements";
import { ROLE_LABELS, type Role } from "@/lib/constants";

type Ann = Awaited<ReturnType<typeof getAnnouncements>>[number];

type CirculationClientProps = {
  initialItems: Ann[];
};

export function CirculationClient({ initialItems }: CirculationClientProps) {
  const [items] = useState<Ann[]>(initialItems);
  const [keyword, setKeyword] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterUrgent, setFilterUrgent] = useState(false);
  const [filterPinned, setFilterPinned] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    return items.filter(a => {
      if (keyword.trim()) {
        const kw = keyword.trim().toLowerCase();
        const hit = a.title.toLowerCase().includes(kw) || a.body.toLowerCase().includes(kw);
        if (!hit) return false;
      }
      if (dateFrom && a.published_at < dateFrom) return false;
      if (dateTo && a.published_at.slice(0, 10) > dateTo) return false;
      if (filterUrgent && !a.is_urgent) return false;
      if (filterPinned && !a.pinned) return false;
      return true;
    });
  }, [items, keyword, dateFrom, dateTo, filterUrgent, filterPinned]);

  const hasFilter = keyword || dateFrom || dateTo || filterUrgent || filterPinned;

  const clearFilters = () => {
    setKeyword("");
    setDateFrom("");
    setDateTo("");
    setFilterUrgent(false);
    setFilterPinned(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="回覧・お知らせ" description="社内通知と回覧板">
        <Link href="/circulation/new">
          <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />新規作成</Button>
        </Link>
      </PageHeader>

      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="タイトル・本文で検索..."
              className="pl-8 h-8 text-sm"
            />
            {keyword && (
              <button onClick={() => setKeyword("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8"
            onClick={() => setShowFilters(v => !v)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            詳細フィルター
            {hasFilter && !keyword && (
              <span className="ml-1 h-2 w-2 rounded-full bg-primary" />
            )}
          </Button>
          {hasFilter && (
            <Button variant="ghost" size="sm" className="h-8 text-muted-foreground gap-1" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" />クリア
            </Button>
          )}
        </div>

        {showFilters && (
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground">投稿日（開始）</p>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-sm w-40" />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground">投稿日（終了）</p>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-sm w-40" />
            </div>
            <div className="flex items-center gap-3 pb-0.5">
              <button
                onClick={() => setFilterUrgent(v => !v)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  filterUrgent
                    ? "bg-red-50 border-red-300 text-red-700"
                    : "bg-background border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />緊急のみ
              </button>
              <button
                onClick={() => setFilterPinned(v => !v)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  filterPinned
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-background border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <Pin className="h-3.5 w-3.5" />ピン留めのみ
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {hasFilter ? `${filtered.length} 件 / 全 ${items.length} 件` : `全 ${items.length} 件`}
      </p>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {hasFilter ? "条件に一致するお知らせがありません" : "お知らせはありません"}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => (
            <Link key={a.id} href={`/circulation/${a.id}`} className="block">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <h3 className="font-semibold text-[15px] leading-snug truncate">{a.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{a.body}</p>
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-1 pt-0.5 text-xs text-muted-foreground">
                        <span>{a.author?.display_name ?? "-"}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="tabular-nums">
                          {format(parseISO(a.published_at), "yyyy/MM/dd", { locale: ja })}
                        </span>
                        {a.due_date && (
                          <span className="text-amber-600">期限: {a.due_date}</span>
                        )}
                        {a.target_type === "roles" && Array.isArray(a.target_roles) && a.target_roles.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px]">
                            <Users className="h-3 w-3" />
                            {(a.target_roles as Role[]).map(r => ROLE_LABELS[r] ?? r).join("・")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5 shrink-0">
                      {a.is_urgent && <Badge variant="destructive" className="text-[11px]">緊急</Badge>}
                      {a.pinned && <Badge variant="secondary" className="text-[11px]">固定</Badge>}
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
