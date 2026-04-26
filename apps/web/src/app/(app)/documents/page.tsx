"use client";

import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { Search, Trash2, FileText, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { getDocuments, createDocument, deleteDocument } from "@/lib/actions/documents";
import { createClient } from "@/lib/supabase/client";

type Doc = Awaited<ReturnType<typeof getDocuments>>[number];
const CAT_LABELS: Record<string, string> = { rules: "規程", hr: "人事", accounting: "経理", safety: "安全", other: "その他" };
const STORAGE_BUCKET = "documents";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadCategory, setUploadCategory] = useState("other");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = () => {
    setLoading(true);
    getDocuments(tab === "all" ? undefined : tab).then(setDocs).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, [tab]);

  const handleDelete = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    try { await deleteDocument(id); toast.success("削除しました"); load(); } catch { toast.error("失敗"); }
  };

  const handleUpload = async () => {
    if (!uploadName.trim() || !uploadFile) { toast.error("名前とファイルを入力してください"); return; }
    setUploading(true);
    try {
      const supabase = createClient();
      const path = `documents/${Date.now()}_${uploadFile.name}`;
      const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, uploadFile);
      if (storageError) throw storageError;

      await createDocument({
        name: uploadName.trim(),
        category: uploadCategory as Doc["category"],
        description: uploadDescription.trim() || undefined,
        storage_path: path,
        file_name: uploadFile.name,
        mime_type: uploadFile.type,
        size: uploadFile.size,
      });

      toast.success("アップロードしました");
      setUploadOpen(false);
      setUploadName(""); setUploadCategory("other"); setUploadDescription(""); setUploadFile(null);
      load();
    } catch (e: unknown) {
      toast.error(`アップロード失敗: ${e instanceof Error ? e.message : "不明なエラー"}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (storagePath: string, fileName: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, 3600);
      if (error) throw error;
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = fileName;
      a.click();
    } catch {
      toast.error("ダウンロードに失敗しました");
    }
  };

  const filtered = docs.filter(d => {
    const q = search.toLowerCase();
    return !q || d.name.toLowerCase().includes(q) || d.file_name.toLowerCase().includes(q);
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="文書管理" description="社内文書の管理">
        <Button size="sm" onClick={() => setUploadOpen(true)}><Upload className="h-4 w-4 mr-1" />アップロード</Button>
      </PageHeader>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="検索..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">すべて</TabsTrigger>
          {Object.entries(CAT_LABELS).map(([k, v]) => <TabsTrigger key={k} value={k}>{v}</TabsTrigger>)}
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card variant="inset">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>文書名</TableHead>
                    <TableHead>ファイル名</TableHead>
                    <TableHead>カテゴリ</TableHead>
                    <TableHead>サイズ</TableHead>
                    <TableHead>アップロード者</TableHead>
                    <TableHead>日付</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      ))
                    : filtered.length === 0
                    ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">文書なし</TableCell></TableRow>
                    : filtered.map(d => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />{d.name}</div>
                          </TableCell>
                          <TableCell className="text-sm">{d.file_name}</TableCell>
                          <TableCell>{d.category ? <Badge variant="outline" className="text-xs">{CAT_LABELS[d.category] || d.category}</Badge> : "-"}</TableCell>
                          <TableCell className="text-sm">{formatSize(d.size ?? 0)}</TableCell>
                          <TableCell className="text-sm">{d.uploader?.display_name ?? "-"}</TableCell>
                          <TableCell className="text-sm">{format(parseISO(d.created_at), "yyyy/MM/dd", { locale: ja })}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => handleDownload(d.storage_path, d.file_name)} title="ダウンロード">
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDelete(d.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>文書をアップロード</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>文書名 *</Label>
              <Input value={uploadName} onChange={e => setUploadName(e.target.value)} placeholder="文書名を入力" />
            </div>
            <div className="space-y-2">
              <Label>カテゴリ</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CAT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>説明</Label>
              <Textarea rows={3} value={uploadDescription} onChange={e => setUploadDescription(e.target.value)} placeholder="説明（任意）" />
            </div>
            <div className="space-y-2">
              <Label>ファイル *</Label>
              <Input type="file" onChange={e => setUploadFile(e.target.files?.[0] || null)} />
              {uploadFile && <p className="text-xs text-muted-foreground">{uploadFile.name} ({formatSize(uploadFile.size)})</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>キャンセル</Button>
            <Button onClick={handleUpload} disabled={uploading}>
              <Upload className="h-4 w-4 mr-1" />{uploading ? "アップロード中..." : "アップロード"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
