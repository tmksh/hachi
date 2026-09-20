import { getDashboardData } from "@/lib/actions/dashboard";
import type { DashboardData } from "@/lib/queries/dashboard";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  let initialData: DashboardData | undefined;
  try {
    initialData = (await getDashboardData()) as DashboardData;
  } catch {
    initialData = undefined;
  }
  return <DashboardClient initialData={initialData} />;
}
