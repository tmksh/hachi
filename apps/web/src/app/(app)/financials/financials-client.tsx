"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  FilePlus2,
  FileUp,
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
import { getCompanyFiscalMonthStart } from "@/lib/actions/profiles";
import type { FinancialDisplayUnit } from "@/lib/financial-statements-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  CreateStatementForm,
  ImportStatementDialog,
  ReportSettingsDialog,
} from "./statement-dialogs";
import { buildFinancialsMockPreview } from "./financials-mock-data";

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
  const [reverting, setReverting] = useState(false);

  const [actualLabel, setActualLabel] = useState(
    initialSettings?.actual_column_label?.trim() || "当期実績",
  );
  const [periodStartDay, setPeriodStartDay] = useState(
    initialSettings?.period_start_day && initialSettings.period_start_day >= 1
      ? initialSettings.period_start_day
      : 1,
  );
  // No.89: 当期純利益を段階利益として常時出すため、法人税概算はデフォルトON
  const [showEstimatedTax, setShowEstimatedTax] = useState(true);
  // No.82: 決算書は千円表示が既定（入力保存は常に円）
  const [displayUnit, setDisplayUnit] = useState<FinancialDisplayUnit>("thousand");
  const [costSheetOpen, setCostSheetOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [masterOpen, setMasterOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [finalizeConfirmOpen, setFinalizeConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [fiscalMonthStart, setFiscalMonthStart] = useState(4);
  /** No.85: 初期は空白（作成導線）。サンプルは明示表示 */
  const [showSample, setShowSample] = useState(false);

  const readOnly = statement?.status === "final";
  const mock = useMemo(() => buildFinancialsMockPreview(items), [items]);
  const isEmpty = statements.length === 0 && !showSample;
  const isMockPreview = statements.length === 0 && showSample;

  useEffect(() => {
    void getCompanyFiscalMonthStart().then(setFiscalMonthStart).catch(() => {});
  }, []);

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
    if (!statement) {
      toast.error("決算書が選択されていません");
      return;
    }
    if (reverting) return;
    setReverting(true);
    try {
      const res = await setFinancialStatementStatus(statement.id, "draft");
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // 一覧・詳細を待たず先に UI を編集可能にする（更新0件の成功誤認を防ぐ）
      setStatement((prev) => (prev ? { ...prev, status: "draft", finalized_at: null } : prev));
      setStatements((prev) =>
        prev.map((s) => (s.id === statement.id ? { ...s, status: "draft" as const, finalized_at: null } : s)),
      );
      toast.success("ドラフトに戻しました。編集できるようになりました");
      await refreshStatements();
      await loadStatement(statement.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ドラフトに戻せませんでした");
    } finally {
      setReverting(false);
    }
  }, [statement, reverting, refreshStatements, loadStatement]);

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

  const viewItems = isMockPreview ? mock.items : items;
  const viewValues = isMockPreview ? mock.values : values;
  const viewReadOnly = isMockPreview || readOnly;

  return (
    <div className="space-y-4 p-4 md:p-6 min-h-screen">
      {/* ヘッダー（Okta寄り: 余白広め・薄いカード） */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">決算書</h1>
          {isMockPreview ? (
            <>
              <span className="text-sm text-slate-500">{mock.periodLabel}</span>
              <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                速報値
              </span>
              <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">
                モック
              </span>
            </>
          ) : (
            <span className="text-sm text-slate-500">損益計算書（PL）・製造原価報告書</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="bg-white" onClick={() => setMasterOpen(true)}>
            <ListTree className="size-4" />
            勘定科目マスタ
          </Button>
          <Select
            value={displayUnit}
            onValueChange={(v) => setDisplayUnit(v as FinancialDisplayUnit)}
          >
            <SelectTrigger className="h-8 w-[100px] bg-white text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="thousand">千円</SelectItem>
              <SelectItem value="yen">円</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="bg-white" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="size-4" />
            表示設定
          </Button>
          {statements.length > 0 && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <FilePlus2 className="size-4" />
              新規作成
            </Button>
          )}
        </div>
      </div>

      {isEmpty ? (
        /* No.85: 最初は空白。作成フォームのみ */
        <div className="mx-auto w-full max-w-2xl space-y-3">
          <div className="rounded-xl border bg-white px-5 py-6 shadow-sm sm:px-6">
            <div className="mb-4">
              <p className="text-base font-semibold text-slate-900">決算書を作成</p>
              <p className="mt-0.5 text-sm text-slate-500">
                作り方を選んでください。作成後は見積作成と同系統の空の表が開き、あとからファイル読込で実績を置換できます。
              </p>
            </div>
            <CreateStatementForm
              defaultStartMonth={fiscalMonthStart}
              periodStartDay={periodStartDay}
              onCreated={async (created) => {
                setShowSample(false);
                await refreshStatements();
                setSelectedId(created.id);
              }}
            />
          </div>
          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowSample(true)}
              className="text-xs font-medium text-[#1664C0] hover:underline"
            >
              サンプル表を見る（UI確認用）
            </button>
          </div>
        </div>
      ) : isMockPreview ? (
        <div className="space-y-3">
          <div className="frost-card flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{mock.periodLabel}</p>
              <p className="text-xs text-slate-500">
                UI確認用のモックです。売上原価をクリックすると製造原価報告書が開きます。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Switch
                  id="tax-toggle-mock"
                  checked={showEstimatedTax}
                  onCheckedChange={setShowEstimatedTax}
                />
                <Label htmlFor="tax-toggle-mock" className="text-xs text-slate-500">
                  法人税を概算表示
                </Label>
              </div>
              <Button size="sm" variant="outline" className="bg-white" onClick={() => setShowSample(false)}>
                サンプルを閉じる
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <FilePlus2 className="size-4" />
                本番データを作成
              </Button>
            </div>
          </div>
          <PlTable
            items={viewItems}
            values={viewValues}
            onChange={() => {}}
            readOnly
            actualLabel={actualLabel}
            showEstimatedTax={showEstimatedTax}
            displayUnit={displayUnit}
            onOpenCostReport={() => setCostSheetOpen(true)}
            onAddAccount={() => setMasterOpen(true)}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold text-slate-500">年度</span>
            {statements.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors bg-white",
                  selectedId === s.id
                    ? "border-[#1664C0]/40 bg-[#EEF5FF] text-[#1664C0]"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50",
                )}
              >
                {s.fiscal_year}年度
                <Badge
                  variant={s.status === "final" ? "default" : "secondary"}
                  className="h-4 px-1.5 text-[10px]"
                >
                  {s.status === "final" ? "確定" : "ドラフト"}
                </Badge>
              </button>
            ))}
          </div>

          <div className="min-w-0 space-y-3">
            {!selectedId || loading || !statement ? (
              <div className="flex items-center justify-center rounded-xl border bg-white py-20">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="frost-card flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{statement.period_label}</p>
                        {statement.status === "final" ? (
                          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                            確定
                          </span>
                        ) : (
                          <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            速報値
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
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
                      <Label htmlFor="tax-toggle" className="text-xs text-slate-500" title="申告用の税種別計算ではなく、税引前利益×約30%の簡易概算です（No.97）">
                        法人税を概算表示（約30%）
                      </Label>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!readOnly && (
                      <>
                        <Button variant="outline" size="sm" className="bg-white" onClick={() => setImportOpen(true)}>
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
                          className="bg-white"
                          onClick={() => setFinalizeConfirmOpen(true)}
                        >
                          <CheckCircle2 className="size-4" />
                          確定する
                        </Button>
                      </>
                    )}
                    {readOnly && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-white"
                        disabled={reverting}
                        onClick={() => void handleRevertToDraft()}
                      >
                        {reverting ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
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

                <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] leading-relaxed text-slate-600 space-y-1">
                  <p>
                    <b>No.98 人件費振分:</b> 労務費を製造原価／販管費のどちらに置くかは勘定科目マスタで設定します（明細行単位の自動振分は対象外）。
                  </p>
                  <p>
                    <b>No.99 予定配賦:</b> 部門製造間接費の案件配賦はBI側の予定配賦（期首設定）で扱います。決算書の数値そのものには按分しません。
                  </p>
                  {showEstimatedTax && (
                    <p>
                      <b>No.97 法人税:</b> 表示中の概算は税引前×約30%です。加算・減算や税種別（法人税／住民税等）の申告計算は含みません。
                    </p>
                  )}
                </div>

                <PlTable
                  items={viewItems}
                  values={viewValues}
                  onChange={handleValueChange}
                  readOnly={viewReadOnly}
                  actualLabel={actualLabel}
                  showEstimatedTax={showEstimatedTax}
                  displayUnit={displayUnit}
                  onOpenCostReport={() => setCostSheetOpen(true)}
                  onAddAccount={() => setMasterOpen(true)}
                />
                <p className="text-xs text-slate-500">
                  「=」付きの行は自動計算のため入力できません。表は見積作成と同系統の入力です（Tabで移動・Enterで確定）。保存値は円、表示は{displayUnit === "thousand" ? "千円" : "円"}です。
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <CostReportSheet
        open={costSheetOpen}
        onOpenChange={setCostSheetOpen}
        items={viewItems}
        values={viewValues}
        onChange={isMockPreview ? () => {} : handleValueChange}
        readOnly={viewReadOnly}
        actualLabel={actualLabel}
        displayUnit={displayUnit}
      />

      {/* 各種ダイアログ */}
      <CreateStatementDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultStartMonth={fiscalMonthStart}
        periodStartDay={periodStartDay}
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
        currentPeriodStartDay={periodStartDay}
        onSaved={({ label, periodStartDay: day }) => {
          setActualLabel(label);
          setPeriodStartDay(day);
          // No.104: 期首日変更後の period_label 再生成を画面に反映
          void refreshStatements().then(() => {
            if (selectedId) void loadStatement(selectedId);
          });
        }}
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
