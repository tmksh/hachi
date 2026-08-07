"use client";

import { Fragment, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  FinancialAccountItem,
  FinancialAccountSection,
  FinancialCogsCategory,
} from "@/lib/database.types";
import {
  COGS_CATEGORY_LABELS,
  COGS_DISPLAY_CATEGORIES,
  FINANCIAL_SECTIONS,
} from "@/lib/financial-statements-utils";
import {
  createFinancialAccountItem,
  deleteFinancialAccountItem,
  getFinancialAccountItems,
  reorderFinancialAccountItems,
  updateFinancialAccountItem,
} from "@/lib/actions/financial-statements";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: FinancialAccountItem[];
  onItemsChanged: (items: FinancialAccountItem[]) => void;
};

/** 勘定科目マスタの管理（No.87: 追加・編集・並び替え） */
export function AccountMasterDialog({ open, onOpenChange, items, onItemsChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [newSection, setNewSection] = useState<FinancialAccountSection>("sga");
  const [newCogsCategory, setNewCogsCategory] = useState<FinancialCogsCategory>("expense");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<FinancialAccountItem | null>(null);

  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);

  const refresh = async () => {
    const latest = await getFinancialAccountItems();
    onItemsChanged(latest);
  };

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast.error("科目名を入力してください");
      return;
    }
    setBusy(true);
    const res = await createFinancialAccountItem({
      section: newSection,
      cogsCategory: newSection === "cogs" ? newCogsCategory : null,
      name: newName,
    });
    if (res.ok) {
      toast.success("科目を追加しました");
      setNewName("");
      await refresh();
    } else {
      toast.error(res.error);
    }
    setBusy(false);
  };

  const handleRename = async (id: string) => {
    if (!editingName.trim()) {
      toast.error("科目名を入力してください");
      return;
    }
    setBusy(true);
    const res = await updateFinancialAccountItem(id, { name: editingName });
    if (res.ok) {
      toast.success("科目名を変更しました");
      setEditingId(null);
      await refresh();
    } else {
      toast.error(res.error);
    }
    setBusy(false);
  };

  const handleMove = async (item: FinancialAccountItem, direction: -1 | 1) => {
    // 同一区分（cogsはサブ区分も一致）内で入れ替え、全体順を保存する
    const siblings = sorted.filter(
      (i) => i.section === item.section && i.cogs_category === item.cogs_category,
    );
    const pos = siblings.findIndex((i) => i.id === item.id);
    const swapWith = siblings[pos + direction];
    if (!swapWith) return;

    const globalOrder = sorted.map((i) => i.id);
    const a = globalOrder.indexOf(item.id);
    const b = globalOrder.indexOf(swapWith.id);
    [globalOrder[a], globalOrder[b]] = [globalOrder[b], globalOrder[a]];

    setBusy(true);
    const res = await reorderFinancialAccountItems(globalOrder);
    if (res.ok) {
      await refresh();
    } else {
      toast.error(res.error);
    }
    setBusy(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    const res = await deleteFinancialAccountItem(deleteTarget.id);
    if (res.ok) {
      toast.success("科目を削除しました");
      await refresh();
    } else {
      toast.error(res.error);
    }
    setDeleteTarget(null);
    setBusy(false);
  };

  const renderGroup = (
    label: string,
    groupItems: FinancialAccountItem[],
  ) => (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      {groupItems.length === 0 && (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          科目がありません
        </p>
      )}
      {groupItems.map((item, idx) => (
        <div
          key={item.id}
          className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1"
        >
          {editingId === item.id ? (
            <>
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="h-7 flex-1 text-sm"
                autoFocus
              />
              <Button size="icon" variant="ghost" className="size-7" disabled={busy} onClick={() => handleRename(item.id)}>
                <Check className="size-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditingId(null)}>
                <X className="size-3.5" />
              </Button>
            </>
          ) : (
            <>
              <span className="flex-1 truncate text-sm">{item.name}</span>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                disabled={busy || idx === 0}
                onClick={() => handleMove(item, -1)}
              >
                <ArrowUp className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                disabled={busy || idx === groupItems.length - 1}
                onClick={() => handleMove(item, 1)}
              >
                <ArrowDown className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                disabled={busy}
                onClick={() => {
                  setEditingId(item.id);
                  setEditingName(item.name);
                }}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-7 text-destructive hover:text-destructive"
                disabled={busy}
                onClick={() => setDeleteTarget(item)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>勘定科目マスタの管理</DialogTitle>
            <DialogDescription>
              区分 → 科目 → 合計の3階層で管理します。人件費は製造原価（労務費）と販管費のどちらにも登録でき、振り分け先で粗利率が大きく変わります（No.98）。
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            <b>No.98 人件費の振分:</b> 同じ「労務費」でも製造原価に置くか販管費に置くかで粗利率が約7pt動きます。営業利益は変わりません。科目は区分を分けて両方登録できます。
          </div>

          {/* 追加フォーム */}
          <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 p-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">区分</p>
              <Select value={newSection} onValueChange={(v) => setNewSection(v as FinancialAccountSection)}>
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FINANCIAL_SECTIONS.map((s) => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newSection === "cogs" && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">原価区分</p>
                <Select value={newCogsCategory} onValueChange={(v) => setNewCogsCategory(v as FinancialCogsCategory)}>
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COGS_DISPLAY_CATEGORIES.map((c) => (
                      <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="min-w-40 flex-1 space-y-1">
              <p className="text-xs text-muted-foreground">科目名</p>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例: 支払報酬料"
                className="h-8 text-sm"
              />
            </div>
            <Button size="sm" onClick={handleAdd} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              追加
            </Button>
          </div>

          {/* 区分ごとの一覧（No.87: 区分 → 科目。売上原価は3区分） */}
          <div className="space-y-4">
            {FINANCIAL_SECTIONS.map((section) => (
              <Fragment key={section.key}>
                {section.key === "cogs" ? (
                  <div className="space-y-3 rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{section.label}</p>
                      <Badge variant="secondary" className="text-[10px]">製造原価報告書・3区分</Badge>
                    </div>
                    {COGS_DISPLAY_CATEGORIES.map((cat) =>
                      <Fragment key={cat.key}>
                        {renderGroup(
                          COGS_CATEGORY_LABELS[cat.key],
                          sorted.filter((i) => {
                            if (i.section !== "cogs") return false;
                            if (cat.key === "expense") {
                              return i.cogs_category === "expense" || i.cogs_category === "outsourcing";
                            }
                            return i.cogs_category === cat.key;
                          }),
                        )}
                      </Fragment>,
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 rounded-lg border p-3">
                    <p className="text-sm font-semibold">{section.label}</p>
                    {renderGroup("科目", sorted.filter((i) => i.section === section.key))}
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* 削除確認 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>科目を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.name}」を削除します。すべての決算書からこの科目の明細行（入力済みの金額を含む）が削除されます。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDelete}
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
