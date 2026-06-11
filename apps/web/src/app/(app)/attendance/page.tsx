import { format } from "date-fns";
import { getAuthUser } from "@/lib/supabase/auth";
import { getCompany } from "@/lib/actions/profiles";
import { getAttendanceEntries } from "@/lib/actions/attendance";
import { AttendanceClient } from "./attendance-client";

export default async function AttendancePage() {
  const user = await getAuthUser();
  const month = format(new Date(), "yyyy-MM");

  const [initialCompany, initialEntries] = await Promise.all([
    getCompany().catch(() => null),
    user
      ? getAttendanceEntries({ month, userId: user.id }).catch(() => [])
      : Promise.resolve([]),
  ]);

  return (
    <AttendanceClient
      initialCompany={initialCompany}
      initialEntries={initialEntries}
      initialUserId={user?.id ?? null}
    />
  );
}
