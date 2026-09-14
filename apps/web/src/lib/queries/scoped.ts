import { browserAuthContext } from "./browser-auth";

export async function scopedSupabase() {
  const { supabase, user, profile } = await browserAuthContext();
  if (!user) throw new Error("ログインが必要です");
  if (!profile?.company_id) throw new Error("会社情報が見つかりません");
  return { supabase, companyId: profile.company_id, userId: user.id };
}
