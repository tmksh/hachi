import { createClient } from "@/lib/supabase/client";

export async function scopedSupabase() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.company_id) throw new Error("会社情報が見つかりません");
  return { supabase, companyId: profile.company_id, userId: user.id };
}
