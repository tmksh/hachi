import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveLinqAiConfig } from "@/lib/integrations/linq-ai/platform-config";

export const maxDuration = 60; // Netlify 上での最大実行時間（秒）

const SYNC_SIZE_LIMIT = 25 * 1024 * 1024; // 25MB

export async function POST(req: NextRequest) {
  // 認証チェック
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  const body = await req.json() as {
    storagePath: string;
    customerId?: string;
    dealId?: string;
    durationSec?: number;
    fileSizeBytes?: number;
  };

  const { storagePath, customerId, dealId, durationSec, fileSizeBytes } = body;
  if (!storagePath) return NextResponse.json({ error: "storagePath required" }, { status: 400 });

  // 25MB超 or 12分超 → 非同期ジョブへ誘導
  const shouldAsync = (fileSizeBytes && fileSizeBytes > SYNC_SIZE_LIMIT) ||
    (durationSec && durationSec > 720);

  if (shouldAsync) {
    return NextResponse.json({ async: true }, { status: 202 });
  }

  const aiConfig = await resolveLinqAiConfig();
  if (!aiConfig.apiKey) {
    return NextResponse.json({ error: "AI APIキーが設定されていません" }, { status: 503 });
  }

  try {
    // Storage から音声ファイルを取得
    const admin = createAdminClient();
    const { data: fileData, error: dlError } = await admin.storage
      .from("voice-recordings")
      .download(storagePath);
    if (dlError || !fileData) {
      return NextResponse.json({ error: "音声ファイルの取得に失敗しました" }, { status: 500 });
    }

    // OpenAI Whisper / gpt-4o-mini-transcribe で文字起こし
    const transcript = await transcribeAudio(fileData, aiConfig.apiKey, aiConfig.model ?? "gpt-4o-mini");
    if (!transcript) {
      return NextResponse.json({ error: "文字起こしに失敗しました" }, { status: 500 });
    }

    // GPT で要約・話者分割・ToDo生成
    const result = await generateMeetingResult(transcript, aiConfig.apiKey, aiConfig.model ?? "gpt-4o-mini");

    // customer_recordings に保存
    if (customerId) {
      const { data: saved } = await supabase
        .from("customer_recordings")
        .insert({
          customer_id: customerId,
          deal_id: dealId ?? null,
          storage_path: storagePath,
          transcript,
          summary: result.summary,
          title: result.title,
          memo: "",
        })
        .select("id")
        .single();

      return NextResponse.json({ transcript, result, recordingId: saved?.id });
    }

    return NextResponse.json({ transcript, result });
  } catch (e) {
    console.error("[voice-transcribe]", e);
    return NextResponse.json({ error: "処理中にエラーが発生しました" }, { status: 500 });
  }
}

async function transcribeAudio(blob: Blob, apiKey: string, model: string): Promise<string | null> {
  const formData = new FormData();
  // gpt-4o-mini-transcribe が利用可能なら使用、なければ whisper-1 にフォールバック
  const transcribeModel = model.includes("gpt-4o") ? "gpt-4o-mini-transcribe" : "whisper-1";
  formData.append("file", blob, "recording.webm");
  formData.append("model", transcribeModel);
  formData.append("language", "ja");
  formData.append("response_format", "text");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    // フォールバック: whisper-1 で再試行
    if (transcribeModel !== "whisper-1") {
      formData.set("model", "whisper-1");
      const res2 = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });
      if (!res2.ok) return null;
      return await res2.text();
    }
    return null;
  }
  return await res.text();
}

export async function generateMeetingResult(transcript: string, apiKey: string, model: string) {
  const chatModel = model.includes("gpt-4o") ? model : "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: chatModel,
      temperature: 0.2,
      max_tokens: 2048,
      messages: [
        {
          role: "system",
          content: "あなたは工務店・リフォーム会社の営業商談記録専門家です。",
        },
        {
          role: "user",
          content: `以下の商談録音テキストを分析し、JSONのみ返してください（説明文不要）。

{"title":"商談タイトル（20文字以内）","summary":"3文以内の要約","keyPoints":["要点1","要点2","要点3"],"todos":[{"title":"ToDo","priority":"high|medium|low","dueDate":"YYYY-MM-DDまたはnull"}],"speakers":[{"label":"話者A","role":"営業|顧客|不明","highlights":["発言1"]}],"customerUpdates":{"phone":"電話番号またはnull","email":"メールまたはnull","budget_max":"予算数値またはnull","address":"住所またはnull"}}

録音テキスト:
${transcript.slice(0, 12000)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    return { title: "商談記録", summary: transcript.slice(0, 200), keyPoints: [], todos: [], speakers: [], customerUpdates: {} };
  }

  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw = json.choices?.[0]?.message?.content ?? "{}";

  try {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
    const parsed = JSON.parse((match?.[1] ?? raw).trim()) as {
      title?: string;
      summary?: string;
      keyPoints?: string[];
      todos?: Array<{ title: string; priority?: string; dueDate?: string | null }>;
      speakers?: Array<{ label: string; role: string; highlights: string[] }>;
      customerUpdates?: Record<string, string | null>;
    };
    return {
      title: parsed.title ?? "商談記録",
      summary: parsed.summary ?? "",
      keyPoints: parsed.keyPoints ?? [],
      todos: (parsed.todos ?? []).map((t) => ({
        title: t.title,
        priority: (["high", "medium", "low"].includes(t.priority ?? "") ? t.priority : "medium") as "high" | "medium" | "low",
        dueDate: t.dueDate && t.dueDate !== "null" ? t.dueDate : undefined,
      })),
      speakers: parsed.speakers ?? [],
      customerUpdates: parsed.customerUpdates ?? {},
    };
  } catch {
    return { title: "商談記録", summary: transcript.slice(0, 200), keyPoints: [], todos: [], speakers: [], customerUpdates: {} };
  }
}
