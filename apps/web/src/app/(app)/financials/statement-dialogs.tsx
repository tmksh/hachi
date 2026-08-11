"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, FileUp, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { cn } from "@/lib/utils";
import type { FinancialStatement } from "@/lib/database.types";
import {
  buildFinancialPeriodLabel,
  listFinancialFiscalYears,
} from "@/lib/financial-statements-utils";
import {
  createFinancialStatement,
  importFinancialActualsFromText,
  saveFinancialReportSettings,
} from "@/lib/actions/financial-statements";
import { extractFinancialFileText } from "@/lib/financial-file-text";

const IMPORT_ACCEPT = ".pdf,.xlsx,.xls,.csv";

/** ファイル読込の共通処理: テキスト抽出 → Linq でマッピング */
async function runImport(statementId: string, file: File): Promise<boolean> {
  let text: string;
  try {
    text = await extractFinancialFileText(file);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "ファイルの読み取りに失敗しました");
    return false;
  }
  const res = await importFinancialActualsFromText(statementId, text, file.name);
  if (!res.ok) {
    toast.error(res.error);
    return false;
  }
  if (res.unmatchedLabels.length > 0) {
    toast.warning(
      `${res.matchedCount}科目に実績を反映しました。対応する科目がなかった項目: ${res.unmatchedLabels.slice(0, 8).join("、")}${res.unmatchedLabels.length > 8 ? " ほか" : ""}`,
      { duration: 8000 },
    );
  } else {
    toast.success(`${res.matchedCount}科目に実績を反映しました`);
  }
  return true;
}

// ============================================================
// 新規作成（モック準拠: 期間選択 → ファイル読込 / 1から作成 の2択）
// ============================================================

export type CreateMethod = "import" | "scratch";

type CreateFormProps = {
  onCreated: (statement: FinancialStatement) => void;
  /** ダイアログ時のみ。空状態インラインでは省略 */
  onCancel?: () => void;
  initialMethod?: CreateMethod;
  /** 会社の決算開始月（未指定時は4月） */
  defaultStartMonth?: number;
  /** No.104: 期首日（表示設定） */
  periodStartDay?: number;
  /** 親がマウントし直したときなど、フォームをリセットするキー */
  resetKey?: string | number | boolean;
  className?: string;
};

/** 空状態・ダイアログ共通の作成フォーム（モック No.91-94 準拠） */
export function CreateStatementForm({
  onCreated,
  onCancel,
  initialMethod = "import",
  defaultStartMonth = 4,
  periodStartDay = 1,
  resetKey,
  className,
}: CreateFormProps) {
  const currentYear = new Date().getFullYear();
  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const [startMonth, setStartMonth] = useState(defaultStartMonth);
  const [method, setMethod] = useState<CreateMethod>(initialMethod);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMethod(initialMethod);
    setStartMonth(defaultStartMonth);
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }, [initialMethod, defaultStartMonth, resetKey]);

  const handleCreate = async () => {
    if (method === "import" && !file) {
      toast.error("読み込むファイルを選択してください");
      return;
    }

    setBusy(true);
    const res = await createFinancialStatement({ fiscalYear, startMonth });
    if (!res.ok) {
      toast.error(res.error);
      setBusy(false);
      return;
    }
    toast.success(`決算書「${res.statement.period_label}」を作成しました`);

    if (method === "import" && file) {
      await runImport(res.statement.id, file);
    }

    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    setBusy(false);
    onCreated(res.statement);
  };

  return (
    <div className={cn("space-y-4 text-left", className)}>
      <div className="space-y-1.5">
        <Label className="text-xs">対象期間</Label>
        <div className="flex gap-2">
          <Select value={String(fiscalYear)} onValueChange={(v) => setFiscalYear(Number(v))}>
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
                  {listFinancialFiscalYears().map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {buildFinancialPeriodLabel(y, startMonth, { startDay: periodStartDay })}
                    </SelectItem>
                  ))}
            </SelectContent>
          </Select>
          <Select value={String(startMonth)} onValueChange={(v) => setStartMonth(Number(v))}>
            <SelectTrigger className="w-[96px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <SelectItem key={m} value={String(m)}>{m}月開始</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-[11px] text-muted-foreground">
          会計ソフトの年度表記とズレることがあるため、期間はここで指定します（ラベルは自動生成・手入力不可）。
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-600">どの方法で作りますか？</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMethod("import")}
            className={cn(
              "rounded-xl border bg-white p-3.5 text-left transition-all",
              method === "import"
                ? "border-[#7C3AED] bg-[#F5F3FF] ring-1 ring-[#7C3AED]/35"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            <div className="flex items-start gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#7C3AED] text-white">
                <Download className="size-3.5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold text-slate-900">ファイルを読み込む</span>
                  <span className="rounded-full bg-[#EDE9FE] px-1.5 py-0.5 text-[10px] font-medium text-[#6D28D9]">
                    Linq が読み取ります
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                  PDF・Excel・CSV をそのまま読み込ませてください。Linq が中身を理解して、勘定科目と金額を展開します。
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setMethod("scratch");
              setFile(null);
              if (fileRef.current) fileRef.current.value = "";
            }}
            className={cn(
              "rounded-xl border bg-white p-3.5 text-left transition-all",
              method === "scratch"
                ? "border-[#1664C0] bg-[#EEF5FF] ring-1 ring-[#1664C0]/30"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            <div className="flex items-start gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1664C0] text-white">
                <Plus className="size-3.5" />
              </span>
              <div className="min-w-0">
                <span className="text-sm font-semibold text-slate-900">1から作成</span>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                  空の表に直接入力していきます。読み込めるファイルが無いときはこちら。
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  あとからファイル読込で実績を置換できます。
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {method === "import" && (
        <div className="space-y-1.5 rounded-lg border border-dashed p-3">
          <Label className="text-xs">読み込むファイル</Label>
          <Input
            ref={fileRef}
            type="file"
            accept={IMPORT_ACCEPT}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="h-9 text-xs"
          />
          {file && (
            <p className="truncate text-xs text-muted-foreground">{file.name}</p>
          )}
        </div>
      )}

      <div className={cn(
        "flex items-center gap-2 pt-1",
        onCancel ? "justify-between" : "justify-end",
      )}>
        {onCancel ? (
          <Button variant="outline" className="bg-white" onClick={onCancel} disabled={busy}>
            キャンセル
          </Button>
        ) : <span />}
        <Button
          className="bg-[#1664C0] hover:bg-[#1454A0]"
          onClick={handleCreate}
          disabled={busy || (method === "import" && !file)}
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          この方法で進む
        </Button>
      </div>
    </div>
  );
}

type CreateProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (statement: FinancialStatement) => void;
  initialMethod?: CreateMethod;
  defaultStartMonth?: number;
  periodStartDay?: number;
};

export function CreateStatementDialog({
  open,
  onOpenChange,
  onCreated,
  initialMethod = "import",
  defaultStartMonth = 4,
  periodStartDay = 1,
}: CreateProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl gap-0 p-0 overflow-hidden">
        <DialogHeader className="space-y-1 border-b border-border/60 px-6 py-5">
          <DialogTitle className="text-lg">決算書を作成</DialogTitle>
          <DialogDescription>
            作り方を選んでください。作成後も「ファイル読込」で実績を置換できます（No.102）。
          </DialogDescription>
        </DialogHeader>
        {open && (
          <div className="px-6 py-5">
            <CreateStatementForm
              initialMethod={initialMethod}
              defaultStartMonth={defaultStartMonth}
              periodStartDay={periodStartDay}
              resetKey={open}
              onCancel={() => onOpenChange(false)}
              onCreated={(statement) => {
                onOpenChange(false);
                onCreated(statement);
              }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// 作成済み決算書へのファイル読込（No.91/102: 置換方式＋確認ダイアログ）
// ============================================================

type ImportProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statement: FinancialStatement | null;
  /** 既存の実績値が入力済みか（trueなら置換確認を出す） */
  hasExistingActuals: boolean;
  onImported: () => void;
};

export function ImportStatementDialog({
  open,
  onOpenChange,
  statement,
  hasExistingActuals,
  onImported,
}: ImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const executeImport = async () => {
    if (!statement || !file) return;
    setBusy(true);
    const ok = await runImport(statement.id, file);
    setBusy(false);
    if (ok) {
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      onOpenChange(false);
      onImported();
    }
  };

  const handleSubmit = () => {
    if (!file) {
      toast.error("ファイルを選択してください");
      return;
    }
    // No.102: 再読込は「置換」方式。実行前に確認ダイアログを出す
    if (hasExistingActuals) {
      setConfirmOpen(true);
      return;
    }
    void executeImport();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ファイル読込</DialogTitle>
            <DialogDescription>
              {statement?.period_label} に決算書類（PDF / Excel / CSV）の実績値を読み込みます。Linq（AI）が勘定科目へ自動マッピングします。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              ref={fileRef}
              type="file"
              accept={IMPORT_ACCEPT}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="h-9 text-xs"
            />
            <p className="text-xs text-muted-foreground">
              読込は「置換」方式です。既存の実績値はすべて読込結果で上書きされます（予算・前期実績・差異理由は保持されます）。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              キャンセル
            </Button>
            <Button onClick={handleSubmit} disabled={busy || !file}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
              読み込む
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 置換の確認（No.102） */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>実績値を置換しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この決算書には既に実績値が入力されています。ファイル読込を実行すると、全科目の実績値が読込結果で置き換えられます（ファイルに含まれない科目は0になります）。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                void executeImport();
              }}
            >
              置換して読み込む
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============================================================
// 表示設定（No.101: 実績列の見出しを会社ごとに設定）
// ============================================================

type SettingsProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentLabel: string;
  /** No.104: 期首日（1〜28） */
  currentPeriodStartDay?: number;
  onSaved: (next: { label: string; periodStartDay: number }) => void;
};

export function ReportSettingsDialog({
  open,
  onOpenChange,
  currentLabel,
  currentPeriodStartDay = 1,
  onSaved,
}: SettingsProps) {
  const [label, setLabel] = useState(currentLabel);
  const [periodStartDay, setPeriodStartDay] = useState(String(currentPeriodStartDay));
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    setBusy(true);
    const day = Number(periodStartDay);
    const res = await saveFinancialReportSettings({
      actualColumnLabel: label,
      periodStartDay: day,
    });
    if (res.ok) {
      toast.success("表示設定を保存しました");
      onSaved({ label: label.trim(), periodStartDay: day });
      onOpenChange(false);
    } else {
      toast.error(res.error);
    }
    setBusy(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setLabel(currentLabel);
          setPeriodStartDay(String(currentPeriodStartDay));
        }
        if (!busy) onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>決算書の表示設定</DialogTitle>
          <DialogDescription>
            実績列の見出し（No.101）と、期間ラベルの期首日（No.104）を会社ごとに設定できます。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">実績列の見出し</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="実績（弥生）"
              maxLength={20}
            />
            <p className="text-[11px] text-muted-foreground">
              例: 実績（弥生）／実績（freee）／実績（マネーフォワード）
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">期首日（1〜28）</Label>
            <Select value={periodStartDay} onValueChange={setPeriodStartDay}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d}日（{d === 1 ? "月初〜月末" : `例: 3/${d}〜翌3/${d - 1}`}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              手入力の期間ラベルは禁止です。新規作成時のラベルに反映されます。
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={busy || !label.trim()}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
