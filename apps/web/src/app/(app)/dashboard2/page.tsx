import { getDashboardData } from "@/lib/actions/dashboard";
import { getTodayAttendance } from "@/lib/actions/attendance";
import { Dashboard2Client } from "./dashboard2-client";

export default async function Dashboard2Page() {
  const [initialData, initialAttendance] = await Promise.all([
    getDashboardData(),
    getTodayAttendance(),
  ]);

  return (
    <Dashboard2Client
      initialData={initialData}
      initialAttendance={initialAttendance}
    />
  );
}
