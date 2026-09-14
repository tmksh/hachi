import { fetchBrowserUser } from "./browser-auth";
import { createClient } from "@/lib/supabase/client";

export async function fetchDashboardSettings(): Promise<unknown[] | null> {
  const supabase = createClient();
  const user = await fetchBrowserUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_dashboard_settings")
    .select("settings")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) return null;

  const raw = data.settings as { widgets?: unknown[] };
  return Array.isArray(raw.widgets) ? raw.widgets : null;
}
