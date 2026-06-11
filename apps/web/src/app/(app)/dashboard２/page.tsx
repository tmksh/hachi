import { getDashboardData } from "@/lib/actions/dashboard";
import { getTodayAttendance } from "@/lib/actions/attendance";
import { Dashboard2AltClient } from "./dashboard2-alt-client";

export default async function Dashboard2AltPage() {
  const [initialData, initialAttendance] = await Promise.all([
    getDashboardData(),
    getTodayAttendance(),
  ]);

  return (
    <Dashboard2AltClient
      initialData={initialData}
      initialAttendance={initialAttendance}
    />
  );
}
