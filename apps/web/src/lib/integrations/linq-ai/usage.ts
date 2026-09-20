import { createClient } from "@/lib/supabase/server";

export type LinqAiUsageKind = "chat" | "linq" | "transcribe";

/** API 利用を記録する。テーブル未作成・権限不足でも呼び出し側を止めない。 */
export async function recordLinqAiUsage(input: {
  kind?: LinqAiUsageKind;
  provider?: string;
  model?: string | null;
  tokensIn?: number;
  tokensOut?: number;
  companyId?: string | null;
}): Promise<void> {
  try {
    const supabase = await createClient();
    let companyId = input.companyId ?? null;
    if (!companyId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .maybeSingle();
      companyId = profile?.company_id ?? null;
    }
    if (!companyId) return;
    const { error } = await supabase.from("ai_usage_events").insert({
      company_id: companyId,
      kind: input.kind ?? "linq",
      provider: input.provider ?? null,
      model: input.model ?? null,
      tokens_in: Math.max(0, Math.round(Number(input.tokensIn) || 0)),
      tokens_out: Math.max(0, Math.round(Number(input.tokensOut) || 0)),
    });
    if (error) console.warn("[linq-ai] usage insert skipped:", error.message);
  } catch (error) {
    console.warn("[linq-ai] usage insert skipped:", error);
  }
}
