"use client";

import { Fragment, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: FinancialAccountItem[];
  onItemsChanged: (items: FinancialAccountItem[]) => void;
};

/** グループ内の並び替え結果を全体の ID 順へ反映する */
function applyGroupReorder(
  sorted: FinancialAccountItem[],
  groupItems: FinancialAccountItem[],
  activeId: string,
  overId: string,
): string[] | null {
  const groupIds = groupItems.map((i) => i.id);
  const oldIndex = groupIds.indexOf(activeId);
  const newIndex = groupIds.indexOf(overId);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return null;

  const newGroupIds = arrayMove(groupIds, oldIndex, newIndex);
  const groupIdSet = new Set(groupIds);
  let gi = 0;
  return sorted.map((item) => (groupIdSet.has(item.id) ? newGroupIds[gi++]! : item.id));
}

function SortableAccountRow({
  item,
  busy,
  editingId,
  editingName,
  onEditingNameChange,
  onRename,
  onCancelEdit,
  onStartEdit,
  onDelete,
}: {
  item: FinancialAccountItem;
  busy: boolean;
  editingId: string | null;
  editingName: string;
  onEditingNameChange: (value: string) => void;
  onRename: (id: string) => void;
  onCancelEdit: () => void;
  onStartEdit: (item: FinancialAccountItem) => void;
  onDelete: (item: FinancialAccountItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: busy || editingId === item.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
      }}
      className={cn(
        "flex items-center gap-1.5 rounded-md border bg-card px-2 py-1",
        isDragging && "opacity-70 shadow-md",
      )}
    >
      {editingId === item.id ? (
        <>
          <Input
            value={editingName}
            onChange={(e) => onEditingNameChange(e.target.value)}
            className="h-7 flex-1 text-sm"
            autoFocus
          />
          <Button size="icon" variant="ghost" className="size-7" disabled={busy} onClick={() => onRename(item.id)}>
            <Check className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-7" onClick={onCancelEdit}>
            <X className="size-3.5" />
          </Button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="inline-flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing disabled:pointer-events-none disabled:opacity-50"
            disabled={busy}
            aria-label={`${item.name}をドラッグして並び替え`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-3.5" />
          </button>
          <span className="flex-1 truncate text-sm">{item.name}</span>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            disabled={busy}
            onClick={() => onStartEdit(item)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-destructive hover:text-destructive"
            disabled={busy}
            onClick={() => onDelete(item)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </>
      )}
    </div>
  );
}

/** 勘定科目マスタの管理（No.87: 追加・編集・並び替え） */
export function AccountMasterDialog({ open, onOpenChange, items, onItemsChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [newSection, setNewSection] = useState<FinancialAccountSection>("sga");
  const [newCogsCategory, setNewCogsCategory] = useState<FinancialCogsCategory>("expense");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<FinancialAccountItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

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

  const handleGroupDragEnd = async (
    groupItems: FinancialAccountItem[],
    event: DragEndEvent,
  ) => {
    const { active, over } = event;
    if (!over || active.id === over.id || busy) return;

    const nextOrder = applyGroupReorder(
      sorted,
      groupItems,
      String(active.id),
      String(over.id),
    );
    if (!nextOrder) return;

    // 楽観更新（即時反映）
    const orderIndex = new Map(nextOrder.map((id, i) => [id, (i + 1) * 10]));
    onItemsChanged(
      items.map((item) => ({
        ...item,
        sort_order: orderIndex.get(item.id) ?? item.sort_order,
      })),
    );

    setBusy(true);
    const res = await reorderFinancialAccountItems(nextOrder);
    if (res.ok) {
      await refresh();
    } else {
      toast.error(res.error);
      await refresh();
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
      {groupItems.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => void handleGroupDragEnd(groupItems, e)}
        >
          <SortableContext
            items={groupItems.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {groupItems.map((item) => (
                <SortableAccountRow
                  key={item.id}
                  item={item}
                  busy={busy}
                  editingId={editingId}
                  editingName={editingName}
                  onEditingNameChange={setEditingName}
                  onRename={(id) => void handleRename(id)}
                  onCancelEdit={() => setEditingId(null)}
                  onStartEdit={(target) => {
                    setEditingId(target.id);
                    setEditingName(target.name);
                  }}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>勘定科目マスタの管理</DialogTitle>
            <DialogDescription>
              区分 → 科目 → 合計の3階層で管理します。人件費は製造原価（労務費）と販管費のどちらにも登録でき、振り分け先で粗利率が大きく変わります（No.98）。左のハンドルをドラッグして並び替えできます。
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
