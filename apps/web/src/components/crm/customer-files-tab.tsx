"use client";

import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Trash2, FileText, Upload, Download, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getCustomerDocumentsAll, createDocument, deleteDocument,
  getDocumentCategories, type DocCategory,
} from "@/lib/actions/documents";
import { createClient } from "@/lib/supabase/client";

type Doc = Awaited<ReturnType<typeof getCustomerDocumentsAll>>[number] & {
  construction?: { id: string; title: string } | null;
};
const STORAGE_BUCKET = "documents";

export const CUSTOMER_DOCUMENTS_DESCRIPTION =
  "CRM・契約・工事からアップロードされた顧客関連ドキュメントを横断表示します。";

function contractSourceId(description: string | null | undefined) {
  const m = description?.match(/^source:contract:([a-f0-9-]+)$/);
  return m?.[1] ?? null;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

function docSourceLabel(
  d: Doc,
  context?: { constructionId?: string; contractId?: string },
) {
  if (context?.constructionId && d.construction_id === context.constructionId) return "この工事";
  const taggedContractId = contractSourceId(d.description);
  if (context?.contractId && taggedContractId === context.contractId) return "この契約";
  if (taggedContractId) return "契約";
  if (d.construction_id && d.construction?.title) return d.construction.title;
  return "顧客共通";
}

interface Props {
  customerId: string;
  constructionId?: string;
  contractId?: string;
  description?: string;
}

export function CustomerFilesTab({ customerId, constructionId, contractId, description }: Props) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [categories, setCategories] = useState<DocCategory[]>([]);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadCategory, setUploadCategory] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Doc | null>(null);

  const catLabel = (key: string) => categories.find(c => c.key === key)?.label ?? key;

  const load = () => {
    setLoading(true);
    getCustomerDocumentsAll(customerId)
      .then(setDocs)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    getDocumentCategories().then(cats => {
      setCategories(cats);
      if (cats.length > 0) setUploadCategory(cats[0].key);
    }).catch(() => {});
  }, []);

  useEffect(load, [customerId]);

  const handleDelete = async (id: string) => {
    try {
      await deleteDocument(id);
      toast.success("削除しました");
      setDeleteTarget(null);
      load();
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  const handleUpload = async () => {
    if (!uploadName.trim() || !uploadFile) {
      toast.error("名前とファイルを入力してください");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = uploadFile.name.split(".").pop() ?? "bin";
      const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "");
      const path = `customers/${customerId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${safeExt}`;
      const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, uploadFile);
      if (storageError) throw storageError;

      await createDocument({
        name: uploadName.trim(),
        category: (uploadCategory || undefined) as Doc["category"],
        description: contractId ? `source:contract:${contractId}` : undefined,
        storage_path: path,
        file_name: uploadFile.name,
        mime_type: uploadFile.type,
        size: uploadFile.size,
        customer_id: customerId,
        construction_id: constructionId,
      });

      toast.success("アップロードしました");
      setUploadOpen(false);
      setUploadName("");
      setUploadFile(null);
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
    <div className="space-y-4">
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      <div className="flex items-center gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="文書を検索..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
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
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-1" />アップロード
          </Button>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>
              ))
            : filtered.length === 0
            ? <p className="col-span-full text-center py-12 text-muted-foreground">文書がありません</p>
            : filtered.map(d => (
                <Card key={d.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-2">
                    <div className="h-20 rounded-lg bg-muted/50 flex items-center justify-center">
                      <FileText className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium truncate">{d.name}</p>
                    {d.category && (
                      <Badge variant="outline" className="text-xs">{catLabel(d.category)}</Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px]">{docSourceLabel(d, { constructionId, contractId })}</Badge>
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
              ))
          }
        </div>
      ) : (
        <Card variant="inset">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>文書名</TableHead>
                  <TableHead>登録元</TableHead>
                  <TableHead>ファイル名</TableHead>
                  <TableHead>カテゴリ</TableHead>
                  <TableHead>サイズ</TableHead>
                  <TableHead>アップロード者</TableHead>
                  <TableHead>日付</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 8 }).map((__, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  : filtered.length === 0
                  ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                          文書がありません
                        </TableCell>
                      </TableRow>
                    )
                  : filtered.map(d => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            {d.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            {docSourceLabel(d, { constructionId, contractId })}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{d.file_name}</TableCell>
                        <TableCell>
                          {d.category
                            ? <Badge variant="outline" className="text-xs">{catLabel(d.category)}</Badge>
                            : "-"}
                        </TableCell>
                        <TableCell className="text-sm">{formatSize(d.size ?? 0)}</TableCell>
                        <TableCell className="text-sm">{d.uploader?.display_name ?? "-"}</TableCell>
                        <TableCell className="text-sm">
                          {format(parseISO(d.created_at), "yyyy/MM/dd", { locale: ja })}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDownload(d.storage_path, d.file_name)} title="ダウンロード">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeleteTarget(d)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                }
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>文書をアップロード</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>文書名 *</Label>
              <Input value={uploadName} onChange={e => setUploadName(e.target.value)} placeholder="文書名を入力" />
            </div>
            {categories.length > 0 && (
              <div className="space-y-2">
                <Label>カテゴリ</Label>
                <Select value={uploadCategory} onValueChange={setUploadCategory}>
                  <SelectTrigger><SelectValue placeholder="カテゴリを選択" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>ファイル *</Label>
              <Input type="file" onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
              {uploadFile && (
                <p className="text-xs text-muted-foreground">{uploadFile.name} ({formatSize(uploadFile.size)})</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>キャンセル</Button>
            <Button onClick={handleUpload} disabled={uploading}>
              <Upload className="h-4 w-4 mr-1" />
              {uploading ? "アップロード中..." : "アップロード"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
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
    </div>
  );
}
