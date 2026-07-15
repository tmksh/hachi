import { getPerformanceData } from "@/lib/actions/performance";
import { PerformanceClient } from "./performance-client";

export default async function PerformancePage() {
  const initialData = await getPerformanceData({}).catch(() => null);

  return <PerformanceClient initialData={initialData} />;
}
