"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, FileText, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  getPdfFormTemplates,
  deletePdfFormTemplate,
} from "@/lib/actions/pdf-form-templates";
import type { PdfFormTemplate } from "@/lib/pdf-form-template";

export default function PdfBuilderListPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<PdfFormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getPdfFormTemplates()
      .then(setTemplates)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deletePdfFormTemplate(deleteId);
      toast.success("削除しました");
      setDeleteId(null);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました");
    }
  };

  return (
    <div className="mx-auto max-w-[1100px] p-4 md:p-6 space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push("/settings")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="text-xs text-muted-foreground">管理者設定</div>
          <h1 className="text-lg font-semibold">PDFフォームビルダー</h1>
        </div>
      </div>

      {/* タイトル行 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">契約書テンプレート一覧</h2>
          <p className="text-sm text-muted-foreground">
            PDFをインポートして入力項目を配置し、契約書テンプレートを作成します
          </p>
        </div>
        <Button onClick={() => router.push("/settings/pdf-builder/new")}>
          <Plus className="h-4 w-4 mr-1" />
          新規テンプレート
        </Button>
      </div>

      {/* 一覧 */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/50" />
          <div className="text-sm font-medium text-muted-foreground">テンプレートがありません</div>
          <div className="text-xs text-muted-foreground">
            「新規テンプレート」をクリックして作成を開始してください
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="group rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{t.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{t.fileName}</div>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {t.pageCount}ページ ・ {t.fields.length}項目
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => router.push(`/settings/pdf-builder/${t.id}`)}
                    title="編集"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(t.id)}
                    title="削除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>テンプレートを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。配置した項目もすべて削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
