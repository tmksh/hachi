"use client";

import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { FinancialAccountItem } from "@/lib/database.types";
import {
  COGS_DISPLAY_CATEGORIES,
  computePl,
  fmtCompositionRatio,
  fmtYen,
  fmtYoyRatio,
  isOutsourcingAccount,
  type PlAmounts,
  type PlComputation,
} from "@/lib/financial-statements-utils";
import {
  buildLinesForCompute,
  EMPTY_LINE_VALUE,
  parseAmount,
  type EditableLineValue,
  type EditableValues,
} from "./financials-shared";

type ValueChangeHandler = (
  itemId: string,
  field: keyof EditableLineValue,
  value: string,
) => void;

function AmountInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      inputMode="numeric"
      placeholder="0"
      className={cn(
        "h-8 w-full min-w-24 rounded-md border-border/70 bg-white px-2 text-right text-xs tabular-nums shadow-none",
        "focus-visible:border-ring/50 focus-visible:ring-2 focus-visible:ring-ring/20",
        disabled && "bg-transparent border-transparent shadow-none disabled:opacity-100",
      )}
    />
  );
}

/** 共通ヘッダー行（No.88: 当期予算／当期実績／構成比／前期実績／前期比／差異理由・備考） */
function PlTableHeader({ actualLabel }: { actualLabel: string }) {
  return (
    <TableHeader>
      <TableRow className="border-b border-border/60 hover:bg-transparent">
        <TableHead className="h-10 min-w-44 px-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          勘定科目
        </TableHead>
        <TableHead className="h-10 w-32 px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          当期予算
        </TableHead>
        <TableHead className="h-10 w-32 px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {actualLabel}
        </TableHead>
        <TableHead className="h-10 w-20 px-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          構成比
        </TableHead>
        <TableHead className="h-10 w-32 px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          前期実績
        </TableHead>
        <TableHead className="h-10 w-20 px-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          前期比
        </TableHead>
        <TableHead className="h-10 min-w-40 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          差異理由・備考
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}

/** 区分見出し行（No.87: 3階層の第1層） */
function SectionHeaderRow({ label }: { label: string }) {
  const text = label.startsWith("【") || label.startsWith("[") ? label : `【${label}】`;
  return (
    <TableRow className="bg-[#F7F8FA] hover:bg-[#F7F8FA] dark:bg-muted/40">
      <TableCell colSpan={7} className="px-4 py-2 text-[11px] font-semibold tracking-wide text-slate-500">
        {text}
      </TableCell>
    </TableRow>
  );
}

/** 科目の編集可能行（No.87: 3階層の第2層） */
function EditableItemRow({
  item,
  values,
  onChange,
  readOnly,
  revenueActual,
  depth = 1,
}: {
  item: FinancialAccountItem;
  values: EditableValues;
  onChange: ValueChangeHandler;
  readOnly: boolean;
  revenueActual: number;
  /** インデント段（1=通常科目） */
  depth?: number;
}) {
  const v = values[item.id] ?? EMPTY_LINE_VALUE;
  const actual = parseAmount(v.actual);
  const prior = parseAmount(v.prior);
  const highlightOutsourcing = isOutsourcingAccount(item);
  return (
    <TableRow className={cn(
      "border-border/50",
      highlightOutsourcing && "bg-orange-50/70 dark:bg-orange-950/20",
    )}>
      <TableCell
        className={cn(
          "py-2 pr-3 text-sm text-slate-800",
          highlightOutsourcing && "font-semibold text-orange-600",
        )}
        style={{ paddingLeft: `${16 + depth * 16}px` }}
      >
        {item.name}
      </TableCell>
      <TableCell className="py-1.5 px-2">
        <AmountInput value={v.budget} onChange={(x) => onChange(item.id, "budget", x)} disabled={readOnly} />
      </TableCell>
      <TableCell className="py-1.5 px-2">
        <AmountInput value={v.actual} onChange={(x) => onChange(item.id, "actual", x)} disabled={readOnly} />
      </TableCell>
      <TableCell className="py-2 px-2 text-right text-xs tabular-nums text-slate-500">
        {fmtCompositionRatio(actual, revenueActual)}
      </TableCell>
      <TableCell className="py-1.5 px-2">
        <AmountInput value={v.prior} onChange={(x) => onChange(item.id, "prior", x)} disabled={readOnly} />
      </TableCell>
      <TableCell className="py-2 px-2 text-right text-xs tabular-nums text-slate-500">
        {fmtYoyRatio(actual, prior)}
      </TableCell>
      <TableCell className="py-1.5 px-2">
        <Input
          value={v.note}
          onChange={(e) => onChange(item.id, "note", e.target.value)}
          disabled={readOnly}
          placeholder=""
          className={cn(
            "h-8 w-full min-w-40 rounded-md border-border/70 bg-white px-2 text-xs shadow-none",
            readOnly && "border-transparent bg-transparent disabled:opacity-100",
          )}
        />
      </TableCell>
    </TableRow>
  );
}

/**
 * 自動計算行（No.89: 段階利益・合計行は手入力禁止）
 */
function ComputedRow({
  label,
  amounts,
  revenueActual,
  variant = "subtotal",
  note,
  onClick,
  actionLabel,
}: {
  label: string;
  amounts: PlAmounts;
  revenueActual: number;
  variant?: "subtotal" | "profit" | "estimate";
  note?: string;
  onClick?: () => void;
  actionLabel?: string;
}) {
  const isProfit = variant === "profit";
  const isLink = Boolean(onClick);
  return (
    <TableRow
      onClick={onClick}
      className={cn(
        "border-border/50",
        variant === "subtotal" && "bg-[#F3F4F6]/80 font-medium hover:bg-[#F3F4F6]/80",
        isProfit && "bg-[#EEF5FF] font-semibold hover:bg-[#EEF5FF] dark:bg-sky-950/30",
        variant === "estimate" && "bg-amber-50 text-amber-900 dark:bg-amber-900/15 dark:text-amber-300",
        isLink && "cursor-pointer transition-colors hover:bg-[#E8F1FF]",
      )}
    >
      <TableCell className={cn("px-4 py-2.5 text-sm", isProfit && "text-[#1664C0]", isLink && "text-[#1664C0]")}>
        <span className="inline-flex items-center gap-1.5">
          {isProfit || label.trimStart().startsWith("=") ? (
            <span className="tabular-nums text-[#1664C0]">
              {label.trimStart().startsWith("=") ? label : `= ${label}`}
            </span>
          ) : (
            label
          )}
          {actionLabel && (
            <span className="ml-0.5 inline-flex items-center gap-0.5 rounded-full bg-[#1664C0]/10 px-2 py-0.5 text-[10px] font-medium text-[#1664C0]">
              {actionLabel}
              <ChevronRight className="size-3" />
            </span>
          )}
        </span>
      </TableCell>
      <TableCell className={cn("px-3 py-2.5 text-right text-sm tabular-nums", isProfit && "text-[#1664C0]")}>
        {fmtYen(amounts.budget)}
      </TableCell>
      <TableCell className={cn("px-3 py-2.5 text-right text-sm tabular-nums", isProfit && "text-[#1664C0]")}>
        {fmtYen(amounts.actual)}
      </TableCell>
      <TableCell className="px-2 py-2.5 text-right text-xs tabular-nums text-slate-500">
        {fmtCompositionRatio(amounts.actual, revenueActual)}
      </TableCell>
      <TableCell className={cn("px-3 py-2.5 text-right text-sm tabular-nums", isProfit && "text-[#1664C0]")}>
        {fmtYen(amounts.prior)}
      </TableCell>
      <TableCell className="px-2 py-2.5 text-right text-xs tabular-nums text-slate-500">
        {fmtYoyRatio(amounts.actual, amounts.prior)}
      </TableCell>
      <TableCell className="px-3 py-2.5 text-xs text-slate-500">{note ?? ""}</TableCell>
    </TableRow>
  );
}

export type PlTableProps = {
  items: FinancialAccountItem[];
  values: EditableValues;
  onChange: ValueChangeHandler;
  readOnly: boolean;
  /** 実績列の見出し（No.101: 会社ごとに設定可能） */
  actualLabel: string;
  /** 法人税概算表示トグル（No.97: デフォルトOFF） */
  showEstimatedTax: boolean;
  onOpenCostReport: () => void;
  /** 科目追加（勘定科目マスタを開く） */
  onAddAccount?: () => void;
};

/** 損益計算書（PL 1枚構成・No.86）。階層は 区分→科目→合計（No.87） */
export function PlTable({
  items,
  values,
  onChange,
  readOnly,
  actualLabel,
  showEstimatedTax,
  onOpenCostReport,
  onAddAccount,
}: PlTableProps) {
  const pl: PlComputation = computePl(items, buildLinesForCompute(items, values));
  const revenueActual = pl.sectionTotals.revenue.actual;

  const renderEntries = (entries: PlLineEntry[]) =>
    entries.map((e) => (
      <EditableItemRow
        key={e.item.id}
        item={e.item}
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        revenueActual={revenueActual}
      />
    ));

  return (
    <div className="space-y-2">
      <div className="frost-card-inset overflow-x-auto rounded-xl">
        <Table>
          <PlTableHeader actualLabel={actualLabel} />
          <TableBody>
            <SectionHeaderRow label="売上高" />
            {renderEntries(pl.sectionEntries.revenue)}
            <ComputedRow label="= 売上高合計" amounts={pl.sectionTotals.revenue} revenueActual={revenueActual} />

            <SectionHeaderRow label="売上原価" />
            <ComputedRow
              label="売上原価"
              amounts={pl.productManufacturingCost}
              revenueActual={revenueActual}
              onClick={onOpenCostReport}
              actionLabel="製造原価報告書"
              note="クリックで内訳を表示"
            />
            <ComputedRow label="売上総利益" amounts={pl.grossProfit} revenueActual={revenueActual} variant="profit" note="自動計算（入力不可）" />

            <SectionHeaderRow label="販売費及び一般管理費" />
            {renderEntries(pl.sectionEntries.sga)}
            <ComputedRow label="= 販売費及び一般管理費合計" amounts={pl.sectionTotals.sga} revenueActual={revenueActual} />
            <ComputedRow label="営業利益" amounts={pl.operatingIncome} revenueActual={revenueActual} variant="profit" note="自動計算（入力不可）" />

            <SectionHeaderRow label="営業外収益" />
            {renderEntries(pl.sectionEntries.non_operating_income)}
            <ComputedRow label="= 営業外収益合計" amounts={pl.sectionTotals.non_operating_income} revenueActual={revenueActual} />

            <SectionHeaderRow label="営業外費用" />
            {renderEntries(pl.sectionEntries.non_operating_expense)}
            <ComputedRow label="= 営業外費用合計" amounts={pl.sectionTotals.non_operating_expense} revenueActual={revenueActual} />

            <ComputedRow label="経常利益" amounts={pl.ordinaryIncome} revenueActual={revenueActual} variant="profit" note="自動計算（入力不可）" />
            <ComputedRow label="税引前当期純利益" amounts={pl.pretaxIncome} revenueActual={revenueActual} variant="profit" note="自動計算（入力不可）" />

            {showEstimatedTax && (
              <>
                <ComputedRow
                  label="法人税等（概算）"
                  amounts={pl.estimatedTax}
                  revenueActual={revenueActual}
                  variant="estimate"
                  note="税引前利益 × 実効税率約30%の概算値"
                />
                <ComputedRow
                  label="当期純利益（概算）"
                  amounts={pl.estimatedNetIncome}
                  revenueActual={revenueActual}
                  variant="estimate"
                  note="概算法人税控除後"
                />
              </>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-[11px] text-slate-500">
          階層: 区分 → 科目 → 合計（「=」は自動計算・手入力不可）
        </p>
        {onAddAccount && !readOnly && (
          <button
            type="button"
            onClick={onAddAccount}
            className="text-xs font-medium text-[#1664C0] hover:underline"
          >
            ＋ 勘定科目を追加
          </button>
        )}
      </div>
    </div>
  );
}

export type CostReportSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: FinancialAccountItem[];
  values: EditableValues;
  onChange: ValueChangeHandler;
  readOnly: boolean;
  actualLabel: string;
};

/**
 * 製造原価報告書（No.86/90）: 「売上原価」行クリックで右からスライドイン。
 * 材料費／労務費／製造経費の3区分。外注加工費は製造経費内でオレンジ強調。
 * 総製造費用 + 期首仕掛 − 期末仕掛 = 当期製品製造原価 → PL売上原価。
 */
export function CostReportSheet({
  open,
  onOpenChange,
  items,
  values,
  onChange,
  readOnly,
  actualLabel,
}: CostReportSheetProps) {
  const pl = computePl(items, buildLinesForCompute(items, values));
  const revenueActual = pl.sectionTotals.revenue.actual;
  const beginWip = pl.wipEntries.begin.reduce(
    (s, e) => ({
      budget: s.budget + e.amounts.budget,
      actual: s.actual + e.amounts.actual,
      prior: s.prior + e.amounts.prior,
    }),
    { budget: 0, actual: 0, prior: 0 },
  );
  const endWip = pl.wipEntries.end.reduce(
    (s, e) => ({
      budget: s.budget + e.amounts.budget,
      actual: s.actual + e.amounts.actual,
      prior: s.prior + e.amounts.prior,
    }),
    { budget: 0, actual: 0, prior: 0 },
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-4xl">
        <SheetHeader className="border-b border-border/60 pb-4">
          <SheetTitle className="text-base">製造原価報告書</SheetTitle>
          <SheetDescription>
            PLの「売上原価」内訳（材料費・労務費・製造経費）。合計は売上原価へ自動反映されます。
          </SheetDescription>
        </SheetHeader>
        <div className="overflow-x-auto px-4 pb-6 pt-2">
          <div className="frost-card-inset rounded-xl">
            <Table>
              <PlTableHeader actualLabel={actualLabel} />
              <TableBody>
                {COGS_DISPLAY_CATEGORIES.map((cat) => {
                  const entries = pl.cogsDisplayEntries[cat.key];
                  return (
                    <Fragment key={cat.key}>
                      <SectionHeaderRow label={`【${cat.label}】`} />
                      {entries.map((e) => (
                        <EditableItemRow
                          key={e.item.id}
                          item={e.item}
                          values={values}
                          onChange={onChange}
                          readOnly={readOnly}
                          revenueActual={revenueActual}
                        />
                      ))}
                      <ComputedRow
                        label={`= ${cat.label}`}
                        amounts={pl.cogsDisplayTotals[cat.key]}
                        revenueActual={revenueActual}
                        variant="subtotal"
                      />
                    </Fragment>
                  );
                })}

                <ComputedRow
                  label="= 総製造費用"
                  amounts={pl.totalManufacturingCost}
                  revenueActual={revenueActual}
                  variant="profit"
                  note="材料費＋労務費＋製造経費"
                />

                {pl.wipEntries.begin.map((e) => (
                  <EditableItemRow
                    key={e.item.id}
                    item={e.item}
                    values={values}
                    onChange={onChange}
                    readOnly={readOnly}
                    revenueActual={revenueActual}
                  />
                ))}
                {pl.wipEntries.begin.length === 0 && (
                  <ComputedRow
                    label="+ 期首仕掛品棚卸高"
                    amounts={beginWip}
                    revenueActual={revenueActual}
                    note="科目未登録"
                  />
                )}
                {pl.wipEntries.end.map((e) => (
                  <EditableItemRow
                    key={e.item.id}
                    item={e.item}
                    values={values}
                    onChange={onChange}
                    readOnly={readOnly}
                    revenueActual={revenueActual}
                  />
                ))}
                {pl.wipEntries.end.length === 0 && (
                  <ComputedRow
                    label="− 期末仕掛品棚卸高"
                    amounts={endWip}
                    revenueActual={revenueActual}
                    note="科目未登録"
                  />
                )}

                <ComputedRow
                  label="= 当期製品製造原価"
                  amounts={pl.productManufacturingCost}
                  revenueActual={revenueActual}
                  variant="profit"
                  note="→ PLの売上原価へ反映"
                />
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            外注加工費は建設業で売上の大半を占めることが多いため強調表示しています（No.90）。
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
