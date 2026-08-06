"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  FilePlus2,
  FileUp,
  Landmark,
  ListTree,
  Loader2,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";
import type {
  FinancialAccountItem,
  FinancialReportSettings,
  FinancialStatement,
} from "@/lib/database.types";
import {
  getFinancialStatement,
  listFinancialStatements,
  updateFinancialStatementLines,
  setFinancialStatementStatus,
  deleteFinancialStatement,
  type FinancialLineUpdate,
} from "@/lib/actions/financial-statements";
import {
  buildEditableValues,
  parseAmount,
  EMPTY_LINE_VALUE,
  type EditableLineValue,
  type EditableValues,
} from "./financials-shared";
import { PlTable, CostReportSheet } from "./pl-table";
import { AccountMasterDialog } from "./account-master-dialog";
import {
  CreateStatementDialog,
  ImportStatementDialog,
  ReportSettingsDialog,
} from "./statement-dialogs";

type Props = {
  initialItems: FinancialAccountItem[];
  initialStatements: FinancialStatement[];
  initialSettings: FinancialReportSettings | null;
};

export function FinancialsClient({ initialItems, initialStatements, initialSettings }: Props) {
  const [items, setItems] = useState(initialItems);
  const [statements, setStatements] = useState(initialStatements);
  const [selectedId, setSelectedId] = useState<string | null>(initialStatements[0]?.id ?? null);
  const [statement, setStatement] = useState<FinancialStatement | null>(null);
  const [values, setValues] = useState<EditableValues>({});
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [actualLabel, setActualLabel] = useState(
    initialSettings?.actual_column_label?.trim() || "当期実績",
  );
  // No.97: 法人税の概算表示（デフォルトOFF）
  const [showEstimatedTax, setShowEstimatedTax] = useState(false);
  const [costSheetOpen, setCostSheetOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [masterOpen, setMasterOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [finalizeConfirmOpen, setFinalizeConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const readOnly = statement?.status === "final";

  const loadStatement = useCallback(async (id: string) => {
    setLoading(true);
    const data = await getFinancialStatement(id);
    setStatement(data);
    setValues(buildEditableValues(data?.lines ?? []));
    setDirty(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedId) {
      void loadStatement(selectedId);
    } else {
      setStatement(null);
      setValues({});
      setDirty(false);
    }
  }, [selectedId, loadStatement]);

  const refreshStatements = useCallback(async () => {
    const list = await listFinancialStatements();
    setStatements(list);
    return list;
  }, []);

  const handleValueChange = useCallback(
    (itemId: string, field: keyof EditableLineValue, value: string) => {
      setValues((prev) => ({
        ...prev,
        [itemId]: { ...(prev[itemId] ?? EMPTY_LINE_VALUE), [field]: value },
      }));
      setDirty(true);
    },
    [],
  );

  const buildUpdates = useCallback((): FinancialLineUpdate[] => {
    return items
      .filter((i) => i.is_active)
      .map((item) => {
        const v = values[item.id] ?? EMPTY_LINE_VALUE;
        return {
          accountItemId: item.id,
          budgetAmount: parseAmount(v.budget),
          actualAmount: parseAmount(v.actual),
          priorActualAmount: parseAmount(v.prior),
          varianceNote: v.note,
        };
      });
  }, [items, values]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!statement) return false;
    setSaving(true);
    const res = await updateFinancialStatementLines(statement.id, buildUpdates());
    setSaving(false);
    if (res.ok) {
      toast.success("決算書を保存しました");
      setDirty(false);
      return true;
    }
    toast.error(res.error);
    return false;
  }, [statement, buildUpdates]);

  const handleFinalize = useCallback(async () => {
    if (!statement) return;
    if (dirty) {
      const saved = await handleSave();
      if (!saved) return;
    }
    const res = await setFinancialStatementStatus(statement.id, "final");
    if (res.ok) {
      toast.success("決算書を確定しました。BIから参照できるようになります");
      await refreshStatements();
      await loadStatement(statement.id);
    } else {
      toast.error(res.error);
    }
  }, [statement, dirty, handleSave, refreshStatements, loadStatement]);

  const handleRevertToDraft = useCallback(async () => {
    if (!statement) return;
    const res = await setFinancialStatementStatus(statement.id, "draft");
    if (res.ok) {
      toast.success("ドラフトに戻しました");
      await refreshStatements();
      await loadStatement(statement.id);
    } else {
      toast.error(res.error);
    }
  }, [statement, refreshStatements, loadStatement]);

  const handleDelete = useCallback(async () => {
    if (!statement) return;
    const res = await deleteFinancialStatement(statement.id);
    if (res.ok) {
      toast.success("決算書を削除しました");
      const list = await refreshStatements();
      setSelectedId(list[0]?.id ?? null);
    } else {
      toast.error(res.error);
    }
  }, [statement, refreshStatements]);

  const hasExistingActuals = items.some(
    (i) => parseAmount((values[i.id] ?? EMPTY_LINE_VALUE).actual) !== 0,
  );

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* ヘッダー */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Landmark className="size-5 text-primary" />
          <h1 className="text-lg font-semibold">決算書</h1>
          <span className="text-xs text-muted-foreground">損益計算書（PL）・製造原価報告書</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setMasterOpen(true)}>
            <ListTree className="size-4" />
            勘定科目マスタ
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="size-4" />
            表示設定
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <FilePlus2 className="size-4" />
            新規作成
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* 決算書一覧（年度ごと） */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">決算書一覧</p>
          {statements.length === 0 && (
            <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              決算書がまだありません
            </p>
          )}
          <div className="space-y-1.5">
            {statements.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-left transition-colors hover:bg-accent",
                  selectedId === s.id && "border-primary bg-primary/5",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{s.fiscal_year}年度</span>
                  <Badge
                    variant={s.status === "final" ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {s.status === "final" ? "確定" : "ドラフト"}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.period_label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 決算書本体 */}
        <div className="min-w-0 space-y-3">
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
              <Landmark className="size-10 text-muted-foreground/50" />
              <div>
                <p className="font-medium">決算書を作成しましょう</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  期間を選んで1から作成するか、会計ソフトの決算書類（PDF / Excel / CSV）を読み込めます。
                </p>
              </div>
              <Button onClick={() => setCreateOpen(true)}>
                <FilePlus2 className="size-4" />
                決算書を新規作成
              </Button>
            </div>
          ) : loading || !statement ? (
            <div className="flex items-center justify-center rounded-xl border py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* 選択中の決算書ツールバー */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <p className="text-sm font-semibold">{statement.period_label}</p>
                    <p className="text-xs text-muted-foreground">
                      {statement.status === "final"
                        ? "確定済み（編集するにはドラフトに戻してください）"
                        : "ドラフト（編集可能）"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Switch
                      id="tax-toggle"
                      checked={showEstimatedTax}
                      onCheckedChange={setShowEstimatedTax}
                    />
                    <Label htmlFor="tax-toggle" className="text-xs text-muted-foreground">
                      法人税を概算表示（実効税率約30%）
                    </Label>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!readOnly && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                        <FileUp className="size-4" />
                        ファイル読込
                      </Button>
                      <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
                        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                        保存
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFinalizeConfirmOpen(true)}
                      >
                        <CheckCircle2 className="size-4" />
                        確定する
                      </Button>
                    </>
                  )}
                  {readOnly && (
                    <Button variant="outline" size="sm" onClick={handleRevertToDraft}>
                      <RotateCcw className="size-4" />
                      ドラフトに戻す
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              {/* PL表（No.86: 1枚構成） */}
              <PlTable
                items={items}
                values={values}
                onChange={handleValueChange}
                readOnly={!!readOnly}
                actualLabel={actualLabel}
                showEstimatedTax={showEstimatedTax}
                onOpenCostReport={() => setCostSheetOpen(true)}
              />
              <p className="text-xs text-muted-foreground">
                段階利益（売上総利益・営業利益・経常利益・税引前当期純利益）と各合計行は自動計算のため入力できません。金額は円単位で入力してください。
              </p>
            </>
          )}
        </div>
      </div>

      {/* 製造原価報告書（右からスライドイン） */}
      <CostReportSheet
        open={costSheetOpen}
        onOpenChange={setCostSheetOpen}
        items={items}
        values={values}
        onChange={handleValueChange}
        readOnly={!!readOnly}
        actualLabel={actualLabel}
      />

      {/* 各種ダイアログ */}
      <CreateStatementDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={async (created) => {
          await refreshStatements();
          if (selectedId === created.id) {
            await loadStatement(created.id);
          } else {
            setSelectedId(created.id);
          }
        }}
      />
      <ImportStatementDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        statement={statement}
        hasExistingActuals={hasExistingActuals}
        onImported={() => {
          if (statement) void loadStatement(statement.id);
        }}
      />
      <AccountMasterDialog
        open={masterOpen}
        onOpenChange={setMasterOpen}
        items={items}
        onItemsChanged={setItems}
      />
      <ReportSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        currentLabel={actualLabel}
        onSaved={setActualLabel}
      />

      {/* 確定の確認 */}
      <AlertDialog open={finalizeConfirmOpen} onOpenChange={setFinalizeConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>決算書を確定しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {statement?.period_label} を確定します。確定済みの決算書はBIダッシュボードから参照できるようになり、編集するにはドラフトに戻す必要があります。
              {dirty ? " 未保存の変更は確定前に自動保存されます。" : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setFinalizeConfirmOpen(false);
                void handleFinalize();
              }}
            >
              確定する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 削除の確認 */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>決算書を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {statement?.period_label} とその明細をすべて削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                setDeleteConfirmOpen(false);
                void handleDelete();
              }}
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
