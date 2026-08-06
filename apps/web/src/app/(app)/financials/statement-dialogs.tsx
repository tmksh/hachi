"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp, Loader2, Sparkles } from "lucide-react";
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
import type { FinancialStatement } from "@/lib/database.types";
import {
  buildFinancialPeriodLabel,
  listFinancialFiscalYears,
} from "@/lib/financial-statements-utils";
import {
  createFinancialStatement,
  importFinancialActualsFromText,
  saveFinancialActualColumnLabel,
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
// 新規作成（No.93「1から作成」を主導線に、No.91 ファイル読込を併設）
// ============================================================

type CreateProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (statement: FinancialStatement) => void;
};

export function CreateStatementDialog({ open, onOpenChange, onCreated }: CreateProps) {
  const currentYear = new Date().getFullYear();
  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const [startMonth, setStartMonth] = useState(4);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCreate = async () => {
    setBusy(true);
    const res = await createFinancialStatement({ fiscalYear, startMonth });
    if (!res.ok) {
      toast.error(res.error);
      setBusy(false);
      return;
    }
    toast.success(`決算書「${res.statement.period_label}」を作成しました`);

    if (file) {
      await runImport(res.statement.id, file);
    }

    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    setBusy(false);
    onOpenChange(false);
    onCreated(res.statement);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>決算書を新規作成</DialogTitle>
          <DialogDescription>
            決算期の開始月と年度を選択してください。対象期間のラベルは自動で生成されます。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">年度（開始年）</Label>
              <Select value={String(fiscalYear)} onValueChange={(v) => setFiscalYear(Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {listFinancialFiscalYears().map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}年</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">決算期の開始月</Label>
              <Select value={String(startMonth)} onValueChange={(v) => setStartMonth(Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>{m}月</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
            対象期間: <span className="font-medium">{buildFinancialPeriodLabel(fiscalYear, startMonth)}</span>
            <p className="mt-0.5 text-xs text-muted-foreground">ラベルは自動生成されます（手入力不可）</p>
          </div>

          <div className="space-y-1.5 rounded-lg border border-dashed p-3">
            <Label className="flex items-center gap-1.5 text-xs">
              <Sparkles className="size-3.5 text-primary" />
              ファイル読込（任意）
            </Label>
            <Input
              ref={fileRef}
              type="file"
              accept={IMPORT_ACCEPT}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="h-9 text-xs"
            />
            <p className="text-xs text-muted-foreground">
              PDF / Excel / CSV の決算書類をアップロードすると、Linq（AI）が勘定科目へ自動マッピングして実績値を展開します。書式は問いません。
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            キャンセル
          </Button>
          <Button onClick={handleCreate} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {file ? "作成してファイル読込" : "1から作成"}
          </Button>
        </DialogFooter>
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
  onSaved: (label: string) => void;
};

export function ReportSettingsDialog({ open, onOpenChange, currentLabel, onSaved }: SettingsProps) {
  const [label, setLabel] = useState(currentLabel);
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    setBusy(true);
    const res = await saveFinancialActualColumnLabel(label);
    if (res.ok) {
      toast.success("実績列の見出しを保存しました");
      onSaved(label.trim());
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
        if (o) setLabel(currentLabel);
        if (!busy) onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>決算書の表示設定</DialogTitle>
          <DialogDescription>
            実績列の見出しを会社ごとに設定できます（例: 「実績（弥生）」「実績（freee）」）。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label className="text-xs">実績列の見出し</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="当期実績"
            maxLength={20}
          />
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
