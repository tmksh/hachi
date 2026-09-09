"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deletePdfFormTemplate } from "@/lib/actions/pdf-form-templates";
import { fetchPdfFormTemplates } from "@/lib/queries/portal";
import {
  PDF_FORM_DOC_TYPE_LABELS,
  PDF_FORM_DOC_TYPES,
  type PdfFormDocType,
  type PdfFormTemplate,
} from "@/lib/pdf-form-template";

export function PdfBuilderTab() {
  const [templates, setTemplates] = useState<PdfFormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [docType, setDocType] = useState<PdfFormDocType | "all">("all");

  const load = () => {
    setLoading(true);
    fetchPdfFormTemplates()
      .then(setTemplates)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const visible = useMemo(
    () => templates.filter((t) => docType === "all" || t.docType === docType),
    [templates, docType],
  );
  const typeLabel = docType === "all" ? "テンプレート" : `${PDF_FORM_DOC_TYPE_LABELS[docType]}テンプレート`;
  const newHref = docType === "all"
    ? "/settings/pdf-builder/new"
    : `/settings/pdf-builder/new?type=${docType}`;

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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            PDFテンプレート
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            自社のPDFをアップロードして、顧客名・名称・金額などを自動入力するテンプレートを作成します。
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Select value={docType} onValueChange={(v) => setDocType(v as PdfFormDocType | "all")}>
            <SelectTrigger className="w-[160px] shrink-0" aria-label="書類種別">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {PDF_FORM_DOC_TYPES.map((k) => (
                <SelectItem key={k} value={k}>{PDF_FORM_DOC_TYPE_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" asChild>
            <Link href={newHref}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              新規テンプレート
            </Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-primary/20 bg-primary/[0.02] py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <FileText className="h-6 w-6 text-primary/60" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{typeLabel}がありません</p>
            <p className="mt-0.5 text-xs text-muted-foreground">PDFをアップロードして入力項目を設定すると、書類作成時に選択できるようになります</p>
          </div>
          <Button size="sm" asChild className="mt-1">
            <Link href={newHref}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              最初のテンプレートを作成
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => (
            <div key={t.id} className="rounded-lg border bg-card p-4 space-y-3 transition-shadow hover:shadow-sm">
              <div className="flex items-start gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{t.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{t.fileName}</div>
                  <div className="text-xs text-muted-foreground">
                    {PDF_FORM_DOC_TYPE_LABELS[t.docType]} · {t.pageCount}ページ · {t.fields.length}項目
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" asChild title="編集">
                  <Link href={`/settings/pdf-builder/${t.id}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
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
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
