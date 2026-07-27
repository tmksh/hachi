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

/**
 * 画面上のローカル日時を TIMESTAMPTZ 保存用の ISO（UTC）へ変換する。
 * オフセット無し文字列を渡すと Postgres が UTC 解釈し、再読込で +9h ずれるため必ず使う。
 */
export function toStoredDateTime(date: Date): string {
  return date.toISOString();
}

/**
 * YYYY-MM-DD + HH:mm[:ss] を Asia/Tokyo の壁時計として解釈し ISO にする。
 * CRM「この日時で確定」と同じ経路。
 */
export function tokyoWallTimeToISO(date: string, time: string): string {
  const t = time.length === 5 ? `${time}:00` : time;
  return new Date(`${date}T${t}+09:00`).toISOString();
}
