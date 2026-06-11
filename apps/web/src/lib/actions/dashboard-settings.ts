"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";
import type { WidgetConfig } from "@/hooks/use-widgets";

export async function getDashboardSettings(): Promise<WidgetConfig[] | null> {
  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_dashboard_settings")
    .select("settings")
    .eq("user_id", user.id)
    .single();

  if (error || !data) return null;

  const raw = data.settings as { widgets?: WidgetConfig[] };
  return Array.isArray(raw.widgets) ? raw.widgets : null;
}

export async function saveDashboardSettings(widgets: WidgetConfig[]): Promise<void> {
  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return;

  await supabase
    .from("user_dashboard_settings")
    .upsert(
      { user_id: user.id, settings: { widgets }, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
}
