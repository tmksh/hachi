/**
 * Netlify Background Function — 長時間音声の非同期文字起こし
 * タイムアウト: 最大15分
 * 呼び出し: POST /.netlify/functions/transcribe-voice-bg
 */

import { createClient } from "@supabase/supabase-js";

const WHISPER_SIZE_LIMIT = 24 * 1024 * 1024; // 24MB per chunk
const CHUNK_DURATION_SEC = 720; // 12分チャンク

interface RequestBody {
  jobId: string;
  storagePath: string;
  apiKey: string;
  model: string;
}

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const body = await req.json() as RequestBody;
  const { jobId, storagePath, apiKey, model } = body;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ジョブをprocessingに更新
  await supabase.from("voice_jobs").update({ status: "processing" }).eq("id", jobId);

  try {
    // Storage からファイルを取得
    const { data: fileData, error } = await supabase.storage
      .from("voice-recordings")
      .download(storagePath);

    if (error || !fileData) throw new Error("音声ファイルの取得に失敗");

    const fileBuffer = await fileData.arrayBuffer();
    const fileSizeBytes = fileBuffer.byteLength;

    let fullTranscript = "";

    if (fileSizeBytes <= WHISPER_SIZE_LIMIT) {
      // 25MB以内 → 一括処理
      const transcript = await transcribeChunk(new Blob([fileBuffer], { type: "audio/webm" }), apiKey, 0);
      fullTranscript = transcript ?? "";
    } else {
      // 25MB超 → 時間ベースでチャンク分割
      const chunks = splitAudioBySize(fileBuffer, WHISPER_SIZE_LIMIT);
      const transcripts: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunkBlob = new Blob([chunks[i]], { type: "audio/webm" });
        const chunkTranscript = await transcribeChunk(chunkBlob, apiKey, i * CHUNK_DURATION_SEC);
        if (chunkTranscript) transcripts.push(chunkTranscript);

        // 進捗更新
        await supabase.from("voice_jobs").update({
          result: { progress: Math.round(((i + 1) / chunks.length) * 100) },
        }).eq("id", jobId);
      }

      fullTranscript = transcripts.join("\n\n");
    }

    if (!fullTranscript) throw new Error("文字起こし結果が空です");

    // GPT で議事録生成
    const result = await generateMeetingResult(fullTranscript, apiKey, model);

    // ジョブ完了
    await supabase.from("voice_jobs").update({
      status: "done",
      transcript: fullTranscript,
      result,
    }).eq("id", jobId);

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from("voice_jobs").update({ status: "error", error: msg }).eq("id", jobId);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}

/** バイトサイズ基準で配列バッファを分割 */
function splitAudioBySize(buffer: ArrayBuffer, maxBytes: number): ArrayBuffer[] {
  const chunks: ArrayBuffer[] = [];
  let offset = 0;
  while (offset < buffer.byteLength) {
    chunks.push(buffer.slice(offset, offset + maxBytes));
    offset += maxBytes;
  }
  return chunks;
}

const JA_TRANSCRIBE_PROMPT = "これは日本の工務店・リフォーム会社における商談の録音です。日本語で正確に書き起こしてください。";

/** ハングル等、日本語以外の言語として誤認識された可能性が高いか判定 */
function looksMisrecognized(text: string): boolean {
  if (!text.trim()) return false;
  const hangul = (text.match(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g) ?? []).length;
  return hangul >= 5 && hangul / text.length > 0.05;
}

async function requestTranscription(blob: Blob, apiKey: string, model: string): Promise<string | null> {
  const formData = new FormData();
  formData.append("file", blob, "chunk.webm");
  formData.append("model", model);
  formData.append("language", "ja");
  formData.append("prompt", JA_TRANSCRIBE_PROMPT);
  formData.append("response_format", "text");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
  if (!res.ok) return null;
  return await res.text();
}

async function transcribeChunk(blob: Blob, apiKey: string, offsetSec: number): Promise<string | null> {
  let text = await requestTranscription(blob, apiKey, "gpt-4o-mini-transcribe");

  // API失敗、またはハングル等への言語誤認識を検出したら whisper-1 で再試行
  if (text == null || looksMisrecognized(text)) {
    const retry = await requestTranscription(blob, apiKey, "whisper-1");
    if (retry != null && !looksMisrecognized(retry)) text = retry;
    else text = retry ?? text;
  }

  if (text == null) return null;
  return offsetSec > 0 ? `[${formatTime(offsetSec)}〜]\n${text}` : text;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

async function generateMeetingResult(transcript: string, apiKey: string, model: string) {
  const chatModel = model.includes("gpt") ? model : "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: chatModel,
      temperature: 0.2,
      max_tokens: 3000,
      messages: [
        { role: "system", content: "あなたは工務店・リフォーム会社の営業商談記録専門家です。" },
        {
          role: "user",
          content: `以下の商談録音テキストを分析し、JSONのみ返してください。
{"title":"商談タイトル","summary":"3文以内の要約","keyPoints":["要点"],"todos":[{"title":"ToDo","priority":"high|medium|low","dueDate":"YYYY-MM-DDまたはnull"}],"speakers":[{"label":"話者A","role":"営業|顧客|不明","highlights":["発言"]}],"customerUpdates":{"phone":"または null","email":"または null","budget_max":"数値または null","address":"または null"}}

録音テキスト:
${transcript.slice(0, 16000)}`,
        },
      ],
    }),
  });

  if (!res.ok) return { title: "商談記録", summary: transcript.slice(0, 200), keyPoints: [], todos: [], speakers: [], customerUpdates: {} };

  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  try {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
    return JSON.parse((match?.[1] ?? raw).trim());
  } catch {
    return { title: "商談記録", summary: transcript.slice(0, 200), keyPoints: [], todos: [], speakers: [], customerUpdates: {} };
  }
}
