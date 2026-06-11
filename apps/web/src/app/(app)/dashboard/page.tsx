import { getDashboardData, getUnfollowedLeads } from "@/lib/actions/dashboard";
import { getTodayAttendance } from "@/lib/actions/attendance";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const [initialData, initialAttendance, initialUnfollowedLeads] = await Promise.all([
    getDashboardData(),
    getTodayAttendance(),
    getUnfollowedLeads(),
  ]);

  return (
    <DashboardClient
      initialData={initialData}
      initialAttendance={initialAttendance}
      initialUnfollowedLeads={initialUnfollowedLeads}
    />
  );
}
