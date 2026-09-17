/**
 * 勤怠の締め期間（会社ごとに設定: 例 21日〜翌20日）。
 * closingDay = 0 は月末締め（1日〜末日）。
 */
export type AttendancePeriod = {
  /** YYYY-MM-DD（含む） */
  start: string;
  /** YYYY-MM-DD（含む） */
  end: string;
  /** 「○月度」の年月。締め日が属する月 */
  labelYear: number;
  labelMonth: number;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** 指定日を含む締め期間を返す */
export function periodContaining(date: Date, closingDay: number): AttendancePeriod {
  const y = date.getFullYear();
  const m = date.getMonth();
  const cd = Math.min(28, Math.max(0, Math.floor(closingDay)));

  if (cd === 0) {
    return {
      start: toDateKey(new Date(y, m, 1)),
      end: toDateKey(new Date(y, m, lastDayOfMonth(y, m))),
      labelYear: y,
      labelMonth: m + 1,
    };
  }

  // 締め日以前 → 当月度（前月 cd+1 日〜当月 cd 日）、締め日より後 → 翌月度
  const endMonthIndex = date.getDate() <= cd ? m : m + 1;
  const endDate = new Date(y, endMonthIndex, cd);
  const startDate = new Date(y, endMonthIndex - 1, cd + 1);
  return {
    start: toDateKey(startDate),
    end: toDateKey(endDate),
    labelYear: endDate.getFullYear(),
    labelMonth: endDate.getMonth() + 1,
  };
}

/** 「○月度」の年月から期間を返す（月ナビゲーション用） */
export function periodForLabel(year: number, month1: number, closingDay: number): AttendancePeriod {
  const cd = Math.min(28, Math.max(0, Math.floor(closingDay)));
  if (cd === 0) return periodContaining(new Date(year, month1 - 1, 1), 0);
  return periodContaining(new Date(year, month1 - 1, cd), cd);
}

export function shiftPeriod(p: AttendancePeriod, delta: number, closingDay: number): AttendancePeriod {
  const d = new Date(p.labelYear, p.labelMonth - 1 + delta, 1);
  return periodForLabel(d.getFullYear(), d.getMonth() + 1, closingDay);
}

/** 期間内の全日付（YYYY-MM-DD）を昇順で返す */
export function periodDates(p: AttendancePeriod): string[] {
  const out: string[] = [];
  const cur = parseDateKey(p.start);
  const end = parseDateKey(p.end);
  while (cur <= end) {
    out.push(toDateKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function periodLabel(p: AttendancePeriod, closingDay: number): string {
  const s = parseDateKey(p.start);
  const e = parseDateKey(p.end);
  const range = `${s.getMonth() + 1}/${s.getDate()}〜${e.getMonth() + 1}/${e.getDate()}`;
  if (closingDay === 0) return `${p.labelYear}年${p.labelMonth}月`;
  return `${p.labelYear}年${p.labelMonth}月度（${range}）`;
}
