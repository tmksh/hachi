"use client";

import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { Search, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { getDocuments, deleteDocument } from "@/lib/actions/documents";

type Doc = Awaited<ReturnType<typeof getDocuments>>[number];
const CAT_LABELS: Record<string, string> = { rules: "規程", hr: "人事", accounting: "経理", safety: "安全", other: "その他" };

function formatSize(bytes: number) { if (bytes < 1024) return `${bytes}B`; if (bytes < 1048576) return `${(bytes/1024).toFixed(1)}KB`; return `${(bytes/1048576).toFixed(1)}MB`; }

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");

  const load = () => { setLoading(true); getDocuments(tab === "all" ? undefined : tab).then(setDocs).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(load, [tab]);

  const handleDelete = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    try { await deleteDocument(id); toast.success("削除しました"); load(); } catch { toast.error("失敗"); }
  };

  const filtered = docs.filter(d => { const q = search.toLowerCase(); return !q || d.name.toLowerCase().includes(q) || d.file_name.toLowerCase().includes(q); });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="文書管理" description="社内文書の管理" />
      <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="検索..." value={search} onChange={e=>setSearch(e.target.value)} className="pl-9" /></div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="all">すべて</TabsTrigger>{Object.entries(CAT_LABELS).map(([k,v])=><TabsTrigger key={k} value={k}>{v}</TabsTrigger>)}</TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>文書名</TableHead><TableHead>ファイル名</TableHead><TableHead>カテゴリ</TableHead><TableHead>サイズ</TableHead><TableHead>アップロード者</TableHead><TableHead>日付</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? Array.from({length:4}).map((_,i)=><TableRow key={i}><TableCell><Skeleton className="h-4 w-32"/></TableCell><TableCell><Skeleton className="h-4 w-24"/></TableCell><TableCell><Skeleton className="h-4 w-16"/></TableCell><TableCell><Skeleton className="h-4 w-12"/></TableCell><TableCell><Skeleton className="h-4 w-20"/></TableCell><TableCell><Skeleton className="h-4 w-20"/></TableCell><TableCell></TableCell></TableRow>) : filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">文書なし</TableCell></TableRow> : filtered.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />{d.name}</div></TableCell>
                  <TableCell className="text-sm">{d.file_name}</TableCell>
                  <TableCell>{d.category ? <Badge variant="outline" className="text-xs">{CAT_LABELS[d.category] || d.category}</Badge> : "-"}</TableCell>
                  <TableCell className="text-sm">{formatSize(d.size ?? 0)}</TableCell>
                  <TableCell className="text-sm">{d.uploader?.display_name ?? "-"}</TableCell>
                  <TableCell className="text-sm">{format(parseISO(d.created_at), "yyyy/MM/dd", { locale: ja })}</TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={()=>handleDelete(d.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody></Table></div></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
