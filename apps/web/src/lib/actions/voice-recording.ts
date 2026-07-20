"use server";

import { createClient } from "@/lib/supabase/server";
import { uploadToStorageAsAdmin } from "@/lib/storage-server";
import { resolveLinqAiConfig } from "@/lib/integrations/linq-ai/platform-config";
import { processRecordingComplete } from "@/lib/actions/sales-flow";

const ASYNC_THRESHOLD_SEC = 720;   // 12分
const ASYNC_THRESHOLD_BYTES = 25 * 1024 * 1024; // 25MB

/**
 * 音声ファイルを Supabase Storage にアップロードし、
 * ファイルサイズ・録音時間に応じて同期/非同期処理を振り分ける
 */
export async function uploadVoiceRecording(formData: FormData): Promise<{
  mode: "sync" | "async";
  storagePath: string;
  jobId?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("Profile not found");

  const audioBlob = formData.get("audio") as Blob;
  const customerId = formData.get("customerId") as string | null;
  const dealId = formData.get("dealId") as string | null;
  const durationSec = Number(formData.get("durationSec") ?? 0);

  if (!audioBlob || audioBlob.size === 0) throw new Error("音声ファイルが空です");

  const ext = audioBlob.type.includes("ogg") ? "ogg" : "webm";
  const filename = `${Date.now()}.${ext}`;
  const storagePath = `${profile.company_id}/${customerId ?? "anonymous"}/${filename}`;

  await uploadToStorageAsAdmin("voice-recordings", storagePath, audioBlob, {
    contentType: audioBlob.type,
    upsert: false,
  });

  const isAsync = audioBlob.size > ASYNC_THRESHOLD_BYTES || durationSec > ASYNC_THRESHOLD_SEC;

  if (!isAsync) {
    return { mode: "sync", storagePath };
  }

  // 非同期ジョブ作成
  const { data: job, error: jobError } = await supabase
    .from("voice_jobs")
    .insert({
      company_id: profile.company_id,
      customer_id: customerId ?? null,
      deal_id: dealId ?? null,
      storage_path: storagePath,
      duration_sec: durationSec,
      file_size_bytes: audioBlob.size,
      status: "pending",
    })
    .select("id")
    .single();

  if (jobError || !job) throw new Error("ジョブ作成に失敗しました");

  // Netlify Background Function を起動
  const aiConfig = await resolveLinqAiConfig();
  const bgUrl = `${process.env.NEXT_PUBLIC_APP_URL}/.netlify/functions/transcribe-voice-bg`;

  fetch(bgUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId: job.id,
      storagePath,
      apiKey: aiConfig.apiKey,
      model: aiConfig.model ?? "gpt-4o-mini",
    }),
  }).catch((e) => console.error("[voice-bg] 起動失敗:", e));

  return { mode: "async", storagePath, jobId: job.id };
}

/**
 * 同期処理完了後に録音結果をDBに保存し、営業フロー後処理を実行
 */
export async function saveVoiceTranscriptResult(input: {
  customerId: string;
  dealId?: string;
  storagePath: string;
  transcript: string;
  result: {
    title: string;
    summary: string;
    keyPoints: string[];
    todos: Array<{ title: string; priority: "high" | "medium" | "low"; dueDate?: string }>;
    customerUpdates: Record<string, string | null>;
  };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("Profile not found");

  const { data: saved, error } = await supabase
    .from("customer_recordings")
    .insert({
      company_id: profile.company_id,
      customer_id: input.customerId,
      deal_id: input.dealId ?? null,
      transcript: input.transcript,
      summary: input.result.summary,
      title: input.result.title,
      memo: "",
      status: "completed",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) throw error;

  // 営業フロー後処理（ToDo生成・ステージ提案等）
  const processed = await processRecordingComplete({
    customerId: input.customerId,
    recordingId: saved.id,
    dealId: input.dealId,
    transcript: input.transcript,
    memo: "",
  });

  return { recordingId: saved.id, dealId: processed.dealId ?? null };
}
