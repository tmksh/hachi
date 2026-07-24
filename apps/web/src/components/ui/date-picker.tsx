"use client";

import { useMemo, useState } from "react";
import { format, isValid, parse } from "date-fns";
import { ja } from "date-fns/locale";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

type CalendarDay = {
  date: Date;
  inMonth: boolean;
};

/** 表示月の6週間分（42日）のセルを生成 */
function buildCalendarDays(year: number, month: number): CalendarDay[] {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay(); // 日曜始まり
  const days: CalendarDay[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(year, month, 1 - startOffset + i);
    days.push({ date, inMonth: date.getMonth() === month });
  }
  return days;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const MONTH_LABELS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"] as const;

type CalendarPanel = "days" | "months" | "years";

/** BRIDGE Linq 独自カレンダー（ライブラリ非依存） */
export function BrandCalendar({
  selected,
  onSelect,
  className,
}: {
  selected?: Date;
  onSelect: (date: Date) => void;
  className?: string;
}) {
  const today = new Date();
  const base = selected ?? today;
  const [viewYear, setViewYear] = useState(base.getFullYear());
  const [viewMonth, setViewMonth] = useState(base.getMonth());
  const [panel, setPanel] = useState<CalendarPanel>("days");

  const days = useMemo(() => buildCalendarDays(viewYear, viewMonth), [viewYear, viewMonth]);

  /** 年グリッドの先頭（12年分） */
  const yearStart = Math.floor(viewYear / 12) * 12;
  const yearOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => yearStart + i),
    [yearStart],
  );

  const moveMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const headerLabel =
    panel === "days"
      ? `${viewYear}年${viewMonth + 1}月`
      : panel === "months"
        ? `${viewYear}年`
        : `${yearStart}年 – ${yearStart + 11}年`;

  const onHeaderClick = () => {
    if (panel === "days") setPanel("months");
    else if (panel === "months") setPanel("years");
  };

  const onPrev = () => {
    if (panel === "days") moveMonth(-1);
    else if (panel === "months") setViewYear((y) => y - 1);
    else setViewYear((y) => y - 12);
  };

  const onNext = () => {
    if (panel === "days") moveMonth(1);
    else if (panel === "months") setViewYear((y) => y + 1);
    else setViewYear((y) => y + 12);
  };

  return (
    <div className={cn("w-[272px] p-3 select-none", className)}>
      {/* ヘッダー: 月/年移動。中央クリックで月→年選択へ */}
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={onPrev}
          aria-label={panel === "years" ? "前の年代" : panel === "months" ? "前の年" : "前の月"}
          className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-500 transition-colors hover:bg-[rgba(var(--brand-accent-rgb),0.6)] hover:text-slate-800"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onHeaderClick}
          disabled={panel === "years"}
          className={cn(
            "px-2 py-1 rounded-lg text-sm font-bold tracking-wide text-slate-900 transition-colors",
            panel !== "years" && "hover:bg-[rgba(var(--brand-accent-rgb),0.6)] cursor-pointer",
            panel === "years" && "cursor-default",
          )}
          title={panel === "days" ? "月を選択" : panel === "months" ? "年を選択" : undefined}
        >
          {headerLabel}
        </button>
        <button
          type="button"
          onClick={onNext}
          aria-label={panel === "years" ? "次の年代" : panel === "months" ? "次の年" : "次の月"}
          className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-500 transition-colors hover:bg-[rgba(var(--brand-accent-rgb),0.6)] hover:text-slate-800"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {panel === "years" && (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {yearOptions.map((year) => {
            const isSelected = year === viewYear;
            const isCurrent = year === today.getFullYear();
            return (
              <button
                key={year}
                type="button"
                onClick={() => {
                  setViewYear(year);
                  setPanel("months");
                }}
                className={cn(
                  "h-10 rounded-lg text-sm font-medium tabular-nums transition-colors",
                  !isSelected && "text-slate-700 hover:bg-[rgba(var(--brand-accent-rgb),0.7)]",
                  isCurrent && !isSelected && "ring-1 ring-inset font-bold",
                  isSelected && "text-white font-bold shadow-sm",
                )}
                style={{
                  ...(isSelected ? { background: "var(--brand-gradient)" } : {}),
                  ...(isCurrent && !isSelected
                    ? { ["--tw-ring-color" as string]: "var(--brand-dark)", color: "var(--brand-dark)" }
                    : {}),
                }}
              >
                {year}
              </button>
            );
          })}
        </div>
      )}

      {panel === "months" && (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {MONTH_LABELS.map((label, month) => {
            const isCurrent = viewYear === today.getFullYear() && month === today.getMonth();
            const activeMonth = month === viewMonth;
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setViewMonth(month);
                  setPanel("days");
                }}
                className={cn(
                  "h-10 rounded-lg text-sm font-medium transition-colors",
                  !activeMonth && "text-slate-700 hover:bg-[rgba(var(--brand-accent-rgb),0.7)]",
                  isCurrent && !activeMonth && "ring-1 ring-inset font-bold",
                  activeMonth && "text-white font-bold shadow-sm",
                )}
                style={{
                  ...(activeMonth ? { background: "var(--brand-gradient)" } : {}),
                  ...(isCurrent && !activeMonth
                    ? { ["--tw-ring-color" as string]: "var(--brand-dark)", color: "var(--brand-dark)" }
                    : {}),
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {panel === "days" && (
        <>
          {/* 曜日ヘッダー */}
          <div className="mt-2 grid grid-cols-7">
            {WEEKDAYS.map((w, i) => (
              <span
                key={w}
                className={cn(
                  "h-8 flex items-center justify-center text-[11px] font-semibold",
                  i === 0 ? "text-rose-500" : i === 6 ? "text-sky-500" : "text-slate-500",
                )}
              >
                {w}
              </span>
            ))}
          </div>

          {/* 日グリッド */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {days.map(({ date, inMonth }) => {
              const isSelected = selected != null && isSameDay(date, selected);
              const isToday = isSameDay(date, today);
              const dow = date.getDay();
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => onSelect(date)}
                  className={cn(
                    "h-8 w-8 mx-auto rounded-full text-sm tabular-nums flex items-center justify-center transition-colors",
                    !isSelected && "hover:bg-[rgba(var(--brand-accent-rgb),0.7)]",
                    !inMonth && "text-slate-300",
                    inMonth && !isSelected && (dow === 0 ? "text-rose-500" : dow === 6 ? "text-sky-500" : "text-slate-700"),
                    isToday && !isSelected && "ring-1 ring-inset font-bold",
                    isSelected && "text-white font-bold shadow-sm",
                  )}
                  style={{
                    ...(isSelected ? { background: "var(--brand-gradient)" } : {}),
                    ...(isToday && !isSelected ? { ["--tw-ring-color" as string]: "var(--brand-dark)", color: "var(--brand-dark)" } : {}),
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
};

/** yyyy-MM-dd を扱うシステム独自カレンダー日付選択 */
export function DatePicker({
  value,
  onChange,
  placeholder = "日付を選択",
  disabled,
  className,
  id,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => {
    if (!value) return undefined;
    const d = parse(value, "yyyy-MM-dd", new Date());
    return isValid(d) ? d : undefined;
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-start gap-2 px-3 font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span className="truncate">
            {selected ? format(selected, "yyyy年M月d日", { locale: ja }) : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <BrandCalendar
          selected={selected}
          onSelect={(date) => {
            onChange(format(date, "yyyy-MM-dd"));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
