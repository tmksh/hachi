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
  COGS_CATEGORIES,
  computePl,
  fmtCompositionRatio,
  fmtYen,
  fmtYoyRatio,
  type PlAmounts,
  type PlComputation,
  type PlLineEntry,
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
      className="h-7 w-full min-w-24 rounded-md px-2 text-right text-xs tabular-nums"
    />
  );
}

/** 共通ヘッダー行（No.88: 当期予算／当期実績／構成比／前期実績／前期比／差異理由・備考） */
function PlTableHeader({ actualLabel }: { actualLabel: string }) {
  return (
    <TableHeader>
      <TableRow className="bg-muted/50">
        <TableHead className="min-w-44">科目</TableHead>
        <TableHead className="w-32 text-right">当期予算</TableHead>
        <TableHead className="w-32 text-right">{actualLabel}</TableHead>
        <TableHead className="w-20 text-right">構成比</TableHead>
        <TableHead className="w-32 text-right">前期実績</TableHead>
        <TableHead className="w-20 text-right">前期比</TableHead>
        <TableHead className="min-w-44">差異理由・備考</TableHead>
      </TableRow>
    </TableHeader>
  );
}

/** 区分見出し行 */
function SectionHeaderRow({ label }: { label: string }) {
  return (
    <TableRow className="bg-muted/30 hover:bg-muted/30">
      <TableCell colSpan={7} className="py-1.5 text-xs font-semibold text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  );
}

/** 科目の編集可能行 */
function EditableItemRow({
  item,
  values,
  onChange,
  readOnly,
  revenueActual,
}: {
  item: FinancialAccountItem;
  values: EditableValues;
  onChange: ValueChangeHandler;
  readOnly: boolean;
  revenueActual: number;
}) {
  const v = values[item.id] ?? EMPTY_LINE_VALUE;
  const actual = parseAmount(v.actual);
  const prior = parseAmount(v.prior);
  return (
    <TableRow>
      <TableCell className="py-1 pl-6 text-sm">{item.name}</TableCell>
      <TableCell className="py-1">
        <AmountInput value={v.budget} onChange={(x) => onChange(item.id, "budget", x)} disabled={readOnly} />
      </TableCell>
      <TableCell className="py-1">
        <AmountInput value={v.actual} onChange={(x) => onChange(item.id, "actual", x)} disabled={readOnly} />
      </TableCell>
      <TableCell className="py-1 text-right text-xs tabular-nums text-muted-foreground">
        {fmtCompositionRatio(actual, revenueActual)}
      </TableCell>
      <TableCell className="py-1">
        <AmountInput value={v.prior} onChange={(x) => onChange(item.id, "prior", x)} disabled={readOnly} />
      </TableCell>
      <TableCell className="py-1 text-right text-xs tabular-nums text-muted-foreground">
        {fmtYoyRatio(actual, prior)}
      </TableCell>
      <TableCell className="py-1">
        <Input
          value={v.note}
          onChange={(e) => onChange(item.id, "note", e.target.value)}
          disabled={readOnly}
          placeholder=""
          className="h-7 w-full min-w-40 rounded-md px-2 text-xs"
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
  return (
    <TableRow
      onClick={onClick}
      className={cn(
        variant === "subtotal" && "bg-muted/40 font-medium hover:bg-muted/40",
        variant === "profit" && "bg-primary/5 font-semibold hover:bg-primary/5",
        variant === "estimate" && "bg-amber-50 text-amber-900 dark:bg-amber-900/15 dark:text-amber-300",
        onClick && "cursor-pointer transition-colors hover:bg-accent",
      )}
    >
      <TableCell className="py-1.5 text-sm">
        <span className="inline-flex items-center gap-1">
          {label}
          {actionLabel && (
            <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              {actionLabel}
              <ChevronRight className="size-3" />
            </span>
          )}
        </span>
      </TableCell>
      <TableCell className="py-1.5 pr-2 text-right text-sm tabular-nums">{fmtYen(amounts.budget)}</TableCell>
      <TableCell className="py-1.5 pr-2 text-right text-sm tabular-nums">{fmtYen(amounts.actual)}</TableCell>
      <TableCell className="py-1.5 text-right text-xs tabular-nums text-muted-foreground">
        {fmtCompositionRatio(amounts.actual, revenueActual)}
      </TableCell>
      <TableCell className="py-1.5 pr-2 text-right text-sm tabular-nums">{fmtYen(amounts.prior)}</TableCell>
      <TableCell className="py-1.5 text-right text-xs tabular-nums text-muted-foreground">
        {fmtYoyRatio(amounts.actual, amounts.prior)}
      </TableCell>
      <TableCell className="py-1.5 text-xs text-muted-foreground">{note ?? ""}</TableCell>
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
};

/** 損益計算書（PL 1枚構成・No.86） */
export function PlTable({
  items,
  values,
  onChange,
  readOnly,
  actualLabel,
  showEstimatedTax,
  onOpenCostReport,
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
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <PlTableHeader actualLabel={actualLabel} />
        <TableBody>
          {/* 売上高 */}
          <SectionHeaderRow label="売上高" />
          {renderEntries(pl.sectionEntries.revenue)}
          <ComputedRow label="売上高合計" amounts={pl.sectionTotals.revenue} revenueActual={revenueActual} />

          {/* 売上原価（No.86: クリックで製造原価報告書をスライドイン表示） */}
          <SectionHeaderRow label="売上原価" />
          <ComputedRow
            label="売上原価"
            amounts={pl.sectionTotals.cogs}
            revenueActual={revenueActual}
            onClick={onOpenCostReport}
            actionLabel="製造原価報告書"
            note="内訳は製造原価報告書で入力"
          />
          <ComputedRow label="売上総利益" amounts={pl.grossProfit} revenueActual={revenueActual} variant="profit" note="自動計算" />

          {/* 販売費及び一般管理費 */}
          <SectionHeaderRow label="販売費及び一般管理費" />
          {renderEntries(pl.sectionEntries.sga)}
          <ComputedRow label="販売費及び一般管理費合計" amounts={pl.sectionTotals.sga} revenueActual={revenueActual} />
          <ComputedRow label="営業利益" amounts={pl.operatingIncome} revenueActual={revenueActual} variant="profit" note="自動計算" />

          {/* 営業外収益 */}
          <SectionHeaderRow label="営業外収益" />
          {renderEntries(pl.sectionEntries.non_operating_income)}
          <ComputedRow label="営業外収益合計" amounts={pl.sectionTotals.non_operating_income} revenueActual={revenueActual} />

          {/* 営業外費用 */}
          <SectionHeaderRow label="営業外費用" />
          {renderEntries(pl.sectionEntries.non_operating_expense)}
          <ComputedRow label="営業外費用合計" amounts={pl.sectionTotals.non_operating_expense} revenueActual={revenueActual} />

          <ComputedRow label="経常利益" amounts={pl.ordinaryIncome} revenueActual={revenueActual} variant="profit" note="自動計算" />
          <ComputedRow label="税引前当期純利益" amounts={pl.pretaxIncome} revenueActual={revenueActual} variant="profit" note="自動計算" />

          {/* 法人税の概算表示（No.97: あくまで概算・デフォルトOFF） */}
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
 * 材料費／労務費／製造経費の3区分＋外注費で構成。
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-4xl">
        <SheetHeader>
          <SheetTitle>製造原価報告書</SheetTitle>
          <SheetDescription>
            材料費／労務費／外注費／製造経費の内訳を入力します。合計はPLの「売上原価」へ自動反映されます。
          </SheetDescription>
        </SheetHeader>
        <div className="overflow-x-auto px-4 pb-6">
          <div className="rounded-xl border">
            <Table>
              <PlTableHeader actualLabel={actualLabel} />
              <TableBody>
                {COGS_CATEGORIES.map((cat) => {
                  const entries = pl.sectionEntries.cogs.filter(
                    (e) => e.item.cogs_category === cat.key,
                  );
                  return (
                    <Fragment key={cat.key}>
                      <SectionHeaderRow label={cat.label} />
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
                        label={`${cat.label}合計`}
                        amounts={pl.cogsCategoryTotals[cat.key]}
                        revenueActual={revenueActual}
                      />
                    </Fragment>
                  );
                })}
                <ComputedRow
                  label="当期製造費用（売上原価合計）"
                  amounts={pl.sectionTotals.cogs}
                  revenueActual={revenueActual}
                  variant="profit"
                  note="自動計算"
                />
              </TableBody>
            </Table>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
