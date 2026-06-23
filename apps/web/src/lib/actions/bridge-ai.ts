"use server";

import { resolveLinqAiConfig } from "@/lib/integrations/linq-ai/platform-config";

const SYSTEM_PROMPT = `あなたは「BRIDGE AI」— 工務店・リフォーム会社向けSaaS「BRIDGE」の専任アシスタントです。

できること:
- BRIDGE の操作方法・機能説明
- 顧客管理（CRM）・商談・見積・工事・契約・請求の進め方サポート
- 営業フロー・業務フロー全般のアドバイス
- データの見方・分析の解説

できないこと（正直に伝える）:
- リアルタイムのデータ参照（「今の受注額は？」等）
- 外部サービスの操作

回答は簡潔・丁寧に。箇条書きを積極活用。不明な場合は正直に伝える。`;

type Message = { role: "user" | "assistant"; text: string };

async function callOpenAiChat(messages: Message[], config: { apiKey: string; model: string }): Promise<string | null> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages.map((m) => ({ role: m.role, content: m.text })),
      ],
      temperature: 0.5,
      max_tokens: 1024,
    }),
  });
  if (!res.ok) return null;
  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? null;
}

async function callGeminiChat(messages: Message[], config: { apiKey: string; model: string }): Promise<string | null> {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text }],
  }));
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { temperature: 0.5, maxOutputTokens: 1024 },
      }),
    },
  );
  if (!res.ok) return null;
  const json = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

async function callAnthropicChat(messages: Message[], config: { apiKey: string; model: string }): Promise<string | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({ role: m.role, content: m.text })),
    }),
  });
  if (!res.ok) return null;
  const json = await res.json() as { content?: Array<{ text?: string }> };
  return json.content?.[0]?.text ?? null;
}

export async function sendBridgeAiMessage(
  history: Message[],
  pathname: string,
): Promise<{ text: string; ok: boolean }> {
  const config = await resolveLinqAiConfig();

  if (!config.enabled || !config.apiKey) {
    return {
      ok: false,
      text: "AI機能が設定されていません。管理者にお問い合わせください。",
    };
  }

  const messagesWithContext: Message[] = [
    ...history.slice(0, -1),
    {
      role: "user",
      text: `[現在のページ: ${pathname}]\n${history.at(-1)?.text ?? ""}`,
    },
  ];

  try {
    let reply: string | null = null;
    const provider = config.provider ?? "openai";
    const llmConfig = { apiKey: config.apiKey, model: config.model ?? "gpt-4o-mini" };

    if (provider === "openai" || provider === "azure") {
      reply = await callOpenAiChat(messagesWithContext, llmConfig);
    } else if (provider === "google") {
      reply = await callGeminiChat(messagesWithContext, llmConfig);
    } else if (provider === "anthropic") {
      reply = await callAnthropicChat(messagesWithContext, llmConfig);
    }

    if (!reply) {
      return { ok: false, text: "AIからの応答を取得できませんでした。しばらくしてからもう一度お試しください。" };
    }

    return { ok: true, text: reply };
  } catch {
    return { ok: false, text: "通信エラーが発生しました。しばらくしてからもう一度お試しください。" };
  }
}

export async function improveRecordingText(text: string): Promise<{ result: string; ok: boolean }> {
  const config = await resolveLinqAiConfig();

  if (!config.enabled || !config.apiKey) {
    return { ok: false, result: text };
  }

  try {
    const prompt = `以下の商談メモ・文字起こしを、要点が明確で読みやすいビジネス文書に整えてください。
- 箇条書きを活用
- 次のアクション（ToDo）があれば明記
- 元の内容を要約・改善するのみ（創作しない）
- 出力は整えたテキストのみ（説明文不要）

元のテキスト:
${text.slice(0, 4000)}`;

    const llmConfig = { apiKey: config.apiKey, model: config.model ?? "gpt-4o-mini" };
    let result: string | null = null;
    const provider = config.provider ?? "openai";

    if (provider === "openai" || provider === "azure") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${llmConfig.apiKey}` },
        body: JSON.stringify({
          model: llmConfig.model,
          messages: [
            { role: "system", content: "あなたは工務店の優秀な営業秘書です。" },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 1024,
        }),
      });
      if (res.ok) {
        const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
        result = json.choices?.[0]?.message?.content ?? null;
      }
    } else if (provider === "google") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${llmConfig.model}:generateContent?key=${llmConfig.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        },
      );
      if (res.ok) {
        const json = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        result = json.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
      }
    } else if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": llmConfig.apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: llmConfig.model, max_tokens: 1024, messages: [{ role: "user", content: prompt }] }),
      });
      if (res.ok) {
        const json = await res.json() as { content?: Array<{ text?: string }> };
        result = json.content?.[0]?.text ?? null;
      }
    }

    if (!result) return { ok: false, result: text };
    return { ok: true, result };
  } catch {
    return { ok: false, result: text };
  }
}
