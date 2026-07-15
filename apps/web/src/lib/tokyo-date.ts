/** 日本時間（Asia/Tokyo）のカレンダー日付 YYYY-MM-DD */
export function tokyoDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** due_date（YYYY-MM-DD）が日本時間の今日か */
export function isTokyoToday(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  return dueDate.slice(0, 10) === tokyoDateString();
}
