import { Suspense } from "react";
import { endOfDay, startOfDay, startOfWeek, addDays } from "date-fns";
import { getCalendarEvents } from "@/lib/actions/calendar";
import { CalendarClient } from "./calendar-client";
import { Skeleton } from "@/components/ui/skeleton";

function getInitialCalendarRange() {
  const currentDate = new Date();
  // 初期は週ビュー想定で表示週のみ（前後パッド取得しない＝SSR を軽く）
  const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
  return {
    rangeStart: startOfDay(ws),
    rangeEnd: endOfDay(addDays(ws, 6)),
  };
}

export default async function CalendarPage() {
  const { rangeStart, rangeEnd } = getInitialCalendarRange();

  // メンバー一覧は初回表示に不要 → クライアントで idle 取得（TTV 優先）
  const initialEvents = await getCalendarEvents({
    start: rangeStart.toISOString(),
    end: rangeEnd.toISOString(),
  }).catch(() => []);

  return (
    <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-xl" />}>
      <CalendarClient
        initialEvents={initialEvents}
        initialMembers={[]}
      />
    </Suspense>
  );
}
