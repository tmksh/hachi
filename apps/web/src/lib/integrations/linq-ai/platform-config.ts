import { createAdminClient } from "@/lib/supabase/admin";
import type { LinqAiConfig } from "./types";

const PLATFORM_KEY = "linq_ai";

type StoredLinqAi = Partial<LinqAiConfig & { apiKey?: string }>;

/** プラットフォーム共通 AI 設定（SaaS: 運営が /admin で設定） */
export async function resolveLinqAiConfig(): Promise<LinqAiConfig> {
  let stored: StoredLinqAi = {};
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", PLATFORM_KEY)
      .maybeSingle();
    stored = (data?.value ?? {}) as StoredLinqAi;
  } catch {
    // DB 未接続時は env のみ
  }

  const apiKey =
    stored.apiKey?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.LINQ_AI_API_KEY?.trim() ||
    undefined;

  const enabled = Boolean(stored.enabled ?? process.env.LINQ_AI_ENABLED === "true") && Boolean(apiKey);

  return {
    enabled,
    provider: stored.provider ?? "openai",
    apiKey,
    model: stored.model ?? process.env.LINQ_AI_MODEL ?? "gpt-4o-mini",
    sttProvider: stored.sttProvider ?? "web_speech",
  };
}

/** 管理画面用（APIキー本体は返さない） */
export async function getPlatformLinqAiPublicConfig() {
  let stored: StoredLinqAi = {};
  let updatedAt: string | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_settings")
      .select("value, updated_at")
      .eq("key", PLATFORM_KEY)
      .maybeSingle();
    stored = (data?.value ?? {}) as StoredLinqAi;
    updatedAt = data?.updated_at ?? null;
  } catch {
    return {
      enabled: false,
      provider: "openai" as const,
      model: "gpt-4o-mini",
      sttProvider: "web_speech" as const,
      apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.LINQ_AI_API_KEY),
      updatedAt: null as string | null,
    };
  }

  const envKey = Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.LINQ_AI_API_KEY);
  return {
    enabled: Boolean(stored.enabled),
    provider: (stored.provider ?? "openai") as LinqAiConfig["provider"],
    model: stored.model ?? "gpt-4o-mini",
    sttProvider: (stored.sttProvider ?? "web_speech") as LinqAiConfig["sttProvider"],
    apiKeyConfigured: Boolean(stored.apiKey?.trim()) || envKey,
    updatedAt,
  };
}

export async function savePlatformLinqAiConfig(
  input: {
    enabled: boolean;
    provider?: LinqAiConfig["provider"];
    model?: string;
    apiKey?: string;
    sttProvider?: LinqAiConfig["sttProvider"];
  },
  updatedBy?: string,
) {
  const admin = createAdminClient();
  const { data: current } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", PLATFORM_KEY)
    .maybeSingle();

  const prev = (current?.value ?? {}) as StoredLinqAi;
  const nextValue: StoredLinqAi = {
    enabled: input.enabled,
    provider: input.provider ?? prev.provider ?? "openai",
    model: input.model ?? prev.model ?? "gpt-4o-mini",
    sttProvider: input.sttProvider ?? prev.sttProvider ?? "web_speech",
    apiKey: input.apiKey?.trim() ? input.apiKey.trim() : prev.apiKey,
  };

  const { error } = await admin.from("platform_settings").upsert(
    {
      key: PLATFORM_KEY,
      value: nextValue,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy ?? null,
    },
    { onConflict: "key" },
  );
  if (error) throw error;
}
