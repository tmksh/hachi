import { createClient } from "@/lib/supabase/client";
import type { AttendanceEntry } from "@/lib/database.types";

function getTodayJST(): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replace(/\//g, "-");
}

export async function fetchTodayAttendance(): Promise<AttendanceEntry | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return null;

  const { data } = await supabase
    .from("attendance_entries")
    .select("*")
    .eq("user_id", user.id)
    .eq("work_date", getTodayJST())
    .maybeSingle();
  return (data as AttendanceEntry | null) ?? null;
}
