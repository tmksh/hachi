import { addDays, startOfWeek } from "date-fns";
import { getCalendarEvents, getCompanyMembersWithCalendar } from "@/lib/actions/calendar";
import { CalendarClient } from "./calendar-client";

function getInitialCalendarRange() {
  const currentDate = new Date();
  const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
  const pad = 7;
  return {
    rangeStart: addDays(ws, -pad),
    rangeEnd: addDays(ws, 6 + pad),
  };
}

export default async function CalendarPage() {
  const { rangeStart, rangeEnd } = getInitialCalendarRange();

  const [initialEvents, initialMembers] = await Promise.all([
    getCalendarEvents({
      start: rangeStart.toISOString(),
      end: rangeEnd.toISOString(),
    }).catch(() => []),
    getCompanyMembersWithCalendar().catch(() => []),
  ]);

  return (
    <CalendarClient
      initialEvents={initialEvents}
      initialMembers={initialMembers}
    />
  );
}
