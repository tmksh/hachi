"use client";

import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/page-header";
import { Search, Trash2, FileText, Upload, Download, Settings2, Plus, Pencil, GripVertical, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getDocuments, createDocument, deleteDocument,
  getDocumentCategories, createDocumentCategory,
  updateDocumentCategory, deleteDocumentCategory,
  type DocCategory,
} from "@/lib/actions/documents";
import { createClient } from "@/lib/supabase/client";

type Doc = Awaited<ReturnType<typeof getDocuments>>[number];
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
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // カテゴリ
  const [categories, setCategories] = useState<DocCategory[]>([]);
  const [catLoading, setCatLoading] = useState(true);

  // アップロード
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadCategory, setUploadCategory] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Doc | null>(null);

  // カテゴリ設定ダイアログ
  const [catOpen, setCatOpen] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [editingCat, setEditingCat] = useState<DocCategory | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [deleteCatTarget, setDeleteCatTarget] = useState<DocCategory | null>(null);

  const loadCategories = async () => {
    setCatLoading(true);
    try {
      const cats = await getDocumentCategories();
      setCategories(cats);
      if (!uploadCategory && cats.length > 0) setUploadCategory(cats[0].key);
    } catch { /* empty */ } finally { setCatLoading(false); }
  };

  const load = () => {
    setLoading(true);
    getDocuments({ category: tab === "all" ? undefined : tab }).then(setDocs).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { loadCategories(); }, []);
  useEffect(load, [tab]);

  // カテゴリラベルをkeyから引く
  const catLabel = (key: string) => categories.find(c => c.key === key)?.label ?? key;

  const handleDelete = async (id: string) => {
    try { await deleteDocument(id); toast.success("削除しました"); setDeleteTarget(null); load(); } catch { toast.error("失敗"); }
  };

  const handleUpload = async () => {
    if (!uploadName.trim() || !uploadFile) { toast.error("名前とファイルを入力してください"); return; }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = uploadFile.name.split(".").pop() ?? "bin";
      const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "");
      const path = `documents/${Date.now()}_${Math.random().toString(36).slice(2)}.${safeExt}`;
      const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, uploadFile);
      if (storageError) throw storageError;

      await createDocument({
        name: uploadName.trim(),
        category: (uploadCategory || undefined) as Doc["category"],
        description: uploadDescription.trim() || undefined,
        storage_path: path,
        file_name: uploadFile.name,
        mime_type: uploadFile.type,
        size: uploadFile.size,
      });

      toast.success("アップロードしました");
      setUploadOpen(false);
      setUploadName(""); setUploadDescription(""); setUploadFile(null);
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

  const handleAddCategory = async () => {
    if (!newCatLabel.trim()) return;
    setAddingCat(true);
    try {
      await createDocumentCategory(newCatLabel.trim());
      setNewCatLabel("");
      await loadCategories();
      toast.success("カテゴリを追加しました");
    } catch { toast.error("追加に失敗しました"); } finally { setAddingCat(false); }
  };

  const handleUpdateCategory = async () => {
    if (!editingCat || !editLabel.trim()) return;
    try {
      await updateDocumentCategory(editingCat.id, editLabel.trim());
      setEditingCat(null);
      await loadCategories();
      toast.success("更新しました");
    } catch { toast.error("更新に失敗しました"); }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCatTarget) return;
    try {
      await deleteDocumentCategory(deleteCatTarget.id);
      setDeleteCatTarget(null);
      if (tab === deleteCatTarget.key) setTab("all");
      await loadCategories();
      toast.success("削除しました");
    } catch { toast.error("削除に失敗しました"); }
  };

  const filtered = docs.filter(d => {
    const q = search.toLowerCase();
    return !q || d.name.toLowerCase().includes(q) || d.file_name.toLowerCase().includes(q);
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="文書管理" description="社内文書の管理">
        <Button variant="outline" size="sm" onClick={() => setCatOpen(true)}>
          <Settings2 className="h-4 w-4 mr-1" />カテゴリ設定
        </Button>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4 mr-1" />アップロード
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="検索..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="segmented-control shrink-0 text-xs">
          {([
            { key: "list", label: "一覧", Icon: List },
            { key: "grid", label: "カード", Icon: LayoutGrid },
          ] as const).map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setViewMode(key)}
              className={cn(
                "segmented-control-btn",
                viewMode === key && "segmented-control-btn-active",
              )}
              aria-label={`${label}表示`}
            >
              <Icon className="shrink-0" />{label}
            </button>
          ))}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">すべて</TabsTrigger>
          {catLoading
            ? <TabsTrigger value="_loading" disabled>読込中...</TabsTrigger>
            : categories.map(c => <TabsTrigger key={c.key} value={c.key}>{c.label}</TabsTrigger>)
          }
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {viewMode === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>
              )) : filtered.length === 0 ? (
                <p className="col-span-full text-center py-12 text-muted-foreground">文書なし</p>
              ) : filtered.map(d => (
                <Card key={d.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-2">
                    <div className="h-20 rounded-lg bg-muted/50 flex items-center justify-center">
                      {d.mime_type?.startsWith("image/") ? (
                        <span className="text-xs text-muted-foreground">画像</span>
                      ) : (
                        <FileText className="h-8 w-8 text-muted-foreground/50" />
                      )}
                    </div>
                    <p className="text-sm font-medium truncate">{d.name}</p>
                    {(d as Doc & { customer?: { name: string } }).customer?.name && (
                      <p className="text-[11px] text-muted-foreground truncate">{(d as Doc & { customer?: { name: string } }).customer!.name}</p>
                    )}
                    <div className="flex gap-1 pt-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDownload(d.storage_path, d.file_name)}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeleteTarget(d)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
          <Card variant="inset">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>文書名</TableHead>
                    <TableHead>顧客</TableHead>
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
                          {Array.from({ length: 8 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                        </TableRow>
                      ))
                    : filtered.length === 0
                    ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">文書なし</TableCell></TableRow>
                    : filtered.map(d => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />{d.name}</div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {(d as Doc & { customer?: { name: string } }).customer?.name ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm">{d.file_name}</TableCell>
                          <TableCell>
                            {d.category ? <Badge variant="outline" className="text-xs">{catLabel(d.category)}</Badge> : "-"}
                          </TableCell>
                          <TableCell className="text-sm">{formatSize(d.size ?? 0)}</TableCell>
                          <TableCell className="text-sm">{d.uploader?.display_name ?? "-"}</TableCell>
                          <TableCell className="text-sm">{format(parseISO(d.created_at), "yyyy/MM/dd", { locale: ja })}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => handleDownload(d.storage_path, d.file_name)} title="ダウンロード">
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(d)}>
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
          )}
        </TabsContent>
      </Tabs>

      {/* アップロードダイアログ */}
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
                <SelectTrigger><SelectValue placeholder="カテゴリを選択" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
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

      {/* カテゴリ設定ダイアログ */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />カテゴリ設定
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* カテゴリ一覧 */}
            <div className="space-y-1">
              {catLoading ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : categories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">カテゴリなし</p>
              ) : (
                categories.map(cat => (
                  <div key={cat.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-background hover:bg-muted/30 group">
                    <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    {editingCat?.id === cat.id ? (
                      <>
                        <Input
                          autoFocus
                          value={editLabel}
                          onChange={e => setEditLabel(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") handleUpdateCategory(); if (e.key === "Escape") setEditingCat(null); }}
                          className="h-7 text-sm flex-1"
                        />
                        <Button size="sm" className="h-7 text-xs" onClick={handleUpdateCategory}>保存</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingCat(null)}>取消</Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm font-medium">{cat.label}</span>
                        <span className="text-[11px] text-muted-foreground font-mono opacity-0 group-hover:opacity-100 transition-opacity">{cat.key}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => { setEditingCat(cat); setEditLabel(cat.label); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteCatTarget(cat)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            <Separator />

            {/* 追加フォーム */}
            <div className="flex gap-2">
              <Input
                placeholder="新しいカテゴリ名"
                value={newCatLabel}
                onChange={e => setNewCatLabel(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleAddCategory(); }}
                className="flex-1"
              />
              <Button size="sm" onClick={handleAddCategory} disabled={addingCat || !newCatLabel.trim()}>
                <Plus className="h-4 w-4 mr-1" />追加
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatOpen(false)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 文書削除確認ダイアログ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>文書を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.name}」を削除します。この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* カテゴリ削除確認ダイアログ */}
      <AlertDialog open={!!deleteCatTarget} onOpenChange={(v) => { if (!v) setDeleteCatTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>カテゴリを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteCatTarget?.label}」を削除します。このカテゴリに登録された文書のカテゴリは空になります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={handleDeleteCategory}
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
