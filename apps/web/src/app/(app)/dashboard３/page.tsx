import { getDashboardData } from "@/lib/actions/dashboard";
import { getTodayAttendance } from "@/lib/actions/attendance";
import { Dashboard3AltClient } from "./dashboard3-alt-client";

export default async function Dashboard3AltPage() {
  const [initialData, initialAttendance] = await Promise.all([
    getDashboardData(),
    getTodayAttendance(),
  ]);

  return (
    <Dashboard3AltClient
      initialData={initialData}
      initialAttendance={initialAttendance}
    />
  );
}
